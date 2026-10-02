// G47 — use the refresh token instead of logging the user out after 15 minutes.
//
// Access tokens live 15 minutes; the backend has always issued a 7-day refresh token and a
// working POST /users/refresh, but the app never called it, so every session ended in a
// forced logout a quarter-hour in. This installs, on ONE shared axios instance:
//
//   request  -> attach the current access token (read fresh, so a replay uses the new one)
//   401      -> refresh once, store the new pair, replay the original request once
//   refresh rejected (401/403 from /users/refresh, or no refresh token) -> onSessionExpired
//   refresh unreachable (network, 5xx) -> reject the request, do NOT log out: an offline
//                                         user keeps their session and their queued work
//
// N requests that 401 together share ONE refresh (single flight). This module imports
// nothing from React Native so it can be tested in node against the real backend.

export class SessionExpiredError extends Error {
  constructor(message = 'Session expired') {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

/**
 * @param instance          an axios instance (all app API calls go through it)
 * @param getTokens         async () => ({ token, refreshToken })
 * @param setTokens         async ({ token, refreshToken }) => void
 * @param requestRefresh    async (refreshToken) => ({ token, refreshToken }); must use a BARE
 *                          client with no interceptors, or a rejected refresh would recurse
 * @param onSessionExpired  async () => void; clears the session and routes to Login
 * @returns {{ refresh: () => Promise<string> }} the single-flight refresh, for callers
 *          (e.g. the sync engine) that need a valid token outside this instance
 */
export function installAuthRefresh(instance, { getTokens, setTokens, requestRefresh, onSessionExpired }) {
  let inflight = null;

  function refresh() {
    if (!inflight) {
      inflight = (async () => {
        const { refreshToken } = await getTokens();
        if (!refreshToken) throw new SessionExpiredError('No refresh token');
        let pair;
        try {
          pair = await requestRefresh(refreshToken);
        } catch (err) {
          const status = err && err.response && err.response.status;
          if (status === 401 || status === 403) throw new SessionExpiredError();
          throw err; // network / 5xx: not a verdict on the session
        }
        if (!pair || !pair.token) throw new SessionExpiredError('Refresh returned no token');
        await setTokens(pair);
        return pair.token;
      })().finally(() => { inflight = null; });
    }
    return inflight;
  }

  instance.interceptors.request.use(async (config) => {
    const { token } = await getTokens();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const config = error && error.config;
      const status = error && error.response && error.response.status;
      if (status !== 401 || !config) return Promise.reject(error);
      if (config._retried) {
        // Replayed once with a fresh token and still 401: the session is gone.
        await onSessionExpired();
        return Promise.reject(new SessionExpiredError());
      }
      config._retried = true;
      try {
        await refresh();
      } catch (err) {
        if (err instanceof SessionExpiredError) await onSessionExpired();
        return Promise.reject(err);
      }
      return instance(config); // the request interceptor attaches the new token
    },
  );

  return { refresh };
}
