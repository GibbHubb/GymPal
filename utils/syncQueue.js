import AsyncStorage from '@react-native-async-storage/async-storage';
import { tokenUserId } from './jwt';

const QUEUE_KEY = 'hai_sync_queue';

// G48 — the ONE status vocabulary for queue items. The statuses used to be bare string
// literals typed in four places, and they drifted: getPendingCount counted an "error" status
// that nothing ever wrote, so an item vanished from the badge the moment it failed once.
//
//   PENDING   new, never attempted
//   RETRYING  failed at least once, still retried automatically
//   FAILED    hit MAX_ATTEMPTS; no longer retried automatically, but retried by an
//             explicit sync (cold start, login, "Sync now") and counted by getFailedCount
//
// A synced item is removed from the queue, so there is no SYNCED status.
export const STATUS = Object.freeze({
    PENDING: 'pending',
    RETRYING: 'retrying',
    FAILED: 'failed',
});

/** The statuses an AUTOMATIC sync attempts (and getPendingCount counts). */
export const AUTO_SYNC_STATUSES = Object.freeze([STATUS.PENDING, STATUS.RETRYING]);

// G58 — every item records whose workout it is. The queue deliberately survives logout
// (G47), so without an owner, user B logging in on A's phone would sync A's workouts into
// B's account. A sync only sends the items of the user whose token it sends them with;
// everyone else's wait, untouched, until their owner logs back in. Items queued before
// G58 carry no owner and are sent by whoever syncs next, as before.

/** Whose session is active: the user in the stored access token, else the stored user_id. */
export async function currentOwnerId() {
    const fromToken = tokenUserId(await AsyncStorage.getItem('token'));
    if (fromToken) return fromToken;
    const stored = await AsyncStorage.getItem('user_id');
    return stored ? String(stored) : null;
}

/** May `ownerId`'s sync send this item? */
export function isOwnedBy(item, ownerId) {
    if (item.ownerId === undefined || item.ownerId === null) return true; // pre-G58 item
    return ownerId !== null && ownerId !== undefined && String(item.ownerId) === String(ownerId);
}

// Review, 2026-10-02 — every write is a read-modify-write of ONE AsyncStorage key, and G48
// made concurrent writers routine (a sync run removing items while a finished workout is
// enqueued). Unserialised, one write overwrote the other: a just-logged workout lost, or a
// synced one resurrected. All queue writes now go through this chain, one at a time.
let _writeChain = Promise.resolve();
function serialised(fn) {
    const next = _writeChain.then(fn, fn);
    _writeChain = next.catch(() => {});
    return next;
}

export function enqueue(item) {
    return serialised(() => enqueueNow(item));
}

async function enqueueNow(item) {
    const queue = await getQueue();
    const ownerId = item.ownerId ?? await currentOwnerId();
    queue.push({
        ...item,
        ownerId: ownerId === undefined || ownerId === null ? null : String(ownerId),
        attempts: 0,
        createdAt: new Date().toISOString(),
        status: STATUS.PENDING,
    });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue() {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export function updateItem(id, patch) {
    return serialised(async () => {
    const queue = await getQueue();
    const updated = queue.map(item => item.id === id ? { ...item, ...patch } : item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
    });
}

export function removeItem(id) {
    return serialised(async () => {
    const queue = await getQueue();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
    });
}

/** Items an automatic sync will attempt for this user: exactly runSync's default selection. */
export async function getPendingCount(ownerId) {
    const me = ownerId === undefined ? await currentOwnerId() : ownerId;
    const queue = await getQueue();
    return queue.filter(q => AUTO_SYNC_STATUSES.includes(q.status) && isOwnedBy(q, me)).length;
}

/** This user's items that exhausted their automatic retries and wait for an explicit sync. */
export async function getFailedCount(ownerId) {
    const me = ownerId === undefined ? await currentOwnerId() : ownerId;
    const queue = await getQueue();
    return queue.filter(q => q.status === STATUS.FAILED && isOwnedBy(q, me)).length;
}
