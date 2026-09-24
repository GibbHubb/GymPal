// G49 criterion 6 — CORS no longer reflects an arbitrary Origin. This unit-tests the
// allowlist parsing directly (config.parseCorsOrigins); the live-server curl check against
// a forged origin is recorded in the plan's §9 test log (requires a running server).
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

describe('config.parseCorsOrigins', () => {
  process.env.JWT_SECRET ||= 'x';
  process.env.REFRESH_TOKEN_SECRET ||= 'x';
  process.env.DATABASE_URL ||= 'postgres://test:test@127.0.0.1:59999/never_connects';
  const config = require('../config.js');

  it('always includes the local dev origins even with no CORS_ORIGINS set', () => {
    const origins = config.parseCorsOrigins('');
    expect(origins).toEqual(expect.arrayContaining(config.DEFAULT_DEV_ORIGINS));
  });

  it('adds extra comma-separated origins on top of the defaults', () => {
    const origins = config.parseCorsOrigins('https://gympal.example.com, https://preview.example.com');
    expect(origins).toContain('https://gympal.example.com');
    expect(origins).toContain('https://preview.example.com');
  });

  it('a forged/unlisted origin is NOT in the allowlist', () => {
    const origins = config.parseCorsOrigins('https://gympal.example.com');
    expect(origins).not.toContain('https://evil.example');
  });

  it('trims whitespace and de-dupes', () => {
    const origins = config.parseCorsOrigins('http://localhost:8081,  http://localhost:8081  ');
    const count = origins.filter((o) => o === 'http://localhost:8081').length;
    expect(count).toBe(1);
  });
});
