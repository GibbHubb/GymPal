import NetInfo from '@react-native-community/netinfo';
import { getQueue, updateItem, removeItem, isOwnedBy, STATUS, AUTO_SYNC_STATUSES } from './syncQueue';
import { tokenUserId } from './jwt';

export const MAX_ATTEMPTS = 5;

let _inflight = null; // the running run's promise
let _rerun = null;    // the ONE follow-up run callers arriving mid-run share
const _listeners = new Set();

/**
 * Send queued workouts to the backend.
 *
 * G48:
 * - `includeFailed` (an EXPLICIT sync: cold start, login, "Sync now") also retries items that
 *   exhausted MAX_ATTEMPTS. They used to be terminal and invisible: five transient 500s during
 *   a deploy orphaned a real session forever.
 * - One run at a time. A NetInfo event and a cold-start sync firing together used to walk the
 *   queue twice; the server dedupes on client_id, but the client double-counted PBs.
 * - A call that arrives while a run is going does NOT share that run's result: the run took
 *   its queue snapshot before the call (a workout queued since is not in it) and may hold
 *   another user's token. Such calls queue one follow-up run, which they all share: the
 *   latest caller's token, and includeFailed if any of them asked for it. (Review, 2026-10-02.)
 * - A 401/403 means the TOKEN is bad, not the item: the run stops and no attempt is counted
 *   (result.authFailed), so an expired token can no longer burn every item's retries.
 *
 * @returns {Promise<{ personalBests: object[], synced: number, authFailed: boolean }>}
 */
export function runSync(apiBaseUrl, authToken, { includeFailed = false } = {}) {
    if (!_inflight) return startRun(apiBaseUrl, authToken, includeFailed);
    if (!_rerun) {
        let resolve;
        let reject;
        const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
        _rerun = { apiBaseUrl, authToken, includeFailed, promise, resolve, reject };
    } else {
        _rerun.apiBaseUrl = apiBaseUrl;
        _rerun.authToken = authToken;
        _rerun.includeFailed = _rerun.includeFailed || includeFailed;
    }
    return _rerun.promise;
}

function startRun(apiBaseUrl, authToken, includeFailed) {
    const run = doSync(apiBaseUrl, authToken, includeFailed).finally(() => {
        _inflight = null;
        for (const fn of _listeners) {
            try { fn(); } catch { /* a listener must not break the engine */ }
        }
        const next = _rerun;
        _rerun = null;
        if (next) {
            startRun(next.apiBaseUrl, next.authToken, next.includeFailed).then(next.resolve, next.reject);
        }
    });
    _inflight = run;
    return run;
}

/** Be told whenever a sync run finishes (e.g. to refresh a pending/failed badge). */
export function subscribeSyncRuns(fn) {
    _listeners.add(fn);
    return () => _listeners.delete(fn);
}

/** An explicit sync: also retries items in STATUS.FAILED. */
export function runSyncNow(apiBaseUrl, authToken) {
    return runSync(apiBaseUrl, authToken, { includeFailed: true });
}

async function doSync(apiBaseUrl, authToken, includeFailed) {
    const queue = await getQueue();
    const wanted = includeFailed ? [...AUTO_SYNC_STATUSES, STATUS.FAILED] : AUTO_SYNC_STATUSES;
    // G58 — the server files a workout under the token's user, so send only that user's items.
    const me = tokenUserId(authToken);
    const toSend = queue.filter(q => wanted.includes(q.status) && isOwnedBy(q, me));
    // G9 — aggregate PB detections across all synced items
    const personalBests = [];
    let synced = 0;
    for (const item of toSend) {
        try {
            const res = await fetch(`${apiBaseUrl}/api/workouts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify(item.payload),
            });
            if (res.status === 401 || res.status === 403) {
                return { personalBests, synced, authFailed: true };
            }
            if (res.ok || res.status === 409) {
                // Parse PB data from response (safe-fail if body is empty/non-JSON)
                try {
                    const body = await res.json();
                    if (body && Array.isArray(body.personal_bests) && body.personal_bests.length > 0) {
                        personalBests.push(...body.personal_bests);
                    }
                } catch (_) { /* ignore */ }
                await removeItem(item.id);
                synced += 1;
            } else {
                await recordFailure(item, `HTTP ${res.status}`);
            }
        } catch (e) {
            await recordFailure(item, e.message);
        }
    }
    return { personalBests, synced, authFailed: false };
}

async function recordFailure(item, lastError) {
    const attempts = (item.attempts || 0) + 1;
    await updateItem(item.id, {
        attempts,
        status: attempts >= MAX_ATTEMPTS ? STATUS.FAILED : STATUS.RETRYING,
        lastError,
    });
}

let _unsubscribe = null;

export function startSyncEngine(apiBaseUrl, getAuthToken) {
    if (_unsubscribe) _unsubscribe();
    _unsubscribe = NetInfo.addEventListener(state => {
        if (state.isConnected) {
            const token = getAuthToken();
            if (token) runSync(apiBaseUrl, token);
        }
    });
}

export function stopSyncEngine() {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
}
