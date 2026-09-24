// G49 — schema for PATCH /api/leaderboard/opt-in. Controller already coerces with `!!opt_in`,
// so this mainly documents the contract and rejects a body with no opt_in key at all.
const { z } = require('zod');

const setOptIn = z.object({
  opt_in: z.boolean(),
});

module.exports = { setOptIn };
