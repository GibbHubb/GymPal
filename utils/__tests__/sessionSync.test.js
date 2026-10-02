// G48 — the queue sync gets a token that works: an expired one is refreshed once and the
// sync retried. This is the path the G47 review found still sending the stale stored token.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => import('./asyncStorageMock.js'));
vi.mock('@react-native-community/netinfo', () => ({
  default: { addEventListener: () => () => {} },
}));

const { store } = await import('./asyncStorageMock.js');
const Q = await import('../syncQueue.js');
const { syncQueued } = await import('../sessionSync.js');

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
  .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tok = (name) => `${b64url({ alg: 'HS256' })}.${b64url({ user_id: 1, n: name })}.sig`;
const OLD = tok('old');
const NEW = tok('new');

let sent;
beforeEach(() => {
  store.clear();
  sent = [];
  store.set('token', OLD);
  store.set('refreshToken', 'r');
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    const t = init.headers.Authorization.replace('Bearer ', '');
    sent.push(t === OLD ? 'old' : t === NEW ? 'new' : '?');
    return t === NEW
      ? { ok: true, status: 201, json: async () => ({}) }
      : { ok: false, status: 401, json: async () => ({}) };
  }));
});
afterEach(() => vi.unstubAllGlobals());

const queueOne = () => Q.enqueue({ id: 'w1', type: 'workout_log', payload: { client_id: 'w1' } });

describe('syncQueued', () => {
  it('expired token: refreshes once, retries, and the workout syncs', async () => {
    await queueOne();
    const refresh = vi.fn(async () => { store.set('token', NEW); return NEW; });
    const r = await syncQueued('http://api', refresh);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(sent).toEqual(['old', 'new']);
    expect(r.synced).toBe(1);
    expect(await Q.getQueue()).toEqual([]);
  });

  it('refresh fails (offline / session gone): the item stays, attempts untouched', async () => {
    await queueOne();
    const r = await syncQueued('http://api', async () => { throw new Error('Network Error'); });
    expect(r.authFailed).toBe(true);
    const [item] = await Q.getQueue();
    expect([item.status, item.attempts]).toEqual(['pending', 0]);
  });

  it('a valid token: no refresh', async () => {
    store.set('token', NEW);
    await queueOne();
    const refresh = vi.fn();
    await syncQueued('http://api', refresh);
    expect(refresh).not.toHaveBeenCalled();
    expect(sent).toEqual(['new']);
  });

  it('explicit sync reaches a failed item; automatic does not', async () => {
    store.set('token', NEW);
    await queueOne();
    const q = await Q.getQueue();
    q[0].status = Q.STATUS.FAILED;
    store.set('hai_sync_queue', JSON.stringify(q));
    await syncQueued('http://api', vi.fn());
    expect(sent).toEqual([]);
    await syncQueued('http://api', vi.fn(), { explicit: true });
    expect(sent).toEqual(['new']);
    expect(await Q.getQueue()).toEqual([]);
  });

  it('no session at all: does nothing', async () => {
    store.clear();
    await queueOne();
    expect(await syncQueued('http://api', vi.fn())).toBe(null);
    expect(sent).toEqual([]);
  });
});
