// G47 — logout removes the session and nothing else; the offline queue survives it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => import('./asyncStorageMock.js'));

const { store, default: AsyncStorage } = await import('./asyncStorageMock.js');
const session = await import('../session.js');
const queue = await import('../syncQueue.js');

beforeEach(() => store.clear());

// The backend's real login body (usersController.loginUser).
const LOGIN = {
  token: 'access-1',
  refreshToken: 'refresh-1',
  user: { user_id: 7, trainer_id: null, username: 'c', role: 'client' },
};

describe('saveLogin', () => {
  it('persists the refresh token (criterion 1)', async () => {
    await session.saveLogin(LOGIN);
    expect(store.get('refreshToken')).toBe('refresh-1');
    expect(store.get('token')).toBe('access-1');
  });

  it('reads role and user_id from response.user, where the backend puts them', async () => {
    const role = await session.saveLogin(LOGIN);
    expect(role).toBe('client');
    expect(store.get('role')).toBe('client');
    expect(store.get('user_id')).toBe('7');
  });
});

describe('clearSession', () => {
  it('keeps hai_sync_queue: an enqueued workout survives logout (criterion 4)', async () => {
    await session.saveLogin(LOGIN);
    await queue.enqueue({ id: 'w1', type: 'workout_log', payload: { client_id: 'w1' } });
    await session.clearSession();
    const left = await queue.getQueue();
    expect(left.map((i) => i.id)).toEqual(['w1']);
  });

  it('removes every session key', async () => {
    await session.saveLogin(LOGIN);
    store.set('lastRoute', 'ClientHome');
    await session.clearSession();
    for (const k of session.SESSION_KEYS) expect(store.has(k)).toBe(false);
  });

  it('control: AsyncStorage.clear(), the old logout, does lose the queue', async () => {
    await queue.enqueue({ id: 'w1', type: 'workout_log', payload: {} });
    await AsyncStorage.clear();
    expect(await queue.getQueue()).toEqual([]);
  });
});

describe('setTokens', () => {
  it('a pair without refreshToken keeps the stored one', async () => {
    await session.saveLogin(LOGIN);
    await session.setTokens({ token: 'access-2' });
    expect(await session.getTokens()).toEqual({ token: 'access-2', refreshToken: 'refresh-1' });
  });
});
