// G59 — the idempotency lookup on POST /api/workouts returns only the CALLER's workout.
//
// Before: `SELECT * FROM Workouts WHERE client_id = $1` with no owner filter, so anyone who
// sent another user's client_id got that user's workout (name, notes, date) back in a 200.
// Real app, real Postgres (see fixtures.js), like authz.test.js.
import { describe, it, expect, beforeAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { TEST_DB_URL, USERS, resetAndSeed } = require('./fixtures');

const HAVE_DB = Boolean(TEST_DB_URL);
if (!HAVE_DB && process.env.CI) {
  throw new Error('TEST_DATABASE_URL is not set in CI; the G59 suite cannot run.');
}
if (HAVE_DB) process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET ||= 'test-jwt-secret-g50';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g50';

let request;
let app;
let jwt;

const token = (u) => jwt.sign({ user_id: u.user_id, role: u.role }, process.env.JWT_SECRET, { expiresIn: '5m' });
const post = (as, body) =>
  request(app).post('/api/workouts').set('Authorization', `Bearer ${token(as)}`).send(body);
const workout = (clientId, notes) => ({
  name: 'Legs',
  notes,
  client_id: clientId,
  exercises: [{ exercise_id: 1, sets: [{ weight: 100, reps: 5, rir: 2 }] }],
});

describe.skipIf(!HAVE_DB)('G59 — client_id idempotency is per user', () => {
  beforeAll(async () => {
    await resetAndSeed();
    request = require('supertest');
    jwt = require('jsonwebtoken');
    ({ app } = require('../app'));
  }, 60000);

  const { clientA, clientB } = USERS;
  const ID = '5d0b7c1e-2f3a-4b5c-8d9e-0a1b2c3d4e5f';

  it('the owner replaying their own client_id gets their workout back (200), not a second one', async () => {
    const first = await post(clientA, workout(ID, 'A private note'));
    expect(first.status).toBe(201);
    const again = await post(clientA, workout(ID, 'A private note'));
    expect(again.status).toBe(200);
    expect(again.body.workout.workout_id).toBe(first.body.workout.workout_id);
  });

  it("another user sending that client_id does NOT get the owner's workout", async () => {
    const res = await post(clientB, workout(ID, 'B'));
    expect(res.status).not.toBe(200);
    expect(JSON.stringify(res.body)).not.toContain('A private note');
  });
});
