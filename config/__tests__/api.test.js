// G54 — one backend URL, overridable, and nothing else in the app types it by hand.
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { resolveServerUrl, SERVER_URL, API_URL } from '../api';

const PROD = 'https://gympalbackend-production.up.railway.app';
const ROOT = path.resolve(__dirname, '..', '..');

describe('config/api (G54)', () => {
  it('defaults to production when EXPO_PUBLIC_API_URL is unset or blank', () => {
    expect(resolveServerUrl(undefined)).toBe(PROD);
    expect(resolveServerUrl('   ')).toBe(PROD);
  });

  it('uses the override, without a trailing slash', () => {
    expect(resolveServerUrl('http://192.168.1.20:5000/')).toBe('http://192.168.1.20:5000');
  });

  it('API_URL is SERVER_URL + /api', () => {
    expect(API_URL).toBe(`${SERVER_URL}/api`);
  });

  it('no app source outside config/ hardcodes the backend URL', () => {
    const offenders = [];
    const skip = new Set(['node_modules', 'backend', '.git', 'config', 'landing', '.expo', 'dist']);
    const walk = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        if (skip.has(e.name)) continue;
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (/\.(js|jsx|ts|tsx)$/.test(e.name) && fs.readFileSync(p, 'utf8').includes('railway.app')) {
          offenders.push(path.relative(ROOT, p));
        }
      }
    };
    walk(ROOT);
    expect(offenders).toEqual([]);
  });
});
