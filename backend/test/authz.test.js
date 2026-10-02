// G50 — the G44 authorization matrix, as request-level tests against the real app and a
// real Postgres (see fixtures.js for why not a mock).
//
// For each per-user read route: the owner and an ACTIVELY linked trainer get 200 with the
// owner's data; another client, an unlinked trainer, and a trainer whose link is ARCHIVED
// all get 403. The archived case is the one a role-only check (the body-metrics defect)
// would wrongly allow.
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { TEST_DB_URL, USERS, resetAndSeed } = require('./fixtures');

const HAVE_DB = Boolean(TEST_DB_URL);
if (!HAVE_DB && process.env.CI) {
  // In CI a missing database must be a red run, never a quietly skipped suite.
  throw new Error('TEST_DATABASE_URL is not set in CI; the authorization suite cannot run.');
}
if (!HAVE_DB) {
  console.warn('[G50] TEST_DATABASE_URL not set: skipping the DB-backed authorization suite.');
}

// Env BEFORE the app is required: models/db.js builds its pool from DATABASE_URL at load,
// and app.js runs config.validate() on import.
if (HAVE_DB) process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET ||= 'test-jwt-secret-g50';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g50';

let request;
let app;
let jwt;

function tokenFor(user) {
  return jwt.sign({ user_id: user.user_id, role: user.role }, process.env.JWT_SECRET,
    { expiresIn: '5m' });
}

function get(path, as) {
  const r = request(app).get(path);
  return as ? r.set('Authorization', `Bearer ${tokenFor(as)}`) : r;
}

describe.skipIf(!HAVE_DB)('G44 authorization matrix (real app, real Postgres)', () => {
  beforeAll(async () => {
    await resetAndSeed();
    request = require('supertest');
    jwt = require('jsonwebtoken');
    ({ app } = require('../app'));
  }, 60000); // schema reset + loading the whole app; 10s is not enough on a cold disk

  const { clientA, clientB, trainerA, trainerB } = USERS;

  // Each route reads clientA's data. `owns` checks the 200 body really is clientA's.
  const ROUTES = [
    { path: `/api/intake/${clientA.user_id}`,
      owns: (b) => b.user_id === clientA.user_id },
    { path: `/api/lifestyle-data/${clientA.user_id}`,
      owns: (b) => Array.isArray(b) && b.length > 0 && b.every((r) => r.user_id === clientA.user_id) },
    { path: `/api/body-metrics/${clientA.user_id}`,
      owns: (b) => Array.isArray(b) && b.length > 0 && b.every((r) => r.user_id === clientA.user_id) },
    { path: `/api/users/${clientA.user_id}`,
      owns: (b) => b.user_id === clientA.user_id && b.username === clientA.username },
  ];

  for (const route of ROUTES) {
    describe(route.path, () => {
      it('200 for the owner, with the owner\'s data', async () => {
        const res = await get(route.path, clientA);
        expect(res.status).toBe(200);
        expect(route.owns(res.body)).toBe(true);
      });

      it('200 for an ACTIVELY linked trainer', async () => {
        const res = await get(route.path, trainerA);
        expect(res.status).toBe(200);
        expect(route.owns(res.body)).toBe(true);
      });

      it('403 for another client', async () => {
        const res = await get(route.path, clientB);
        expect(res.status).toBe(403);
      });

      it('403 for a trainer with no link', async () => {
        const res = await get(route.path, trainerB);
        expect(res.status).toBe(403);
      });

      it('401 with no token', async () => {
        const res = await get(route.path, null);
        expect(res.status).toBe(401);
      });
    });
  }

  // The archived link: trainerA WAS clientB's trainer. Role alone would let this through.
  for (const path of [
    `/api/intake/${clientB.user_id}`,
    `/api/lifestyle-data/${clientB.user_id}`,
    `/api/body-metrics/${clientB.user_id}`,
    `/api/users/${clientB.user_id}`,
  ]) {
    it(`403 for a trainer whose link is ARCHIVED: ${path}`, async () => {
      const res = await get(path, trainerA);
      expect(res.status).toBe(403);
    });
  }

  describe('GET /api/users/ (the list)', () => {
    const ids = (body) => body.map((u) => u.user_id).sort((a, b) => a - b);

    it('a client sees only themselves', async () => {
      const res = await get('/api/users/', clientA);
      expect(res.status).toBe(200);
      expect(ids(res.body)).toEqual([clientA.user_id]);
    });

    it('a trainer sees themselves and ACTIVE clients only (not the archived one)', async () => {
      const res = await get('/api/users/', trainerA);
      expect(res.status).toBe(200);
      expect(ids(res.body)).toEqual([clientA.user_id, trainerA.user_id]);
    });

    it('an unlinked trainer sees only themselves', async () => {
      const res = await get('/api/users/', trainerB);
      expect(res.status).toBe(200);
      expect(ids(res.body)).toEqual([trainerB.user_id]);
    });

    it('401 with no token', async () => {
      const res = await get('/api/users/', null);
      expect(res.status).toBe(401);
    });
  });

  describe('G44 criterion 4 on the full app: group-workout reads need a token', () => {
    for (const path of ['/api/group-workouts/last10', '/api/group-workouts/most-used']) {
      it(`${path} -> 401 unauthenticated`, async () => {
        const res = await get(path, null);
        expect(res.status).toBe(401);
      });
    }
  });

  it('control: /api/health reaches the real database', async () => {
    const res = await get('/api/health', null);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});
