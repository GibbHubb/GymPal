// G49 — schemas for POST /api/exercises and PUT /api/exercises/:id.
const { z } = require('zod');

const base = {
  name: z.string().trim().min(1),
  muscle_group: z.string().trim().min(1),
  difficulty: z.string().trim().min(1),
  equipment: z.string().nullish(),
  video_url: z.string().nullish(),
  // Controller clamps this to 15-900 itself (Math.max/min) — the schema only needs to keep
  // out non-numbers so that clamp doesn't see NaN.
  default_rest_seconds: z.coerce.number().nullish(),
  is_global: z.boolean().nullish(),
};

const createExercise = z.object(base);

// Same required core fields as create — updateExercise's controller 400s on a missing
// name/muscle_group/difficulty exactly like create does, it's not a true partial update
// despite the COALESCE on the optional columns.
const updateExercise = z.object(base);

module.exports = { createExercise, updateExercise };
