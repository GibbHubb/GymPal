import NetInfo from '@react-native-community/netinfo';
import { getQueue, updateItem, removeItem } from './syncQueue';

const MAX_ATTEMPTS = 5;

export async function runSync(apiBaseUrl, authToken) {
    const queue = await getQueue();
    const pending = queue.filter(q => q.status === 'pending' || q.status === 'retrying');
    for (const item of pending) {
        try {
            const res = await fetch(`${apiBaseUrl}/api/workout-logs`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${authToken}`,
                },
                body: JSON.stringify(item.payload),
            });
            if (res.ok || res.status === 409) {
                await removeItem(item.id);
            } else {
                const newAttempts = (item.attempts || 0) + 1;
                await updateItem(item.id, {
                    attempts: newAttempts,
                    status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'retrying',
                    lastError: `HTTP ${res.status}`,
                });
            }
        } catch (e) {
            const newAttempts = (item.attempts || 0) + 1;
            await updateItem(item.id, {
                attempts: newAttempts,
                status: newAttempts >= MAX_ATTEMPTS ? 'failed' : 'retrying',
                lastError: e.message,
            });
        }
    }
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
