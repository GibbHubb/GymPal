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
