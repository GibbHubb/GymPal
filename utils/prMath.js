// G34 — pure, React-free PR math so it's unit-testable without RN.
//
// Estimated 1RM uses the Epley formula: 1RM = weight × (1 + reps/30).
// Chosen over Brzycki/Lombardi because it is the most widely used,
// monotonic in both weight and reps, and degrades gracefully at low
// rep counts. Volume is defined as a single set's weight × reps (the
// same single-set definition the G9 server-side PB uses), which avoids
// ambiguous session-grouping when comparing against history rows.

/** Epley estimated 1RM. Returns 0 for non-positive / invalid input. */
export function epley1RM(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!(w > 0) || !(r > 0)) return 0;
  return w * (1 + r / 30);
}

/** Single-set volume = weight × reps. Returns 0 for invalid input. */
export function setVolume(weight, reps) {
  const w = Number(weight);
  const r = Number(reps);
  if (!(w > 0) || !(r > 0)) return 0;
  return w * r;
}

/**
 * Best estimated 1RM across a list of history rows ({ weight, reps }).
 * Returns 0 when no row yields a positive 1RM.
 */
export function bestEpleyOfRows(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((max, row) => Math.max(max, epley1RM(row.weight, row.reps)), 0);
}

/**
 * Best single-set volume across a list of history rows ({ weight, reps }).
 * Returns 0 when no row yields a positive volume.
 */
export function bestVolumeOfRows(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((max, row) => Math.max(max, setVolume(row.weight, row.reps)), 0);
}

/**
 * G39 — de-duplicate the two volume celebrations.
 *
 * The G9 server PB and the G34 client volume PR are the SAME computation
 * (best single-set weight × reps vs prior history), so a volume PR used to
 * surface twice: once in the gold "NEW PERSONAL BEST" banner and once in the
 * blue "📈 Volume PR" banner.
 *
 * The client banner wins because it is strictly richer — it also reports
 * estimated-1RM PRs, which the server never computes. But the client path is
 * best-effort (it returns [] when offline or when the history fetch fails),
 * so the server PB is kept as a fallback for any exercise the client did not
 * already report a volume PR for. Server PBs are never dropped wholesale.
 *
 * Note this only affects the in-app banner. The server-side push
 * notification fires independently in createWorkout and is untouched.
 *
 * @param serverPBs [{ exercise_id, exercise_name, new_volume, previous_best }]
 * @param clientPRs [{ exercise_id, type:'1rm'|'volume', ... }]
 * @returns the subset of serverPBs not already covered by a client volume PR.
 */
export function mergePersonalBests(serverPBs, clientPRs) {
  if (!Array.isArray(serverPBs)) return [];
  const covered = new Set(
    (Array.isArray(clientPRs) ? clientPRs : [])
      .filter((pr) => pr && pr.type === 'volume' && pr.exercise_id != null)
      .map((pr) => String(pr.exercise_id)),
  );
  if (covered.size === 0) return serverPBs;
  return serverPBs.filter((pb) => !(pb && pb.exercise_id != null && covered.has(String(pb.exercise_id))));
}
