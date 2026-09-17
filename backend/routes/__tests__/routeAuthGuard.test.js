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
const { requireSelfOrLinkedTrainer, requireTrainer, AUTHORIZE_GUARD } = require('../../middleware/authorize.js');

// --- Identify "is this handler one of authorize.js's guards?" ---------------------------
//
// G56: this used to compare each handler's SOURCE TEXT against a probe closure. The text is
// identical whatever param name the factory was given, so `requireSelfOrLinkedTrainer('user_id')`
// on a `/:clientId` route passed, while at runtime it 400s every caller, owner included.
// authorize.js now tags every guard with AUTHORIZE_GUARD = { param }, which is both harder to
// fake by accident and tells us which param the guard reads.
function guardInfo(fn) {
  return (typeof fn === 'function' && fn[AUTHORIZE_GUARD]) || null;
}
function isAuthorizeGuard(fn) {
  return guardInfo(fn) !== null;
}

function routeParams(routePath) {
  const p = Array.isArray(routePath) ? routePath.join(',') : String(routePath);
  return [...p.matchAll(/:(\w+)/g)].map((m) => m[1]);
}

/** The guard problem for a route, or null. A guard that reads a param the route does not
 * have is as bad as no guard. */
function guardProblem(route) {
  const guards = route.handlers.map(guardInfo).filter(Boolean);
  if (guards.length === 0) return 'no requireSelfOrLinkedTrainer/requireTrainer in chain';
  const params = routeParams(route.path);
  const wrong = guards.filter((g) => g.param !== null && !params.includes(g.param));
  if (wrong.length === guards.length) {
    return `guard reads :${wrong[0].param}, but the route's params are [${params.join(', ')}]`;
  }
  return null;
}

// --- Enumerate an Express Router's registered routes, including nested routers ----------
// G56: a sub-router mounted with router.use() was invisible to the old top-level walk.
function enumerateRoutes(router, prefix = '') {
  const out = [];
  for (const layer of router.stack) {
    if (layer.route) {
      out.push({
        path: prefix + layer.route.path,
        methods: Object.keys(layer.route.methods),
        handlers: layer.route.stack.map((l) => l.handle),
      });
    } else if (layer.handle && Array.isArray(layer.handle.stack)) {
      out.push(...enumerateRoutes(layer.handle, prefix + '<mounted>'));
    }
  }
  return out;
}

// G56: any param naming a PERSON's id, not only the three exact spellings the first version
// knew. Ids of other things (:id, :workoutId, :linkId, :exerciseId) are out of scope.
const ID_PARAM_RE = /:(\w*user_?id|\w*client_?id|\w*trainer_?id|\w*member_?id)\b/i;

// Tracked gaps: an unguarded id route is allowed ONLY with a recorded reason and a ticket.
// Each entry is also asserted to still be unguarded, so a fix forces its removal here.
// (G55's entry was removed when GET /users/:user_id got its guard.)
const TRACKED_UNGUARDED = {};

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

  it('G56: flags a guard that reads a DIFFERENT param than the route has', () => {
    const bad = express.Router();
    bad.get('/:clientId', requireSelfOrLinkedTrainer('user_id'), (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(bad);
    expect(guardProblem(route)).toMatch(/reads :user_id/);
  });

  it('G56: accepts the same guard on the param it reads (control for the above)', () => {
    const good = express.Router();
    good.get('/:clientId', requireSelfOrLinkedTrainer('clientId'), (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(good);
    expect(guardProblem(route)).toBeNull();
  });

  it('G56: an unguarded :client_id / :trainerId route is in scope, not ignored', () => {
    expect(pathHasIdParam('/:client_id')).toBe(true);
    expect(pathHasIdParam('/stats/:trainerId')).toBe(true);
    expect(pathHasIdParam('/:workoutId')).toBe(false);
    expect(pathHasIdParam('/:linkId')).toBe(false);
  });

  it('G56: finds an unguarded id route inside a NESTED router', () => {
    const inner = express.Router();
    inner.get('/:user_id', (req, res) => res.sendStatus(200));
    const outer = express.Router();
    outer.use('/nested', inner);
    const routes = enumerateRoutes(outer).filter((r) => pathHasIdParam(r.path));
    expect(routes).toHaveLength(1);
    expect(guardProblem(routes[0])).toMatch(/no requireSelfOrLinkedTrainer/);
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
        it(`${label} has an authorize.js guard that reads its own param`, () => {
          const names = route.handlers.map((h) => h.name || '<anonymous>').join(', ');
          const problem = guardProblem(route);
          expect(problem, `${file} ${label}: ${problem} [${names}]`).toBeNull();
        });
      }
    });
  }
});
