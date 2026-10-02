import AsyncStorage from '@react-native-async-storage/async-storage';

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

export async function enqueue(item) {
    const queue = await getQueue();
    queue.push({ ...item, attempts: 0, createdAt: new Date().toISOString(), status: STATUS.PENDING });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue() {
    try {
        const raw = await AsyncStorage.getItem(QUEUE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

export async function updateItem(id, patch) {
    const queue = await getQueue();
    const updated = queue.map(item => item.id === id ? { ...item, ...patch } : item);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}

export async function removeItem(id) {
    const queue = await getQueue();
    const filtered = queue.filter(item => item.id !== id);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(filtered));
}

/** Items an automatic sync will attempt: exactly runSync's default selection. */
export async function getPendingCount() {
    const queue = await getQueue();
    return queue.filter(q => AUTO_SYNC_STATUSES.includes(q.status)).length;
}

/** Items that exhausted their automatic retries and wait for an explicit sync. */
export async function getFailedCount() {
    const queue = await getQueue();
    return queue.filter(q => q.status === STATUS.FAILED).length;
}
