// G48 — run the offline sync with a token that works.
//
// The sync engine POSTs with whatever access token it is handed. Every trigger used to pass
// the stored token, which is expired 15 minutes after login, so the sync 401'd and (before
// G48) burned an attempt per item each time. runSync now stops on 401 without counting it and
// reports authFailed; this refreshes the session once (G47's single-flight refresh) and
// retries with the new token.
import { runSync, runSyncNow } from './syncEngine';
import { getTokens } from './session';

/**
 * @param apiBase  server root (config/api SERVER_URL)
 * @param refresh  async () => fresh access token (api.js refreshSession)
 * @param explicit true for cold start / login / foreground / "Sync now": also retries items
 *                 that exhausted their automatic attempts
 * @returns the sync result, or null when there is no session to sync with
 */
export async function syncQueued(apiBase, refresh, { explicit = false } = {}) {
  const { token, refreshToken } = await getTokens();
  if (!token && !refreshToken) return null;
  const run = explicit ? runSyncNow : runSync;
  let result = token ? await run(apiBase, token) : { authFailed: true };
  if (result && result.authFailed) {
    let fresh;
    try {
      fresh = await refresh();
    } catch {
      return result; // offline or session gone: the items stay queued, untouched
    }
    result = await run(apiBase, fresh);
  }
  return result;
}
