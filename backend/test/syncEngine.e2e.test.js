// G48 criterion 5 — the APP's offline sync engine (../../utils/syncEngine.js) against the REAL
// backend and a real Postgres: five failed attempts, then a success, and the workout is in
// the database exactly once with the queue empty.
//
// A gate in front of the app answers the first N POST /api/workouts with 500 (a deploy, an
// outage), then lets requests through to the real handler.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { randomUUID } from 'node:crypto';
import AsyncStorage, { store } from '../../utils/__tests__/asyncStorageMock.js';
import * as Q from '../../utils/syncQueue.js';
import * as E from '../../utils/syncEngine.js';
import { syncQueued } from '../../utils/sessionSync.js';

const require = createRequire(import.meta.url);
const { TEST_DB_URL, USERS, resetAndSeed } = require('./fixtures');

const HAVE_DB = Boolean(TEST_DB_URL);
if (!HAVE_DB && process.env.CI) {
  throw new Error('TEST_DATABASE_URL is not set in CI; the sync e2e suite cannot run.');
}
// Process-wide env: safe under vitest's per-file isolation (see authRefresh.e2e.test.js).
if (HAVE_DB) process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET ||= 'test-jwt-secret-g48';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g48';

describe.skipIf(!HAVE_DB)('G48 sync engine against the real backend', () => {
  let server;
  let base;
  let db;
  let token;
  let failNext = 0;
  const gateLog = [];

  beforeAll(async () => {
    await resetAndSeed();
    const express = require('express');
    const jwt = require('jsonwebtoken');
    const { Client } = require('pg');
    const { app } = require('../app');
    const outer = express();
    outer.use((req, res, next) => {
      if (req.method === 'POST' && req.originalUrl === '/api/workouts' && failNext > 0) {
        failNext -= 1;
        gateLog.push('500');
        return res.status(500).json({ message: 'simulated outage' });
      }
      res.on('finish', () => gateLog.push(String(res.statusCode)));
      return next();
    });
    outer.use(app);
    await new Promise((resolve) => {
      server = outer.listen(0, '127.0.0.1', () => {
        base = `http://127.0.0.1:${server.address().port}`;
        resolve();
      });
    });
    db = new Client({ connectionString: TEST_DB_URL });
    await db.connect();
    token = jwt.sign({ user_id: USERS.clientA.user_id, role: 'client' }, process.env.JWT_SECRET,
      { expiresIn: '5m' });
  }, 60000);

  afterAll(async () => {
    if (db) await db.end();
    if (server) await new Promise((r) => server.close(r));
  });

  beforeEach(async () => {
    store.clear();
    gateLog.length = 0;
    await AsyncStorage.setItem('token', token);
  });

  const payload = (clientId) => ({
    name: 'Legs', client_id: clientId,
    exercises: [{ exercise_id: 1, sets: [{ weight: 100, reps: 5, rir: 2 }] }],
  });
  const rowsFor = async (clientId) => (await db.query(
    'SELECT w.user_id, COUNT(we.id)::int AS sets FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id = w.workout_id WHERE w.client_id = $1 GROUP BY w.user_id',
    [clientId])).rows;

  it('5 consecutive failures, then a success: removed from the queue, on the server once', async () => {
    const id = randomUUID();
    await Q.enqueue({ id, type: 'workout_log', payload: payload(id) });
    failNext = 5;

    for (let i = 0; i < E.MAX_ATTEMPTS; i++) await E.runSync(base, token);
    let [item] = await Q.getQueue();
    expect([item.status, item.attempts, item.lastError]).toEqual(['failed', 5, 'HTTP 500']);
    expect(await rowsFor(id)).toEqual([]);

    await E.runSync(base, token); // automatic: a failed item is left for an explicit sync
    expect(gateLog).toEqual(['500', '500', '500', '500', '500']);

    const r = await E.runSyncNow(base, token); // explicit (cold start / login / "Sync now")
    expect(r.synced).toBe(1);
    expect(gateLog.at(-1)).toBe('201');
    expect(await Q.getQueue()).toEqual([]);
    expect(await rowsFor(id)).toEqual([{ user_id: USERS.clientA.user_id, sets: 1 }]);
  });

  it('through syncQueued with an EXPIRED access token: refreshed via the real /users/refresh, then synced', async () => {
    const jwt = require('jsonwebtoken');
    const expired = jwt.sign(
      { user_id: USERS.clientA.user_id, role: 'client', exp: Math.floor(Date.now() / 1000) - 60 },
      process.env.JWT_SECRET);
    const refreshToken = jwt.sign({ user_id: USERS.clientA.user_id, role: 'client' },
      process.env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
    await AsyncStorage.setItem('token', expired);
    await AsyncStorage.setItem('refreshToken', refreshToken);
    const id = randomUUID();
    await Q.enqueue({ id, type: 'workout_log', payload: payload(id) });
    let refreshed = 0;
    const refresh = async () => {
      refreshed += 1;
      const res = await fetch(`${base}/api/users/refresh`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const body = await res.json();
      await AsyncStorage.setItem('token', body.token);
      return body.token;
    };
    const r = await syncQueued(base, refresh, { explicit: true });
    expect(refreshed).toBe(1);
    expect(r.synced).toBe(1);
    expect(gateLog).toEqual(['401', '200', '201']); // workouts 401, refresh 200, workouts 201
    expect(await Q.getQueue()).toEqual([]);
    expect(await rowsFor(id)).toEqual([{ user_id: USERS.clientA.user_id, sets: 1 }]);
  });

  it('a duplicate send of the same client_id is idempotent: still one workout', async () => {
    const id = randomUUID();
    await Q.enqueue({ id, type: 'workout_log', payload: payload(id) });
    await E.runSync(base, token);
    await Q.enqueue({ id, type: 'workout_log', payload: payload(id) }); // e.g. a double tap
    await E.runSync(base, token);
    expect(gateLog).toEqual(['201', '200']);
    expect(await Q.getQueue()).toEqual([]);
    expect(await rowsFor(id)).toHaveLength(1);
  });
});
