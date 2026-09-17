// G54 — the ONE place the app decides which backend it talks to.
//
// The production URL was hardcoded in 11 files (screens, hooks, api.js, App.js), so pointing a
// dev build at a local backend meant editing all of them and remembering to change them back.
// Set EXPO_PUBLIC_API_URL (Expo inlines EXPO_PUBLIC_* at build time) to override; unset, the
// app uses production exactly as before.
const PRODUCTION_SERVER_URL = 'https://gympalbackend-production.up.railway.app';

export function resolveServerUrl(envValue) {
  const v = (envValue || '').trim().replace(/\/+$/, '');
  return v || PRODUCTION_SERVER_URL;
}

/** Origin of the backend: used for Socket.IO and for health checks. */
export const SERVER_URL = resolveServerUrl(process.env.EXPO_PUBLIC_API_URL);
/** REST base: SERVER_URL + /api. */
export const API_URL = `${SERVER_URL}/api`;
