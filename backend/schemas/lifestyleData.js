// G49 — schema for POST /api/lifestyle-data. This is the endpoint named directly in the
// PLAN: `{ stress: "banana" }` reached the pg driver and came back as a 500 before this.
// LifestyleScreen.js's current UI is a 1-3 selector for stress/sleep/soreness (renderSelector,
// screens/Client/LifestyleScreen.js:91), but the schema uses a looser 0-10 bound rather than
// baking in that exact UI choice — same reasoning as intake.js's scaleScore.
//
// `calories` has no current frontend caller (grepped) but the controller still accepts and
// inserts it, so it stays in the schema as optional rather than being silently dropped.
const { z } = require('zod');

const scale = z.coerce.number().min(0).max(10).nullish();

const addLifestyleData = z.object({
  stress: scale,
  sleep: scale,
  soreness: scale,
  calories: z.coerce.number().min(0).max(20000).nullish(),
  weight: z.coerce.number().gt(0).lt(700).nullish(),
});

module.exports = { addLifestyleData };
