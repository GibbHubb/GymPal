// G47 — the app's refresh interceptor (utils/authRefresh.js) driving the REAL backend.
//
// The server logs every request it receives, so the assertions are on the sequence the
// server actually saw (401 -> /users/refresh -> original -> 200), not on what the client
// believes it sent. Access tokens are issued by the real login/refresh code with a 2-second
// lifetime, so "survives several access-token lifetimes" runs in seconds.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'module';
import { installAuthRefresh, SessionExpiredError } from '../../utils/authRefresh.js';

const require = createRequire(import.meta.url);
const { TEST_DB_URL, USERS, FIXTURE_PASSWORD, resetAndSeed } = require('./fixtures');

const HAVE_DB = Boolean(TEST_DB_URL);
if (!HAVE_DB && process.env.CI) {
  throw new Error('TEST_DATABASE_URL is not set in CI; the refresh e2e suite cannot run.');
}

// These env writes are process-wide. They are safe because vitest runs each test FILE in its
// own process/worker with a fresh require cache (the default `isolate: true`) and
// backend/vitest.config.mjs sets fileParallelism: false. Do not switch this suite to
// `isolate: false` or a shared pool: authz.test.js would inherit 2-second tokens.
if (HAVE_DB) process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET ||= 'test-jwt-secret-g47';
process.env.REFRESH_TOKEN_SECRET ||= 'test-refresh-secret-g47';
process.env.JWT_EXPIRES_IN = '2s'; // the real token code, a short lifetime

const ACCESS_TTL_MS = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!HAVE_DB)('G47 refresh interceptor against the real backend', () => {
  let server;
  let baseURL;
  let axios;
  let jwt;
  const seen = []; // what the server received, in order

  beforeAll(async () => {
    await resetAndSeed();
    axios = require('axios');
    jwt = require('jsonwebtoken');
    const express = require('express');
    const { app } = require('../app');
    const outer = express();
    outer.use((req, res, next) => {
      res.on('finish', () => seen.push(`${req.method} ${req.originalUrl} ${res.statusCode}`));
      next();
    });
    outer.use(app);
    await new Promise((resolve) => {
      server = outer.listen(0, '127.0.0.1', () => {
        baseURL = `http://127.0.0.1:${server.address().port}/api`;
        resolve();
      });
    });
  }, 60000); // schema reset + loading the whole app; 10s is not enough on a cold disk

  afterAll(() => server && new Promise((r) => server.close(r)));

  function client(initial) {
    const tokens = { ...initial };
    let loggedOut = 0;
    const instance = axios.create({ baseURL });
    installAuthRefresh(instance, {
      getTokens: async () => ({ ...tokens }),
      setTokens: async (p) => {
        tokens.token = p.token;
        if (p.refreshToken) tokens.refreshToken = p.refreshToken;
      },
      requestRefresh: async (refreshToken) =>
        (await axios.post(`${baseURL}/users/refresh`, { refreshToken })).data,
      onSessionExpired: async () => { loggedOut += 1; },
    });
    return { instance, tokens, loggedOut: () => loggedOut };
  }

  const { clientA } = USERS;
  const expiredAccess = () => jwt.sign(
    { user_id: clientA.user_id, role: clientA.role, exp: Math.floor(Date.now() / 1000) - 60 },
    process.env.JWT_SECRET);
  const validRefresh = () => jwt.sign(
    { user_id: clientA.user_id, role: clientA.role }, process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: '7d' });

  it('an expired access token is a 401 (was 403, which the app could not act on)', async () => {
    seen.length = 0;
    const res = await fetch(`${baseURL}/users/me`, {
      headers: { Authorization: `Bearer ${expiredAccess()}` },
    });
    expect(res.status).toBe(401);
  });

  it('expired token: 401 -> refresh -> replay -> 200, the user is not logged out', async () => {
    const c = client({ token: expiredAccess(), refreshToken: validRefresh() });
    seen.length = 0;
    const res = await c.instance.get('/users/me');
    expect(res.status).toBe(200);
    expect(res.data.user_id).toBe(clientA.user_id);
    expect(seen).toEqual([
      'GET /api/users/me 401',
      'POST /api/users/refresh 200',
      'GET /api/users/me 200',
    ]);
    expect(c.loggedOut()).toBe(0);
  });

  it('3 parallel requests with an expired token -> exactly ONE refresh on the server', async () => {
    const c = client({ token: expiredAccess(), refreshToken: validRefresh() });
    seen.length = 0;
    const results = await Promise.all([
      c.instance.get('/users/me'),
      c.instance.get(`/body-metrics/${clientA.user_id}`),
      c.instance.get(`/intake/${clientA.user_id}`),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(seen.filter((l) => l.startsWith('POST /api/users/refresh'))).toHaveLength(1);
  });

  it('a rejected refresh token logs out cleanly', async () => {
    const c = client({ token: expiredAccess(), refreshToken: 'not-a-valid-refresh-token' });
    await expect(c.instance.get('/users/me')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(c.loggedOut()).toBe(1);
  });

  it('a session spanning 3+ access-token lifetimes never logs out', async () => {
    // Log in for real, so the token pair comes from the production login code.
    const login = await axios.post(`${baseURL}/users/login`, {
      username: USERS.clientA.username, password: FIXTURE_PASSWORD,
    });
    const c = client({ token: login.data.token, refreshToken: login.data.refreshToken });
    seen.length = 0;
    const statuses = [];
    const until = Date.now() + 3.5 * ACCESS_TTL_MS;
    while (Date.now() < until) {
      statuses.push((await c.instance.get('/users/me')).status);
      await sleep(400);
    }
    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(c.loggedOut()).toBe(0);
    // The token really did expire and get refreshed, more than once.
    expect(seen.filter((l) => l === 'POST /api/users/refresh 200').length).toBeGreaterThanOrEqual(2);
  }, 20000);
});
