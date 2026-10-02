// G47 review — the REAL api.js wiring, not a hand-built harness: its shared instance, its
// bare-axios refresh call, and its logout (session cleared, queue kept, reset to Login).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

vi.mock('@react-native-async-storage/async-storage', () => import('./asyncStorageMock.js'));
const dispatch = vi.fn();
vi.mock('../RootNavigation', () => ({
  navigationRef: { isReady: () => true, dispatch: (...a) => dispatch(...a) },
}));
vi.mock('@react-navigation/native', () => ({
  CommonActions: { reset: (state) => ({ type: 'RESET', payload: state }) },
}));

const { store } = await import('./asyncStorageMock.js');
const api = await import('../../api.js');
const { API_URL } = await import('../../config/api.js');

let seen; // [method url authorization]
function serverAccepting(validToken) {
  api.authApi.defaults.adapter = async (config) => {
    seen.push(`${config.method.toUpperCase()} ${config.url} ${config.headers.Authorization}`);
    if (config.headers.Authorization !== `Bearer ${validToken}`) {
      const err = new Error('401');
      err.config = config;
      err.response = { status: 401, data: {}, headers: {}, config };
      throw err;
    }
    return { data: { user_id: 1 }, status: 200, statusText: 'OK', headers: {}, config };
  };
}

beforeEach(() => {
  store.clear();
  seen = [];
  dispatch.mockReset();
  store.set('token', 'old');
  store.set('refreshToken', 'r1');
  store.set('role', 'client');
  store.set('hai_sync_queue', JSON.stringify([{ id: 'w1', status: 'pending' }]));
});
afterEach(() => vi.restoreAllMocks());

describe('api.js wiring', () => {
  it('an expired token is refreshed through BARE axios at /users/refresh, stored, and replayed', async () => {
    serverAccepting('new');
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: 'new', refreshToken: 'r2' } });
    const profile = await api.fetchUserProfile();
    expect(profile).toEqual({ user_id: 1 });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith(`${API_URL}/users/refresh`, { refreshToken: 'r1' });
    expect(seen).toEqual(['GET /users/me Bearer old', 'GET /users/me Bearer new']);
    expect(store.get('token')).toBe('new');
    expect(store.get('refreshToken')).toBe('r2');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('a rejected refresh clears the session, keeps the queue, and resets to Login', async () => {
    serverAccepting('never');
    vi.spyOn(axios, 'post').mockRejectedValue(Object.assign(new Error('401'), { response: { status: 401 } }));
    await api.fetchUserProfile(); // fetchUserProfile swallows errors and returns null
    expect(store.has('token')).toBe(false);
    expect(store.has('refreshToken')).toBe(false);
    expect(store.has('role')).toBe(false);
    expect(JSON.parse(store.get('hai_sync_queue'))).toHaveLength(1);
    expect(dispatch).toHaveBeenCalledWith({ type: 'RESET', payload: { index: 0, routes: [{ name: 'Login' }] } });
  });

  it('refresh unreachable: nothing is cleared and nobody is sent to Login', async () => {
    serverAccepting('never');
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Network Error'));
    await api.fetchUserProfile();
    expect(store.get('token')).toBe('old');
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('every legacy call site gets the same shared, refresh-aware instance', async () => {
    serverAccepting('old');
    await api.fetchIntakeData(1);
    expect(seen).toEqual(['GET /intake/1 Bearer old']);
  });
});
