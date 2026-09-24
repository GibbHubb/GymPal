// G49 criterion 1 — "every POST/PUT/PATCH route across all 11 route files has a schema
// attached — asserted by a test that enumerates the router stack and fails on an
// unschema'd write route." Mirrors G44's routeAuthGuard.test.js (same enumeration
// technique, same "tag the middleware, don't text-match it" lesson from G56).
//
// Placeholder env BEFORE requiring any route file — see routeAuthGuard.test.js for why.
process.env.JWT_SECRET ||= 'test-jwt-secret-g49';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g49';
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:59999/gympal_test_never_connects';

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const express = require('express');
const { validate, VALIDATE_SCHEMA } = require('../../middleware/validate.js');

function isValidateGuard(fn) {
  return typeof fn === 'function' && Boolean(fn[VALIDATE_SCHEMA]);
}

// --- Enumerate an Express Router's registered routes, including nested routers ----------
// Same walk as routeAuthGuard.test.js.
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

const WRITE_METHODS = ['post', 'put', 'patch'];

function isWriteRoute(route) {
  return route.methods.some((m) => WRITE_METHODS.includes(m));
}

// Tracked gaps: a write route with no schema is allowed ONLY with a recorded reason.
// Each entry is also asserted to still be unschema'd, so attaching a schema forces its
// removal here.
const TRACKED_UNSCHEMAD = {};

// --- Positive controls: prove the checker itself actually discriminates -----------------
describe('G49 criterion 1 — checker sanity (positive controls)', () => {
  const { z } = require('zod');

  it('flags a throwaway POST route with NO validate() in the chain', () => {
    const bad = express.Router();
    bad.post('/', (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(bad);
    expect(isWriteRoute(route)).toBe(true);
    expect(route.handlers.some(isValidateGuard)).toBe(false);
  });

  it('flags a throwaway route guarded by an UNRELATED middleware of the same shape', () => {
    const bad = express.Router();
    const impostor = (req, res, next) => next(); // same arity, not from validate.js
    bad.post('/', impostor, (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(bad);
    expect(route.handlers.some(isValidateGuard)).toBe(false);
  });

  it('does NOT flag a route correctly guarded by validate(schema)', () => {
    const good = express.Router();
    good.post('/', validate(z.object({ name: z.string() })), (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(good);
    expect(route.handlers.some(isValidateGuard)).toBe(true);
  });

  it('ignores a GET route (not in scope of criterion 1)', () => {
    const fine = express.Router();
    fine.get('/', (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(fine);
    expect(isWriteRoute(route)).toBe(false);
  });

  it('ignores a DELETE route (not in scope — no request body to validate)', () => {
    const fine = express.Router();
    fine.delete('/:id', (req, res) => res.sendStatus(200));
    const [route] = enumerateRoutes(fine);
    expect(isWriteRoute(route)).toBe(false);
  });

  it('finds an unschema\'d write route inside a NESTED router', () => {
    const inner = express.Router();
    inner.post('/', (req, res) => res.sendStatus(200));
    const outer = express.Router();
    outer.use('/nested', inner);
    const routes = enumerateRoutes(outer).filter(isWriteRoute);
    expect(routes).toHaveLength(1);
    expect(routes[0].handlers.some(isValidateGuard)).toBe(false);
  });
});

// --- The real check, against every real route file --------------------------------------
const ROUTES_DIR = path.join(__dirname, '..');
const routeFiles = fs
  .readdirSync(ROUTES_DIR)
  .filter((f) => f.endsWith('.js') && fs.statSync(path.join(ROUTES_DIR, f)).isFile());

describe('G49 criterion 1 — every backend/routes/*.js file', () => {
  it('found route files to enumerate (sanity — a passing suite with 0 files checked proves nothing)', () => {
    expect(routeFiles.length).toBeGreaterThan(0);
  });

  it('found at least one write (POST/PUT/PATCH) route across all route files (sanity)', () => {
    let total = 0;
    for (const file of routeFiles) {
      const router = require(path.join(ROUTES_DIR, file));
      total += enumerateRoutes(router).filter(isWriteRoute).length;
    }
    expect(total).toBeGreaterThan(0);
  });

  for (const file of routeFiles) {
    const router = require(path.join(ROUTES_DIR, file));
    const writeRoutes = enumerateRoutes(router).filter(isWriteRoute);

    if (writeRoutes.length === 0) continue;

    describe(file, () => {
      for (const route of writeRoutes) {
        const label = `${route.methods.join('/').toUpperCase()} ${route.path}`;
        const ticket = TRACKED_UNSCHEMAD[`${file} ${label}`];
        if (ticket) {
          it(`${label} is a TRACKED gap (${ticket}) and is still unschema'd — remove the entry once fixed`, () => {
            expect(route.handlers.some(isValidateGuard)).toBe(false);
          });
          continue;
        }
        it(`${label} has a validate(schema) in its handler chain`, () => {
          const names = route.handlers.map((h) => h.name || '<anonymous>').join(', ');
          expect(
            route.handlers.some(isValidateGuard),
            `${file} ${label}: no validate(schema) middleware in chain [${names}]`,
          ).toBe(true);
        });
      }
    });
  }
});
