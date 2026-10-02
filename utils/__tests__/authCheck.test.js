// G47 review — the cold-start session decision App.js acts on.
import { describe, it, expect } from 'vitest';
import { checkSession } from '../authCheck.js';
import { SessionExpiredError } from '../authRefresh.js';

const withTokens = (t) => async () => t;
const failWith = (status) => async () => {
  const err = new Error(String(status));
  err.response = { status };
  throw err;
};

describe('checkSession', () => {
  it('no tokens -> signed-out, without asking the server', async () => {
    let asked = false;
    const v = await checkSession({
      getTokens: withTokens({ token: null, refreshToken: null }),
      fetchMe: async () => { asked = true; },
    });
    expect(v).toBe('signed-out');
    expect(asked).toBe(false);
  });

  it('/users/me answers -> signed-in', async () => {
    expect(await checkSession({ getTokens: withTokens({ token: 't' }), fetchMe: async () => ({}) }))
      .toBe('signed-in');
  });

  it('a refresh token alone is enough to try', async () => {
    expect(await checkSession({ getTokens: withTokens({ refreshToken: 'r' }), fetchMe: async () => ({}) }))
      .toBe('signed-in');
  });

  for (const status of [401, 403]) {
    it(`${status} -> signed-out`, async () => {
      expect(await checkSession({ getTokens: withTokens({ token: 't' }), fetchMe: failWith(status) }))
        .toBe('signed-out');
    });
  }

  it('the interceptor giving up (SessionExpiredError) -> signed-out', async () => {
    const v = await checkSession({
      getTokens: withTokens({ token: 't' }),
      fetchMe: async () => { throw new SessionExpiredError(); },
    });
    expect(v).toBe('signed-out');
  });

  // The review finding: any 4xx used to log the user out.
  for (const status of [404, 408, 429, 500, 503]) {
    it(`${status} -> unverified (keeps the session)`, async () => {
      expect(await checkSession({ getTokens: withTokens({ token: 't' }), fetchMe: failWith(status) }))
        .toBe('unverified');
    });
  }

  it('offline (no response at all) -> unverified', async () => {
    const v = await checkSession({
      getTokens: withTokens({ token: 't' }),
      fetchMe: async () => { throw new Error('Network Error'); },
    });
    expect(v).toBe('unverified');
  });
});
