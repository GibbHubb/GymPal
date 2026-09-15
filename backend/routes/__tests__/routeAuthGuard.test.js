// G44 criterion 5 — "every route in backend/routes/*.js that takes a :user_id / :userId /
// :clientId param is covered by the new middleware — asserted by a test that enumerates the
// router stack, so a future route cannot silently opt out."
//
// Placeholder env BEFORE requiring any route file, since requiring a route file pulls in its
// controller -> models/db (a lazy pg Pool — constructing it must never mean connecting) and,
// for usersRoutes, jsonwebtoken helpers that read JWT_SECRET at call time.
process.env.JWT_SECRET ||= 'test-jwt-secret-g44';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g44';
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:59999/gympal_test_never_connects';

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const express = require('express');
const { requireSelfOrLinkedTrainer, requireTrainer } = require('../../middleware/authorize.js');

// --- Identify "is this handler one of authorize.js's exports?" -------------------------
//
// requireTrainer is exported directly, so a route using it holds the EXACT SAME function
// reference — identity by `===` works.
//
// requireSelfOrLinkedTrainer(paramName) is a FACTORY: every call returns a brand-new closure,
// so two routes that both correctly call `requireSelfOrLinkedTrainer('user_id')` do NOT hold
// the same object, and there is no exported symbol to compare against by reference. What IS
// constant is the closure's SOURCE TEXT: the body reads `req.params[paramName]` (the
// parameter *name*, not an interpolated literal), so `fn.toString()` is byte-identical no
// matter what paramName was passed at call time. We derive that fingerprint by calling the
// real factory from authorize.js (never hand-typed/guessed), then compare every route
// handler's source text against it. This is what the task means by "identify it by function
// identity/name exported from authorize.js" without needing to touch authorize.js itself.
const SELF_OR_LINKED_FINGERPRINT = requireSelfOrLinkedTrainer('__fingerprint_probe__').toString();

function isRequireSelfOrLinkedTrainer(fn) {
  return typeof fn === 'function' && fn.toString() === SELF_OR_LINKED_FINGERPRINT;
}
function isRequireTrainer(fn) {
  return fn === requireTrainer;
}
function isAuthorizeGuard(fn) {
  return isRequireSelfOrLinkedTrainer(fn) || isRequireTrainer(fn);
}

// --- Enumerate an Express Router's registered routes ------------------------------------
function enumerateRoutes(router) {
  return router.stack
    .filter((layer) => layer.route) // skip plain app.use() middleware layers
    .map((layer) => {
      const route = layer.route;
      return {
        path: route.path,
        methods: Object.keys(route.methods),
        handlers: route.stack.map((l) => l.handle),
      };
    });
}

const ID_PARAM_RE = /:(user_id|userId|clientId)\b/;

// Tracked gaps: an unguarded id route is allowed ONLY with a recorded reason and a ticket.
// Each entry is also asserted to still be unguarded, so a fix forces its removal here.
const TRACKED_UNGUARDED = {
  // G55 — getUserProfile ignores req.params.user_id and always returns the CALLER's profile,
  // so this is not a live IDOR today; but api.js fetchUserById calls it expecting target-id
  // semantics (client viewing their trainer), which needs a policy decision before a guard.
  'usersRoutes.js GET /:user_id': 'G55',
};

function pathHasIdParam(routePath) {
  const p = Array.isArray(routePath) ? routePath.join(',') : String(routePath);
  return ID_PARAM_RE.test(p);
}

// --- Positive controls: prove the checker itself actually discriminates -----------------
describe('G44 criterion 5 — checker sanity (positive controls)', () => {
  it('flags a throwaway route with a :user_id param and NO authorize middleware', () => {
    const bad = express.Router();
    bad.get('/:user_id', (req, res) => res.sendStatus(200)); // deliberately unguarded
    const [route] = enumerateRoutes(bad);
    expect(pathHasIdParam(route.path)).toBe(true);
    expect(route.handlers.some(isAuthorizeGuard)).toBe(false);
  });

  it('flags a throwaway route guarded by an UNRELATED middleware of the same shape', () => {
    const bad = express.Router();
    // Same arity/shape as a real guard, but not from authorize.js — must not be mistaken
    // for it just because it "looks like" middleware.
    const impostor = async (req, res, next) => next();
    bad.get('/:userId', impostor, (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(bad);
    expect(route.handlers.some(isAuthorizeGuard)).toBe(false);
  });

  it('does NOT flag a route correctly guarded by requireSelfOrLinkedTrainer', () => {
    const good = express.Router();
    good.get('/:user_id', requireSelfOrLinkedTrainer('user_id'), (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(good);
    expect(pathHasIdParam(route.path)).toBe(true);
    expect(route.handlers.some(isAuthorizeGuard)).toBe(true);
  });

  it('does NOT flag a route correctly guarded by requireTrainer', () => {
    const good = express.Router();
    good.get('/:clientId', requireTrainer, (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(good);
    expect(route.handlers.some(isAuthorizeGuard)).toBe(true);
  });

  it('ignores a route whose path has no id param at all (not in scope of criterion 5)', () => {
    const fine = express.Router();
    fine.get('/:id', (req, res) => res.sendStatus(200)); // e.g. an exercise id, not a user id
    const [route] = enumerateRoutes(fine);
    expect(pathHasIdParam(route.path)).toBe(false);
  });
});

// --- The real check, against every real route file --------------------------------------
const ROUTES_DIR = path.join(__dirname, '..');
const routeFiles = fs
  .readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith('.js') && fs.statSync(path.join(ROUTES_DIR, f)).isFile());

describe('G44 criterion 5 — every backend/routes/*.js file', () => {
  it('found route files to enumerate (sanity — a passing suite with 0 files checked proves nothing)', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  for (const file of routeFiles) {
    const router = require(path.join(ROUTES_DIR, file));
    const routes = enumerateRoutes(router);
    const idParamRoutes = routes.filter((r) => pathHasIdParam(r.path));

    // Only open a describe() block when there is something to assert — an empty describe
    // (a route file with no :user_id/:userId/:clientId route at all) is not a vitest error,
    // it's just out of scope, so skip it rather than emitting a vacuous suite.
    if (idParamRoutes.length === 0) continue;

    describe(file, () => {
      for (const route of idParamRoutes) {
        const label = `${route.methods.join('/').toUpperCase()} ${route.path}`;
        const ticket = TRACKED_UNGUARDED[`${file} ${label}`];
        if (ticket) {
          it(`${label} is a TRACKED gap (${ticket}) and is still unguarded — remove the entry once fixed`, () => {
            expect(route.handlers.some(isAuthorizeGuard)).toBe(false);
          });
          continue;
        }
        it(`${label} has an authorize.js guard in its handler chain`, () => {
          const names = route.handlers.map((h) => h.name || '<anonymous>').join(', ');
          expect(
            route.handlers.some(isAuthorizeGuard),
            `${file} ${label}: no requireSelfOrLinkedTrainer/requireTrainer in chain [${names}]`,
          ).toBe(true);
        });
      }
    });
  }
});
