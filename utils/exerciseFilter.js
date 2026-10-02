// G52 — the exercise-picker filter, shared by TrainingScreen and ProgressScreen.
//
// No cap: ProgressScreen used to show `.slice(0, 20)` of the matches with no hint that more
// existed, so the 21st match of a search was simply unreachable. Virtualized lists (FlatList)
// now carry the render cost that the cap was standing in for.

/** The display name of a pool entry (the app's exercise pool mixes strings and objects). */
export function exerciseName(exercise) {
  if (typeof exercise === 'string') return exercise;
  return (exercise && exercise.name) || '';
}

/** Every entry whose name contains `query` (case-insensitive, trimmed). Empty query: none. */
export function filterExercises(pool, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q || !Array.isArray(pool)) return [];
  return pool.filter((e) => exerciseName(e).toLowerCase().includes(q));
}

/** A stable list key: the id when there is one, else the name. */
export function exerciseKey(exercise) {
  if (exercise && typeof exercise === 'object' && exercise.exercise_id != null) {
    return `id:${exercise.exercise_id}`;
  }
  return `name:${exerciseName(exercise)}`;
}
