// G48 — the offline sync engine and queue: one status vocabulary, a pending count that
// matches what a sync attempts, no orphaned items, one run at a time.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('@react-native-async-storage/async-storage', () => import('./asyncStorageMock.js'));
vi.mock('@react-native-community/netinfo', () => ({
  default: { addEventListener: () => () => {} },
}));

const { store } = await import('./asyncStorageMock.js');
const Q = await import('../syncQueue.js');
const E = await import('../syncEngine.js');

const API = 'http://api.test';
let server; // (body) => { status, json }
let posts;

function res(status, json = {}) {
  return { ok: status >= 200 && status < 300, status, json: async () => json };
}

beforeEach(() => {
  store.clear();
  posts = [];
  server = () => res(201, {});
  vi.stubGlobal('fetch', vi.fn(async (url, init) => {
    posts.push(JSON.parse(init.body));
    return server(JSON.parse(init.body));
  }));
});
afterEach(() => vi.unstubAllGlobals());

const add = (id) => Q.enqueue({ id, type: 'workout_log', payload: { client_id: id } });
const statusOf = async (id) => (await Q.getQueue()).find((i) => i.id === id)?.status;

/** How many items an automatic runSync would attempt, observed by running it. */
async function attemptedByAutoSync() {
  const before = posts.length;
  const snapshot = new Map(store);
  server = () => res(500); // attempt without changing anything we keep
  await E.runSync(API, 't');
  const n = posts.length - before;
  store.clear();
  for (const [k, v] of snapshot) store.set(k, v);
  return n;
}

describe('the status vocabulary', () => {
  it("no module counts or writes 'error', a status nothing produced", () => {
    for (const f of ['syncQueue.js', 'syncEngine.js']) {
      const src = fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
      expect(src.includes("'error'")).toBe(false);
    }
  });

  it('every status the engine writes is in STATUS', async () => {
    await add('a');
    server = () => res(500);
    for (let i = 0; i < E.MAX_ATTEMPTS; i++) await E.runSync(API, 't', { includeFailed: true });
    expect(Object.values(Q.STATUS)).toContain(await statusOf('a'));
  });
});

describe('pending count == what an automatic sync attempts (criterion 2)', () => {
  it('holds through pending -> retrying -> failed', async () => {
    await add('a');
    expect(await statusOf('a')).toBe('pending');
    expect(await Q.getPendingCount()).toBe(1);
    expect(await attemptedByAutoSync()).toBe(1);

    server = () => res(500);
    await E.runSync(API, 't');
    expect(await statusOf('a')).toBe('retrying');
    expect(await Q.getPendingCount()).toBe(1); // was 0: 'retrying' was not counted
    expect(await attemptedByAutoSync()).toBe(1);

    for (let i = 1; i < E.MAX_ATTEMPTS; i++) await E.runSync(API, 't');
    expect(await statusOf('a')).toBe('failed');
    expect(await Q.getPendingCount()).toBe(0);
    expect(await attemptedByAutoSync()).toBe(0);
    expect(await Q.getFailedCount()).toBe(1);
  });
});

describe('runSync outcomes', () => {
  it('success removes the item and collects PBs', async () => {
    await add('a');
    server = () => res(201, { personal_bests: [{ exercise_id: 1 }] });
    const r = await E.runSync(API, 't');
    expect(await Q.getQueue()).toEqual([]);
    expect(r.personalBests).toEqual([{ exercise_id: 1 }]);
    expect(r.synced).toBe(1);
  });

  it('HTTP 409 (already on the server) removes the item', async () => {
    await add('a');
    server = () => res(409);
    await E.runSync(API, 't');
    expect(await Q.getQueue()).toEqual([]);
  });

  it('a network throw counts an attempt and keeps the item', async () => {
    await add('a');
    fetch.mockImplementationOnce(async () => { throw new Error('Network request failed'); });
    await E.runSync(API, 't');
    const [item] = await Q.getQueue();
    expect(item.status).toBe('retrying');
    expect(item.attempts).toBe(1);
    expect(item.lastError).toBe('Network request failed');
  });

  it('a 401 stops the run WITHOUT counting attempts: an expired token cannot orphan items', async () => {
    await add('a');
    await add('b');
    server = () => res(401);
    for (let i = 0; i < E.MAX_ATTEMPTS + 2; i++) {
      const r = await E.runSync(API, 't');
      expect(r.authFailed).toBe(true);
    }
    const items = await Q.getQueue();
    expect(items.map((i) => [i.status, i.attempts])).toEqual([['pending', 0], ['pending', 0]]);
    expect(posts).toHaveLength(E.MAX_ATTEMPTS + 2); // one try per run, then it stopped
  });
});

