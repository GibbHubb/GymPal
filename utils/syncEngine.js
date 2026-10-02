import NetInfo from '@react-native-community/netinfo';
import { getQueue, updateItem, removeItem, isOwnedBy, STATUS, AUTO_SYNC_STATUSES } from './syncQueue';
import { tokenUserId } from './jwt';

export const MAX_ATTEMPTS = 5;

let _inflight = null; // { includeFailed, promise } while a run is going

/**
 * Send queued workouts to the backend.
 *
 * G48:
 * - `includeFailed` (an EXPLICIT sync: cold start, login, "Sync now") also retries items that
 *   exhausted MAX_ATTEMPTS. They used to be terminal and invisible: five transient 500s during
 *   a deploy orphaned a real session forever.
 * - One run at a time. A NetInfo event and a cold-start sync firing together used to walk the
 *   queue twice; the server dedupes on client_id, but the client double-counted PBs. A call
 *   made while a run is in flight shares that run's result.
 * - A 401/403 means the TOKEN is bad, not the item: the run stops and no attempt is counted
 *   (result.authFailed), so an expired token can no longer burn every item's retries.
 *
 * @returns {Promise<{ personalBests: object[], synced: number, authFailed: boolean }>}
 */
export function runSync(apiBaseUrl, authToken, { includeFailed = false } = {}) {
    if (_inflight) {
        // An explicit sync must not be swallowed by an automatic one already running (NetInfo
        // fires on subscribe, so at cold start one always is): run again once it finishes.
        if (includeFailed && !_inflight.includeFailed) {
            return _inflight.promise
                .catch(() => {})
                .then(() => runSync(apiBaseUrl, authToken, { includeFailed }));
        }
        return _inflight.promise;
    }
    const run = { includeFailed, promise: null };
    run.promise = doSync(apiBaseUrl, authToken, includeFailed).finally(() => {
        if (_inflight === run) _inflight = null;
    });
    _inflight = run;
    return run.promise;
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
