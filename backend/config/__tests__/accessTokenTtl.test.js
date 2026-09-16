/**
 * G46 follow-up (2026-09-16) — the access-token lifetime is configurable, but a stale
 * value must not be able to widen it silently.
 *
 * Why this exists: G46 made `JWT_EXPIRES_IN` actually control the access token (the
 * controller had hardcoded '15m' and ignored the setting). The .env.example shipped with
 * this repo said `JWT_EXPIRES_IN=7d` — so any deployment that copied it would have turned
 * a 15-minute credential into a 7-day one the moment the setting started being honoured.
 * Railway's value cannot be read from here, so the code refuses a too-long value instead
 * of trusting the environment.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const config = require('../config.js');

describe('access-token lifetime clamp', () => {
  let warn;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    warn.mockRestore();
  });

  it('parses the durations jsonwebtoken accepts', () => {
    expect(config.ttlSeconds('900')).toBe(900);
    expect(config.ttlSeconds('15m')).toBe(900);
    expect(config.ttlSeconds('2h')).toBe(7200);
    expect(config.ttlSeconds('7d')).toBe(604800);
    expect(config.ttlSeconds('banana')).toBeNull();
  });

  it('REFUSES the 7d value the old .env.example shipped, and says so', () => {
    expect(config.safeAccessTokenTtl('7d')).toBe(config.DEFAULT_ACCESS_TOKEN_TTL);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/exceeds/i);
  });

  it('honours a value inside the cap', () => {
    expect(config.safeAccessTokenTtl('2m')).toBe('2m');
    expect(config.safeAccessTokenTtl('30m')).toBe('30m');
    expect(warn).not.toHaveBeenCalled();
  });

  it('pins the boundary: exactly the cap is allowed, one minute more is not', () => {
    const cap = config.ACCESS_TOKEN_MAX_SECONDS;
    expect(cap).toBe(3600);
    expect(config.safeAccessTokenTtl('1h')).toBe('1h');
    expect(config.safeAccessTokenTtl('61m')).toBe(config.DEFAULT_ACCESS_TOKEN_TTL);
  });

  it('falls back safely when unset or unparseable', () => {
    expect(config.safeAccessTokenTtl(undefined)).toBe(config.DEFAULT_ACCESS_TOKEN_TTL);
    expect(config.safeAccessTokenTtl('')).toBe(config.DEFAULT_ACCESS_TOKEN_TTL);
    expect(config.safeAccessTokenTtl('banana')).toBe(config.DEFAULT_ACCESS_TOKEN_TTL);
  });

  it('the shipped config exposes a lifetime within the cap, whatever the environment says', () => {
    // the control that matters operationally: whatever Railway holds, what the app USES
    // can never exceed the cap
    expect(config.ttlSeconds(config.jwtExpiresIn)).toBeLessThanOrEqual(config.ACCESS_TOKEN_MAX_SECONDS);
  });
});
