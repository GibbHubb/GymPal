// G34 — per-exercise personal-record detection.
//
// NOTE: despite the `use*` filename (kept to match the plan), this is an
// imperative async helper, not a React render hook — it is called from
// TrainingScreen.finishWorkout, not during render. It mirrors the
// useVolumeData fetch pattern (raw fetch + Bearer token) rather than the
// utils/api module, so it was unaffected by the bad-import-path issue (G35)
// that other screens had (they imported from a nonexistent '../../utils/api'
// instead of the tracked root api.js).
//
// Compares the just-finished session's best estimated-1RM and best single-set
// volume against the user's prior bests. Because PRs are computed from the
// in-memory finished session BEFORE it syncs, a freshly-logged set is never
// compared against itself (see TrainingScreen ordering).
//
// G38 — the baselines now come from POST /api/workouts/pr-baselines, one
// request for the whole session. This previously fetched each exercise's
// entire history via GET /workouts/progress/:exerciseId and reduced it here,
// which cost N round trips per finish and a payload that grew for the life of
// the account. No new table: the server aggregates in SQL using the same
// formulas as prMath (parity pinned by utils/__tests__/prBaselineParity).

import AsyncStorage from '@react-native-async-storage/async-storage';
// G38 — bestEpleyOfRows/bestVolumeOfRows are no longer used here now that the
// server aggregates the baseline. They remain exported from prMath (and unit
// tested) because they are the reference definition the SQL mirrors.
import { epley1RM, setVolume } from '../utils/prMath';

const API_URL = 'https://gympalbackend-production.up.railway.app/api';

/**
 * G38 — fetch prior bests for every exercise in ONE request.
 *
 * This replaced a per-exercise GET /workouts/progress/:id that returned the
 * user's entire history for that exercise, purely so the client could reduce
 * it to two maxima. Two costs, both unbounded: N round trips per finish, and
 * a payload that grows for the life of the account (two years of bench press
 * is ~1,250 rows downloaded on every single workout finish).
 *
 * The server now aggregates in SQL using the same formulas as prMath, so a
 * baseline is identical to one derived here from the same rows.
 *
 * Returns a Map exercise_id -> { best_volume, best_1rm }. Exercises absent
 * from the response have no prior history, and an absent entry is what stops
 * a first-ever log being celebrated as a PR — the same role the old empty
 * history array played.
 *
 * Any failure yields an empty Map, i.e. no baselines, i.e. no PRs — PR
 * detection stays best-effort and never blocks finishing a workout.
 */
async function fetchBaselines(exerciseIds, token) {
  try {
    const res = await fetch(`${API_URL}/workouts/pr-baselines`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ exercise_ids: exerciseIds }),
    });
    if (!res.ok) return new Map();
    const rows = await res.json();
    if (!Array.isArray(rows)) return new Map();
    return new Map(
      rows
        .filter((r) => r && r.exercise_id != null && Number(r.entry_count) > 0)
        .map((r) => [
          r.exercise_id,
          { best_volume: Number(r.best_volume) || 0, best_1rm: Number(r.best_1rm) || 0 },
        ]),
    );
  } catch {
    return new Map();
  }
}

/**
 * Compute new PRs for a just-finished session.
 * @param finishedExercises flat exercises from TrainingScreen state:
 *        [{ exercise_id, name, sets:<count>, reps, weight }]
 * @returns array of { exercise_id, exercise_name, type:'1rm'|'volume', value, previous }
 *          (empty array on any failure — PR detection is best-effort).
 */
export async function computePersonalRecords(finishedExercises) {
  try {
    if (!Array.isArray(finishedExercises) || finishedExercises.length === 0) return [];
    const token = await AsyncStorage.getItem('token');
    if (!token) return [];

    // Collapse the flat list to the best session weight/reps per exercise
    // (an exercise can appear more than once if added repeatedly).
    const byId = new Map();
    for (const e of finishedExercises) {
      if (!e.exercise_id) continue;
      const weight = parseFloat(e.weight) || 0;
      const reps = parseInt(e.reps, 10) || 0;
      const cur = byId.get(e.exercise_id);
      const oneRm = epley1RM(weight, reps);
      const vol = setVolume(weight, reps);
      if (!cur) {
        byId.set(e.exercise_id, { exercise_id: e.exercise_id, name: e.name, oneRm, vol });
      } else {
        cur.oneRm = Math.max(cur.oneRm, oneRm);
        cur.vol = Math.max(cur.vol, vol);
      }
    }

    // G38 — one request for every exercise, instead of one request each.
    const baselines = await fetchBaselines(
      Array.from(byId.keys()),
      token,
    );

    const prs = [];
    for (const ex of byId.values()) {
      const base = baselines.get(ex.exercise_id);
      if (!base) continue; // no prior baseline → no false "first-ever" PR
      const prior1Rm = base.best_1rm;
      const priorVol = base.best_volume;
      if (ex.oneRm > 0 && ex.oneRm > prior1Rm) {
        prs.push({
          exercise_id: ex.exercise_id,
          exercise_name: ex.name,
          type: '1rm',
          value: Math.round(ex.oneRm),
          previous: Math.round(prior1Rm),
        });
      }
      if (ex.vol > 0 && ex.vol > priorVol) {
        prs.push({
          exercise_id: ex.exercise_id,
          exercise_name: ex.name,
          type: 'volume',
          value: Math.round(ex.vol),
          previous: Math.round(priorVol),
        });
      }
    }
    return prs;
  } catch {
    return [];
  }
}
