// G36 — derive a human workout name from the finished session.
//
// Background: TrainingScreen.finishWorkout used to submit `name: null`, but
// the backend createWorkout rejects a falsy name with HTTP 400 — so every
// logged session failed on sync (G9-era bug). Rather than interrupt the
// end-of-session flow with a name prompt (the user is mid-gym, one more
// modal is friction), the name is derived from what was actually trained.
//
// An exercise-derived name ("Bench Press, Squat +3 more") is far more useful
// in a workout history list than a time-of-day label, so exercise names win;
// the time-of-day form is only the fallback when nothing is named.

const MAX_NAME_LENGTH = 60;

/** Morning (<12) / Afternoon (<17) / Evening — used only as a fallback. */
export function timeOfDayLabel(date) {
  const h = (date instanceof Date && !isNaN(date) ? date : new Date()).getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}

/**
 * Build a workout name from the TrainingScreen exercise rows.
 * @param exercises [{ name }] — flat rows; unnamed/blank entries are ignored.
 * @param date      Date used for the fallback label (defaults to now).
 * @returns a non-empty string, always — the backend requires a truthy name.
 */
export function deriveWorkoutName(exercises, date) {
  const names = (Array.isArray(exercises) ? exercises : [])
    .map((e) => (e && typeof e.name === 'string' ? e.name.trim() : ''))
    .filter(Boolean);

  // De-duplicate while preserving order (an exercise can be added twice).
  const unique = [];
  for (const n of names) {
    if (!unique.includes(n)) unique.push(n);
  }

  if (unique.length === 0) return `${timeOfDayLabel(date)} Workout`;

  let name;
  if (unique.length === 1) name = unique[0];
  else if (unique.length === 2) name = `${unique[0]} & ${unique[1]}`;
  else name = `${unique[0]}, ${unique[1]} +${unique.length - 2} more`;

  return name.length > MAX_NAME_LENGTH ? `${name.slice(0, MAX_NAME_LENGTH - 1).trimEnd()}…` : name;
}
