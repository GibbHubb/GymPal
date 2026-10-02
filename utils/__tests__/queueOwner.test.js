// G58 — the offline queue survives logout (G47), so it must only ever replay the
// logged-in owner's items. Tested both ways: B cannot send A's, A cannot send B's.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => import('./asyncStorageMock.js'));
vi.mock('@react-native-community/netinfo', () => ({
  default: { addEventListener: () => () => {} },
}));

const { store } = await import('./asyncStorageMock.js');
const Q = await import('../syncQueue.js');
const E = await import('../syncEngine.js');
const S = await import('../session.js');
const { tokenUserId } = await import('../jwt.js');

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64')
  .replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const tokenFor = (userId) => `${b64url({ alg: 'HS256' })}.${b64url({ user_id: userId, role: 'client' })}.sig`;
const A = tokenFor(1);
const B = tokenFor(2);

let sentWith; // [client_id, token]
beforeEach(() => {
  store.clear();
  sentWith = [];
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    sentWith.push([JSON.parse(init.body).client_id, init.headers.Authorization.replace('Bearer ', '')]);
    return { ok: true, status: 201, json: async () => ({}) };
  }));
});
afterEach(() => vi.unstubAllGlobals());

async function loginAs(token) {
  await S.clearSession();
  await S.saveLogin({ token, refreshToken: 'r', user: { user_id: tokenUserId(token), role: 'client' } });
}
const queue = (id) => Q.enqueue({ id, type: 'workout_log', payload: { client_id: id } });
const ids = async () => (await Q.getQueue()).map((i) => i.id);

describe('tokenUserId', () => {
  it('reads the user_id claim', () => {
    expect(tokenUserId(A)).toBe('1');
    expect(tokenUserId(B)).toBe('2');
  });
  it('is null for anything that is not a JWT', () => {
    for (const t of [null, '', 't', 'a.b', 'a.!!!.c']) expect(tokenUserId(t)).toBe(null);
  });
});

describe('the queue records its owner', () => {
  it('an item queued while A is signed in belongs to A', async () => {
    await loginAs(A);
    await queue('a1');
    expect((await Q.getQueue())[0].ownerId).toBe('1');
  });

  it('falls back to the stored user_id when there is no token', async () => {
    store.set('user_id', '7');
    await queue('x');
    expect((await Q.getQueue())[0].ownerId).toBe('7');
  });
});

describe('only the owner replays', () => {
  it("B signing in on A's phone does NOT send A's workout; A's later sync does", async () => {
    await loginAs(A);
    await queue('a1');
    await loginAs(B); // A logged out; the queue survived (G47)

    await E.runSyncNow('http://api', B);
    expect(sentWith).toEqual([]);
    expect(await ids()).toEqual(['a1']); // kept, untouched
    expect(await Q.getPendingCount()).toBe(0); // B's badge does not show A's work

    await loginAs(A);
    expect(await Q.getPendingCount()).toBe(1);
    await E.runSyncNow('http://api', A);
    expect(sentWith).toEqual([['a1', A]]);
    expect(await ids()).toEqual([]);
  });

  it("the other direction: A cannot send B's workout, and each sends their own", async () => {
    await loginAs(B);
    await queue('b1');
    await loginAs(A);
    await queue('a1');

    await E.runSyncNow('http://api', A);
    expect(sentWith).toEqual([['a1', A]]);
    expect(await ids()).toEqual(['b1']);

    await E.runSyncNow('http://api', B);
    expect(sentWith).toEqual([['a1', A], ['b1', B]]);
    expect(await ids()).toEqual([]);
  });

  it("a failed count is per owner too", async () => {
    await loginAs(A);
    await queue('a1');
    const q = await Q.getQueue();
    q[0].status = Q.STATUS.FAILED;
    store.set('hai_sync_queue', JSON.stringify(q));
    expect(await Q.getFailedCount('1')).toBe(1);
    expect(await Q.getFailedCount('2')).toBe(0);
  });

  it('an item queued before G58 (no owner) is still sent, as before', async () => {
    store.set('hai_sync_queue', JSON.stringify([
      { id: 'old', type: 'workout_log', payload: { client_id: 'old' }, status: 'pending', attempts: 0 },
    ]));
    await E.runSync('http://api', B);
    expect(sentWith).toEqual([['old', B]]);
  });

  it('a token with no readable user sends no owned items', async () => {
    await loginAs(A);
    await queue('a1');
    await E.runSyncNow('http://api', 'not-a-jwt');
    expect(sentWith).toEqual([]);
  });
});
