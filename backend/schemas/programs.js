// G49 — schemas for the three program-builder write routes.
const { z } = require('zod');

const createProgram = z.object({
  name: z.string().trim().min(1),
  total_weeks: z.coerce.number().int(),
  description: z.string().nullish(),
});

// week_number's UPPER bound depends on program.total_weeks, which is only known after a DB
// lookup inside the controller — that check stays there. The schema only guarantees these
// are integers so the controller's own `week_number > program.total_weeks` comparison isn't
// comparing a number to NaN or a string.
const upsertProgramDay = z.object({
  week_number: z.coerce.number().int(),
  day_of_week: z.coerce.number().int().min(0).max(6),
  template_id: z.coerce.number().int().nullish(),
  notes: z.string().nullish(),
});

const assignProgram = z.object({
  client_id: z.coerce.number().int(),
  start_date: z.string().min(1),
});

module.exports = { createProgram, upsertProgramDay, assignProgram };