describe('retry exhaustion (criterion 3)', () => {
  it('a failed item is skipped automatically but retried by an explicit sync', async () => {
    await add('a');
    server = () => res(500);
    for (let i = 0; i < E.MAX_ATTEMPTS; i++) await E.runSync(API, 't');
    expect(await statusOf('a')).toBe('failed');

    server = () => res(201);
    await E.runSync(API, 't'); // automatic: leaves it alone
    expect(await statusOf('a')).toBe('failed');

    await E.runSyncNow(API, 't'); // explicit: reaches it
    expect(await Q.getQueue()).toEqual([]);
  });

  it('5 failures then a success: the item is sent and removed (criterion 4, client half)', async () => {
    await add('a');
    let n = 0;
    server = () => (++n <= 5 ? res(500) : res(201));
    for (let i = 0; i < 5; i++) await E.runSync(API, 't');
    await E.runSyncNow(API, 't');
    expect(await Q.getQueue()).toEqual([]);
    expect(posts).toHaveLength(6);
    expect(posts.every((p) => p.client_id === 'a')).toBe(true);
  });
});

describe('one run at a time', () => {
  it('two overlapping syncs POST each item once', async () => {
    await add('a');
    await add('b');
    let release;
    const gate = new Promise((r) => { release = r; });
    server = () => gate.then(() => res(201));
    const r1 = E.runSync(API, 't');
    const r2 = E.runSync(API, 't');
    release();
    await Promise.all([r1, r2]);
    expect(posts.map((p) => p.client_id)).toEqual(['a', 'b']);
  });

  it('an explicit sync during an automatic one still reaches failed items', async () => {
    await add('a');
    server = () => res(500);
    for (let i = 0; i < E.MAX_ATTEMPTS; i++) await E.runSync(API, 't');
    await add('b');
    let release;
    const gate = new Promise((r) => { release = r; });
    server = () => gate.then(() => res(201));
    const auto = E.runSync(API, 't'); // sends only b
    const explicit = E.runSyncNow(API, 't'); // must not be swallowed
    release();
    await Promise.all([auto, explicit]);
    expect(await Q.getQueue()).toEqual([]);
  });
});

describe('review 2026-10-02: calls during a run, and concurrent queue writes', () => {
  it('a workout queued DURING a run is sent by the call that follows it', async () => {
    await add('a');
    let release;
    const gate = new Promise((r) => { release = r; });
    server = () => gate.then(() => res(201));
    const first = E.runSync(API, 't'); // snapshot: [a]
    await new Promise((r) => setTimeout(r, 5));
    await add('b'); // finished a workout while the run is going
    const second = E.runSync(API, 't'); // must not just share the first run's result
    release();
    const r2 = await second;
    await first;
    expect(posts.map((p) => p.client_id)).toEqual(['a', 'b']);
    expect(r2.synced).toBe(1);
    expect(await Q.getQueue()).toEqual([]);
  });

  it('every caller in one window shares ONE follow-up run', async () => {
    await add('a');
    let release;
    const gate = new Promise((r) => { release = r; });
    server = () => gate.then(() => res(201));
    const first = E.runSync(API, 't');
    const followers = [E.runSync(API, 't'), E.runSync(API, 't'), E.runSyncNow(API, 't')];
    release();
    const results = await Promise.all(followers);
    await first;
    expect(new Set(results).size).toBe(1); // the same result object: one run, not three
  });

  it('interleaved enqueue and remove both survive (no lost write)', async () => {
    await add('a');
    await Promise.all([Q.removeItem('a'), add('b'), add('c'), Q.updateItem('b', { attempts: 2 })]);
    const items = await Q.getQueue();
    expect(items.map((i) => i.id)).toEqual(['b', 'c']);
    expect(items[0].attempts).toBe(2);
  });

  it('subscribers hear about every finished run', async () => {
    let heard = 0;
    const off = E.subscribeSyncRuns(() => { heard += 1; });
    await E.runSync(API, 't');
    await E.runSync(API, 't');
    off();
    await E.runSync(API, 't');
    expect(heard).toBe(2);
  });
});
