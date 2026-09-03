// G44 — unit spec for the authorization middleware that closed four IDOR reads.
// Run with `npm test` (vitest). No database is contacted: authorize.js exposes its one
// DB touch as `deps.hasActiveLink`, which we override per test — cleaner than fighting
// the CJS/ESM mock interop for a module that opens a pg Pool at load.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { requireSelfOrLinkedTrainer, requireTrainer, deps } = require('../authorize.js');

const hasActiveLink = vi.fn();
deps.hasActiveLink = (...a) => hasActiveLink(...a);

function mkRes() {
  const res = { statusCode: null, body: null };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
}

function run(mw, req) {
  return new Promise((resolve) => {
    const res = mkRes();
    const next = vi.fn(() => resolve({ res, nextCalled: true }));
    Promise.resolve(mw(req, res, next)).then(() => {
      if (!next.mock.calls.length) resolve({ res, nextCalled: false });
    });
  });
}

beforeEach(() => hasActiveLink.mockReset());

describe('requireSelfOrLinkedTrainer', () => {
  const mw = requireSelfOrLinkedTrainer('user_id');

  it('lets a user read their OWN data (no link check needed)', async () => {
    const { nextCalled } = await run(mw, { user: { user_id: 7, role: 'client' }, params: { user_id: '7' } });
    expect(nextCalled).toBe(true);
    expect(hasActiveLink).not.toHaveBeenCalled();
  });

  it('403s a client reading ANOTHER user (the headline IDOR)', async () => {
    const { res, nextCalled } = await run(mw, { user: { user_id: 7, role: 'client' }, params: { user_id: '8' } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(hasActiveLink).not.toHaveBeenCalled();
  });

  it('403s a trainer with NO active link to the target', async () => {
    hasActiveLink.mockResolvedValueOnce(false);
    const { res, nextCalled } = await run(mw, { user: { user_id: 3, role: 'pt' }, params: { user_id: '99' } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(403);
    expect(hasActiveLink).toHaveBeenCalledWith(3, 99);
  });

  it('allows a trainer WITH an active link to the target', async () => {
    hasActiveLink.mockResolvedValueOnce(true);
    const { nextCalled } = await run(mw, { user: { user_id: 3, role: 'pt' }, params: { user_id: '99' } });
    expect(nextCalled).toBe(true);
    expect(hasActiveLink).toHaveBeenCalledWith(3, 99);
  });

  it('400s a non-numeric id', async () => {
    const { res, nextCalled } = await run(mw, { user: { user_id: 7, role: 'client' }, params: { user_id: 'abc' } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(400);
  });

  it('401s when there is no authenticated user', async () => {
    const { res } = await run(mw, { user: undefined, params: { user_id: '7' } });
    expect(res.statusCode).toBe(401);
  });

  it('500s (does not allow) when the link check throws — fail closed', async () => {
    hasActiveLink.mockRejectedValueOnce(new Error('db down'));
    const { res, nextCalled } = await run(mw, { user: { user_id: 3, role: 'pt' }, params: { user_id: '99' } });
    expect(nextCalled).toBe(false);
    expect(res.statusCode).toBe(500);
  });
});

describe('requireTrainer', () => {
  it('allows a trainer role', async () => {
    const { nextCalled } = await run(requireTrainer, { user: { user_id: 3, role: 'masterPt' } });
    expect(nextCalled).toBe(true);
  });
  it('403s a client role', async () => {
    const { res } = await run(requireTrainer, { user: { user_id: 7, role: 'client' } });
    expect(res.statusCode).toBe(403);
  });
});
