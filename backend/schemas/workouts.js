// G49 — schemas for the two workouts write routes.
//
// createWorkout is the PLAN's own §3 example, but its real shape differs from the plan's
// literal curl (`exercises: [{ exercise_id: "abc", sets: -1 }]`): `sets` is an ARRAY of
// per-set objects (`{ weight, reps, rir }`), not a set count — see workoutsController.js:65-71
// (`sets.length`, `sets.map(({weight, reps, rir}) => ...)`). A `sets: -1` body would have hit
// `(-1).map is not a function`, not reached the database as a bad row. The schema below
// validates the REAL shape; the equivalent bad-body test used at execution time is
// `exercises: [{ exercise_id: "abc", sets: [{ weight: -1, reps: "x" }] }]`, which exercises
// the same "index + field" failure the criterion is checking for.
const { z } = require('zod');

// `.nullish()`: the controller already reads these as `parseFloat(s.weight) || 0`,
// and a set queued OFFLINE by an older client build can carry null. Rejecting it
// would 400 forever on every retry — the poison-pill-in-the-sync-queue failure
// G36 already paid for once (review, 2026-09-24).
const setEntry = z.object({
  weight: z.coerce.number().nullish(),
  reps: z.coerce.number().nullish(),
  rir: z.coerce.number().nullish(),
});

const exerciseEntry = z.object({
  exercise_id: z.coerce.number().int(),
  sets: z.array(setEntry).min(1),
});

const createWorkout = z.object({
  // G36 — `name` stays optional; the controller already falls back to 'Workout' for an
  // offline-queued session that carries `name: null`. Do not make this required.
  name: z.string().nullish(),
  date: z.string().nullish(),
  notes: z.string().nullish(),
  exercises: z.array(exerciseEntry).min(1),
  // Idempotency key — a client-generated UUID string, not a DB-assigned id.
  client_id: z.string().nullish(),
});

const getPrBaselines = z.object({
  exercise_ids: z.array(z.unknown()).min(1),
});

module.exports = { createWorkout, getPrBaselines };
