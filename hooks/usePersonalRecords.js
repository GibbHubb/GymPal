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
// Pure client recompute over the user's own history (the G29 deload model):
// for each just-finished exercise, fetch its prior history via
// GET /api/workouts/progress/:exerciseId and compare the session's best
// estimated-1RM and best single-set volume against the prior bests. No new
// endpoint, no schema. Because PRs are computed from the in-memory finished
// session BEFORE it syncs, a freshly-logged set is never compared against
// itself (see TrainingScreen ordering).

import AsyncStorage from '@react-native-async-storage/async-storage';
import { epley1RM, setVolume, bestEpleyOfRows, bestVolumeOfRows } from '../utils/prMath';

const API_URL = 'https://gympalbackend-production.up.railway.app/api';

// Fetch prior history rows ({ weight, reps, date }) for one exercise.
// Returns [] when the exercise has no prior data (404) or on any error —
// an empty history means "no prior baseline", so no PR can fire.
async function fetchHistory(exerciseId, token) {
  try {
    const res = await fetch(`${API_URL}/workouts/progress/${exerciseId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return []; // 404 (no data) or other → treat as no baseline
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
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

    const prs = [];
    await Promise.all(
      Array.from(byId.values()).map(async (ex) => {
        const rows = await fetchHistory(ex.exercise_id, token);
        if (rows.length === 0) return; // no prior baseline → no false "first-ever" PR
        const prior1Rm = bestEpleyOfRows(rows);
        const priorVol = bestVolumeOfRows(rows);
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
      }),
    );
    return prs;
  } catch {
    return [];
  }
}
