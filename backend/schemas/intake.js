// G49 — schema for POST /api/intake. IntakeScreen.js sends most fields as 1-5 scale scores
// (see the field labels at screens/Client/IntakeScreen.js:107-119) plus a real height_cm.
// Bounds are loose (0-10, not a tight 1-5) — the goal here is to catch a non-numeric value
// ("banana"), not to encode the UI's current scale into the API contract.
const { z } = require('zod');

const scaleScore = z.coerce.number().min(0).max(10).nullish();

const addIntakeData = z.object({
  client_name: z.string().trim().min(1),
  sex: z.coerce.number(),
  age: z.coerce.number(),
  fat_percentage: scaleScore,
  height_cm: z.coerce.number().positive().nullish(),
  weight_category: scaleScore,
  bmi: z.coerce.number().nullish(),
  ffmi: scaleScore,
  athleticism_score: scaleScore,
  movement_shoulder: scaleScore,
  movement_hips: scaleScore,
  movement_ankles: scaleScore,
  movement_thoracic: scaleScore,
  genetics: scaleScore,
});

module.exports = { addIntakeData };
