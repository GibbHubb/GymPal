// G49 — schema for POST /api/body-metrics. Mirrors the hand-written checks that already
// existed in bodyMetricsController.js (createBodyMetric) — those were the strictest, most
// correct ad-hoc validation in the codebase, so this schema is the "known-good" baseline
// the rest of G49 is checked against (plan step 3).
const { z } = require('zod');

const createBodyMetric = z.object({
  weight: z.coerce.number().gt(0).lt(700),
  body_fat_pct: z.coerce.number().min(0).max(100).nullish(),
  notes: z.string().max(2000).nullish(),
  // Left as a raw string (not coerced to a Date object) — the controller passes it straight
  // through to a `::date` cast in the query, and pg's own serialization of a JS Date differs
  // from passing the original string. Not worth the behavioural risk for an optional field.
  logged_at: z.string().nullish(),
});

module.exports = { createBodyMetric };
