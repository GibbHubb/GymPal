import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY = 'hai_sync_queue';

export async function enqueue(item) {
    const queue = await getQueue();
    queue.push({ ...item, attempts: 0, createdAt: new Date().toISOString(), status: 'pending' });
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

export async function getPendingCount() {
    const queue = await getQueue();
    return queue.filter(q => q.status === 'pending' || q.status === 'error').length;
}
