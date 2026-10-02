// G47 — the refresh-and-replay interceptor, against a scripted axios adapter.
// The same module also runs against the REAL backend in backend/test/authRefresh.e2e.test.js.
import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';
import { installAuthRefresh, SessionExpiredError } from '../authRefresh.js';

function fail(config, status) {
  const err = new Error(String(status));
  err.config = config;
  err.response = { status, data: {}, headers: {}, config };
  return err;
}

function harness({ refreshImpl } = {}) {
  const log = [];
  const tokens = { token: 'expired', refreshToken: 'r1' };
  const valid = new Set(); // access tokens the scripted server accepts
  const instance = axios.create({ baseURL: 'http://api.test' });
  instance.defaults.adapter = async (config) => {
    const tok = String(config.headers.Authorization || '').replace('Bearer ', '');
    log.push(`${config.url} ${tok}`);
    if (!valid.has(tok)) throw fail(config, 401);
    return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
  };
  let refreshCalls = 0;
  const requestRefresh = vi.fn(async (rt) => {
    refreshCalls += 1;
    log.push(`/users/refresh ${rt}`);
    if (refreshImpl) return refreshImpl(rt);
    await new Promise((r) => setTimeout(r, 20)); // let concurrent 401s pile up
    valid.add('fresh');
    return { token: 'fresh', refreshToken: 'r2' };
  });
  const onSessionExpired = vi.fn(async () => { log.push('LOGOUT'); });
  installAuthRefresh(instance, {
    getTokens: async () => ({ ...tokens }),
    setTokens: async (p) => {
      tokens.token = p.token;
      if (p.refreshToken) tokens.refreshToken = p.refreshToken;
    },
    requestRefresh,
    onSessionExpired,
  });
  return { instance, log, tokens, onSessionExpired, refreshCount: () => refreshCalls };
}

describe('installAuthRefresh', () => {
  it('401 -> refresh -> replay -> 200, and no logout (criterion 2)', async () => {
    const h = harness();
    const res = await h.instance.get('/users/me');
    expect(res.status).toBe(200);
    expect(h.log).toEqual(['/users/me expired', '/users/refresh r1', '/users/me fresh']);
    expect(h.onSessionExpired).not.toHaveBeenCalled();
    expect(h.tokens).toEqual({ token: 'fresh', refreshToken: 'r2' });
  });

  it('3 parallel 401s produce exactly ONE refresh (criterion 5)', async () => {
    const h = harness();
    const results = await Promise.all([
      h.instance.get('/a'), h.instance.get('/b'), h.instance.get('/c'),
    ]);
    expect(results.map((r) => r.status)).toEqual([200, 200, 200]);
    expect(h.refreshCount()).toBe(1);
  });

  it('a rejected refresh logs out cleanly (criterion 6)', async () => {
    const h = harness({ refreshImpl: async () => { throw fail({}, 401); } });
    await expect(h.instance.get('/users/me')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(h.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('no refresh token stored -> logout without calling refresh', async () => {
    const h = harness();
    h.tokens.refreshToken = null;
    await expect(h.instance.get('/x')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(h.refreshCount()).toBe(0);
    expect(h.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('refresh unreachable (offline) -> request fails but the user is NOT logged out', async () => {
    const h = harness({ refreshImpl: async () => { throw new Error('Network Error'); } });
    await expect(h.instance.get('/x')).rejects.toThrow('Network Error');
    expect(h.onSessionExpired).not.toHaveBeenCalled();
  });

  it('replays at most once: still 401 with the fresh token -> logout, no loop', async () => {
    const h = harness({ refreshImpl: async () => ({ token: 'also-bad', refreshToken: 'r2' }) });
    await expect(h.instance.get('/x')).rejects.toBeInstanceOf(SessionExpiredError);
    expect(h.refreshCount()).toBe(1);
    expect(h.log.filter((l) => l.startsWith('/x')).length).toBe(2);
    expect(h.onSessionExpired).toHaveBeenCalledTimes(1);
  });

  it('a 401 for a token that was ALREADY replaced replays without a second refresh', async () => {
    const h = harness();
    const base = h.instance.defaults.adapter;
    h.instance.defaults.adapter = async (config) => {
      // '/late' leaves with the old token but its 401 arrives after the refresh is DONE.
      if (config.url === '/late') await new Promise((r) => setTimeout(r, 100));
      return base(config);
    };
    const late = h.instance.get('/late');
    await h.instance.get('/first'); // 401 -> refresh (20 ms) -> replay; inflight cleared
    expect(h.refreshCount()).toBe(1);
    await expect(late).resolves.toMatchObject({ status: 200 });
    expect(h.refreshCount()).toBe(1); // replayed with 'fresh', no second refresh
    expect(h.log.filter((l) => l.startsWith('/late'))).toEqual(['/late expired', '/late fresh']);
  });

  it('a non-401 error passes through untouched', async () => {
    const h = harness();
    h.instance.defaults.adapter = async (config) => { throw fail(config, 403); };
    await expect(h.instance.get('/x')).rejects.toThrow('403');
    expect(h.refreshCount()).toBe(0);
    expect(h.onSessionExpired).not.toHaveBeenCalled();
  });
});
