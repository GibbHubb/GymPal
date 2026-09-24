// G49 — schema for POST /api/workout-templates. `exercises` is stored as an opaque JSONB
// blob (`JSON.stringify(exercises)`) — the controller never reads into its shape, so the
// schema only enforces "non-empty array", not a per-item shape (there is no established one).
const { z } = require('zod');

const createTemplate = z.object({
  name: z.string().trim().min(1),
  exercises: z.array(z.unknown()).min(1),
});

module.exports = { createTemplate };
