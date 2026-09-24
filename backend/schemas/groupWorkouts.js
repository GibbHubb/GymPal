// G49 — schemas for the three group-workout write routes. Note group_workout_exercises
// stores sets/reps/weight as plain numbers per exercise (unlike Workouts, where `sets` is
// an array of per-set objects) — these are genuinely different tables, not an inconsistency
// to paper over.
const { z } = require('zod');

const exerciseEntry = z.object({
  exercise_id: z.coerce.number().int(),
  sets: z.coerce.number().nonnegative().nullish(),
  // 🔴 NOT z.coerce.number(): the trainer UI's rep field is free text and is
  // MEANT to hold a range — CreateWorkout.js's placeholder is literally "10-12".
  // Coercing it gave NaN, so every real createGroupWorkout submission 400'd at
  // the middleware, breaking the trainer's only path to this endpoint. The
  // column stores it as-is (controller: `exercise.reps || 0`), so a bounded
  // string or a number are both valid (cross-file review, 2026-09-24).
  reps: z.union([z.number().nonnegative(), z.string().trim().min(1).max(20)]).nullish(),
  // No z.coerce here: coercion turns '' into 0, so an empty rep field would have
  // been stored as "0 reps" instead of rejected (caught by this ticket's own
  // regression test, 2026-09-24). A numeric string like "12" still passes via the
  // string branch and reaches the column exactly as the client sent it.
  weight: z.coerce.number().nonnegative().nullish(),
});

const participantEntry = z.object({
  user_id: z.coerce.number().int(),
  custom_reps: z.coerce.number().nullish(),
  custom_sets: z.coerce.number().nullish(),
  custom_weights: z.coerce.number().nullish(),
  notes: z.string().nullish(),
});

const createGroupWorkout = z.object({
  name: z.string().trim().min(1),
  trainer_id: z.coerce.number().int(),
  date: z.string().nullish(),
  notes: z.string().nullish(),
  exercises: z.array(exerciseEntry),
  participants: z.array(participantEntry).nullish(),
});

// editGroupWorkout had NO validation at all before G49 — not even presence checks.
const editGroupWorkout = z.object({
  name: z.string().trim().min(1).nullish(),
  trainer_id: z.coerce.number().int().nullish(),
  date: z.string().nullish(),
  notes: z.string().nullish(),
  level: z.string().nullish(),
  duration: z.coerce.number().nullish(),
  expected_sets: z.coerce.number().nullish(),
  expected_reps: z.coerce.number().nullish(),
  expected_weight: z.coerce.number().nullish(),
});

// finishGroupWorkout also had no validation. api.js's finishGroupWorkout() call site shows
// plain numbers for all three (e.g. finishGroupWorkout(id, userId, 3, 10, 50)).
const finishGroupWorkout = z.object({
  user_id: z.coerce.number().int(),
  actual_sets: z.coerce.number().nonnegative(),
  actual_reps: z.coerce.number().nonnegative(),
  actual_weight: z.coerce.number().nonnegative(),
});

module.exports = { createGroupWorkout, editGroupWorkout, finishGroupWorkout };
