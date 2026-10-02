// G47 review — the cold-start / post-login session decision, out of App.js so it is tested.
//
//   'signed-out'  no tokens, or the server REJECTED the session (401/403, or the refresh
//                 interceptor gave up with a SessionExpiredError)
//   'signed-in'   GET /users/me answered
//   'unverified'  the server could not be asked or failed (offline, timeout, 5xx, 429, ...):
//                 keep the stored session, so an offline cold start keeps the user and queue
//
// Only an explicit rejection logs the user out. A 404/408/429 is not a verdict on the session.
import { SessionExpiredError } from './authRefresh';

export async function checkSession({ getTokens, fetchMe }) {
  const { token, refreshToken } = await getTokens();
  if (!token && !refreshToken) return 'signed-out';
  try {
    await fetchMe();
    return 'signed-in';
  } catch (err) {
    if (err instanceof SessionExpiredError) return 'signed-out';
    const status = err && err.response && err.response.status;
    if (status === 401 || status === 403) return 'signed-out';
    return 'unverified';
  }
}
