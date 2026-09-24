// G49 — schemas for the two trainer-clients write routes.
const { z } = require('zod');

const addClient = z.object({
  username: z.string().trim().min(1),
  is_primary: z.boolean().nullish(),
});

const updateLink = z.object({
  status: z.enum(['active', 'archived']).nullish(),
  is_primary: z.boolean().nullish(),
});

module.exports = { addClient, updateLink };
