// G44 — one place the "who may read this user's data" rule lives, applied in the route
// files so the boundary is auditable by reading routes/ alone.
//
// Before this, four authenticated-but-unauthorized reads existed: intake, lifestyle-data,
// the users list, and body-metrics (which checked `role in (pt, masterPt, trainer)` — true
// for ANY trainer, not one linked to THIS client). Any signed-in user could read any other
// user's intake, stress/sleep/soreness, and body composition by changing the id in the URL.
//
// The correct rule already exists in the codebase (programsController "G12"): a trainer may
// act on a client only via a `trainer_clients` row with status = 'active'. This centralises it.
const db = require('../models/db');

// G56 — marks every guard this module produces. The route-coverage test identifies guards by
// this tag rather than by source text, which could not tell which param a guard reads.
const AUTHORIZE_GUARD = Symbol.for('gympal.authorizeGuard');

// req.user is set by authenticateToken (the decoded JWT: { user_id, role, ... }).

// The one DB touch, behind a swappable seam. A test overrides `deps.hasActiveLink`
// rather than mocking the whole db module (CJS require interop makes that brittle).
const deps = {
  async hasActiveLink(trainerId, clientId) {
    const { rows } = await db.query(
      `SELECT 1 FROM trainer_clients
        WHERE trainer_id = $1 AND client_id = $2 AND status = 'active'
        LIMIT 1`,
      [trainerId, clientId],
    );
    return Boolean(rows[0]);
  },
};

function requesterId(req) {
  return req.user && req.user.user_id;
}

function isTrainerRole(role) {
  return role === 'pt' || role === 'masterPt' || role === 'trainer';
}

/**
 * Allow the request when the caller is the target user themselves, OR a trainer with an
 * ACTIVE trainer_clients link to that target. `paramName` is the route param holding the
 * target user id (e.g. 'user_id' or 'userId').
 *
 * Returns 403 whether or not the target exists, so the answer does not confirm that a given
 * user id exists to someone with no relationship to it.
 */
function requireSelfOrLinkedTrainer(paramName) {
  const guard = async (req, res, next) => {
    const me = requesterId(req);
    if (!me) {
      return res.status(401).json({ message: 'Not authenticated.' });
    }
    const raw = req.params[paramName];
    const targetId = Number(raw);
    if (!Number.isInteger(targetId)) {
      return res.status(400).json({ message: 'Invalid user ID: ID must be a number.' });
    }

    // The caller reading their own data is always allowed.
    if (targetId === Number(me)) {
      return next();
    }

    // Otherwise the caller must be a trainer ACTIVELY linked to this client. Role alone is
    // not enough — that was the body-metrics defect.
    if (!isTrainerRole(req.user.role)) {
      return res.status(403).json({ message: 'Not authorised to view this user’s data.' });
    }
    try {
      const linked = await deps.hasActiveLink(Number(me), targetId);
      if (!linked) {
        return res.status(403).json({ message: 'Not authorised to view this user’s data.' });
      }
      return next();
    } catch (err) {
      console.error('authorize.requireSelfOrLinkedTrainer:', err.message);
      return res.status(500).json({ message: 'Internal server error' });
    }
  };
  // G56 — tag the guard with the param it reads, so the route test can check it matches the
  // route (a guard on the wrong param 400s every caller, the data's owner included).
  guard[AUTHORIZE_GUARD] = { param: paramName };
  return guard;
}

/** Allow only trainer-role callers (for endpoints that list or aggregate across clients). */
function requireTrainer(req, res, next) {
  if (!requesterId(req)) {
    return res.status(401).json({ message: 'Not authenticated.' });
  }
  if (!isTrainerRole(req.user.role)) {
    return res.status(403).json({ message: 'Trainer role required.' });
  }
  return next();
}

requireTrainer[AUTHORIZE_GUARD] = { param: null };

module.exports = { requireSelfOrLinkedTrainer, requireTrainer, isTrainerRole, deps, AUTHORIZE_GUARD };
