const { z } = require('zod');

const loginUser = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

// G49 criterion 4 (unknown keys stripped) — deliberately does NOT list `role`. Before this,
// createUser destructured `role` straight from req.body and inserted `role || 'client'`: any
// caller of the PUBLIC /register endpoint could self-assign `role: "masterPt"`. The schema's
// default strip mode (see validate.js) now drops that key before the controller ever sees
// it, so `role` is always undefined there and the `|| 'client'` fallback always wins — no
// controller change needed to close it, but it is exactly the case criterion 4 asks to be
// tested against a real endpoint. See LESSONS.md follow-up note in the completion report:
// this was found as a byproduct of validation work, not chased down under G45 (authz scope).
// 🔴 `role` IS accepted here again — but it is NOT honoured unless the caller
// proves they are a trainer. Stripping it outright (the first fix for the
// self-assign-admin hole) closed the hole and broke a real flow with it: the
// trainer's "add a teammate" dialog (ClientOverview.js) posts role:'trainer' to
// this same public endpoint, and silently got a CLIENT account back, with
// nothing in the UI to say so. The controller now decides: a valid trainer /
// masterPt token may set a role, everyone else gets 'client' regardless of what
// they send (cross-file review, 2026-09-24).
const createUser = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
  role: z.enum(['client', 'trainer', 'masterPt']).optional(),
});

const refreshToken = z.object({
  refreshToken: z.string().min(1),
});

const savePushToken = z.object({
  expo_push_token: z.string().min(1),
});

module.exports = { loginUser, createUser, refreshToken, savePushToken };
