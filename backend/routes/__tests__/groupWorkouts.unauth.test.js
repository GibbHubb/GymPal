// G44 criterion 4 — /api/group-workouts/last10 and /most-used were registered WITHOUT
// authenticateToken while every sibling route on the same router had it (see
// groupWorkoutsRoutes.js history). This mounts the REAL router (not a stub) on a throwaway
// express app and proves both routes now 401 a request with no Authorization header.
//
// No supertest in this repo (checked package.json) — per the task brief, use plain
// node `http`/`fetch` against `app.listen(0)` instead of adding a dependency.
//
// Placeholder env BEFORE requiring anything that pulls in controllers -> models/db (a lazy
// pg Pool that must never be asked to connect here) or usersController's JWT helpers.
process.env.JWT_SECRET ||= 'test-jwt-secret-g44';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g44';
process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:59999/gympal_test_never_connects';

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let server;
let baseUrl;

beforeAll(() => {
  const express = require('express');
  const groupWorkoutsRouter = require('../groupWorkoutsRoutes');

  const app = express();
  app.use('/api/group-workouts', groupWorkoutsRouter);

  return new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

describe('G44 criterion 4 — group-workouts routes require auth', () => {
  it('GET /api/group-workouts/last10 with NO Authorization header -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/group-workouts/last10`);
    expect(res.status).toBe(401);
  });

  it('GET /api/group-workouts/most-used with NO Authorization header -> 401', async () => {
    const res = await fetch(`${baseUrl}/api/group-workouts/most-used`);
    expect(res.status).toBe(401);
  });

  // Control: a sibling route on the SAME router that was never broken should also 401,
  // proving the 401s above come from real middleware wiring and not from e.g. the app
  // having no matching route at all (which would 404, not 401).
  it('GET /api/group-workouts/level with NO Authorization header -> 401 (control)', async () => {
    const res = await fetch(`${baseUrl}/api/group-workouts/level`);
    expect(res.status).toBe(401);
  });

  // Negative control: an unmounted path 404s rather than 401 — confirms the 401s above are
  // not just "everything returns 401" on this app.
  it('GET /api/group-workouts/does-not-exist -> 404, not 401 (sanity control)', async () => {
    const res = await fetch(`${baseUrl}/api/group-workouts/does-not-exist/deeper`);
    expect(res.status).not.toBe(401);
  });
});
