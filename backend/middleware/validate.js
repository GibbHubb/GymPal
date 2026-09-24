// G49 — one place the "what may this request body contain" rule lives, applied in the
// route files (mirroring G44's authorize.js) so the boundary is auditable by reading
// routes/ alone: read the route, see the guard, see the schema.
//
// Every schema is `z.object({...}).strip()` (Zod's default) rather than `.strict()` — see
// PLAN §8: an unknown key (e.g. an older client sending a field a newer one dropped, or an
// offline-queued payload) is silently dropped, not rejected. That is a deliberate asymmetry
// with authorize.js: a validation 400 cannot be worked around by the caller, but an
// over-strict schema turns a working mobile flow into a permanent failure the client can't
// retry its way out of. See workoutsController.js's G36 comment for exactly this failure
// mode already having happened once, from a hard `name` requirement.
const VALIDATE_SCHEMA = Symbol.for('gympal.validateSchema');

/**
 * Express middleware factory: parses req.body against `schema` and replaces req.body with
 * the parsed (coerced/defaulted/unknown-key-stripped) result. On failure, responds 400 with
 * the offending field path(s) named — never a raw driver error.
 */
function validate(schema) {
  const mw = (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const issues = result.error.issues.map((issue) => ({
        field: issue.path.join('.') || '(body)',
        message: issue.message,
      }));
      return res.status(400).json({
        message: `Invalid request body: ${issues.map((i) => `${i.field} — ${i.message}`).join('; ')}`,
        errors: issues,
      });
    }
    req.body = result.data;
    return next();
  };
  // G49 — tag the middleware with the schema it enforces, so the route-coverage test can
  // find it by identity rather than by guessing from source text (see G56's authorize.js
  // lesson: text-matching a factory's output does not tell you what it was configured with).
  mw[VALIDATE_SCHEMA] = { schema };
  return mw;
}

module.exports = { validate, VALIDATE_SCHEMA };
