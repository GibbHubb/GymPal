// G47 — the one place the app's session keys live.
//
// Logout used to be `AsyncStorage.clear()`, which also deleted `hai_sync_queue` (the offline
// workout queue, utils/syncQueue.js): a session expiring while a workout was still queued
// destroyed the workout before it ever synced. Logout now removes exactly these keys, so
// anything else the app stores (the queue first of all) survives it by default.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const SESSION_KEYS = Object.freeze(['token', 'refreshToken', 'role', 'user_id', 'lastRoute']);

export async function getTokens() {
  const pairs = await AsyncStorage.multiGet(['token', 'refreshToken']);
  const map = Object.fromEntries(pairs);
  return { token: map.token || null, refreshToken: map.refreshToken || null };
}

/** Store a new token pair. A missing refreshToken leaves the stored one in place. */
export async function setTokens({ token, refreshToken }) {
  const pairs = [];
  if (token) pairs.push(['token', token]);
  if (refreshToken) pairs.push(['refreshToken', refreshToken]);
  if (pairs.length) await AsyncStorage.multiSet(pairs);
}

/**
 * Persist a successful login. The backend answers `{ token, refreshToken, user: { user_id,
 * role, ... } }`; role and user_id used to be read from the top level, where they are not.
 * Returns the role so the caller can route on it.
 */
export async function saveLogin(response) {
  const user = (response && response.user) || {};
  const role = user.role ?? response.role ?? null;
  const userId = user.user_id ?? response.user_id ?? null;
  const pairs = [['token', response.token]];
  if (response.refreshToken) pairs.push(['refreshToken', response.refreshToken]);
  if (role) pairs.push(['role', String(role)]);
  if (userId !== null && userId !== undefined) pairs.push(['user_id', String(userId)]);
  await AsyncStorage.multiSet(pairs);
  return role;
}

/** Log out: remove the session keys and nothing else (see the note at the top). */
export async function clearSession() {
  await AsyncStorage.multiRemove([...SESSION_KEYS]);
}
