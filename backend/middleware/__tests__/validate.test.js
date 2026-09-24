// G49 — unit coverage for the validate(schema) middleware itself, mirroring how
// authorize.test.js exercises requireSelfOrLinkedTrainer directly (mock req/res, no HTTP,
// no DB) rather than only through the route-level enumeration test.
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { z } = require('zod');
const { validate, VALIDATE_SCHEMA } = require('../validate.js');

function mockRes() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

describe('validate(schema) middleware', () => {
  const schema = z.object({
    stress: z.coerce.number().min(0).max(10).nullish(),
    name: z.string().min(1),
  });

  it('calls next() and replaces req.body with the parsed result on a valid body', () => {
    const req = { body: { stress: '3', name: 'ok' } };
    const res = mockRes();
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
    // coerced: '3' (string) -> 3 (number)
    expect(req.body).toEqual({ stress: 3, name: 'ok' });
  });

  it('G49 criterion 2 — a non-numeric value in a numeric field 400s naming the field, not a driver error', () => {
    const req = { body: { stress: 'banana', name: 'ok' } };
    const res = mockRes();
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toMatch(/stress/);
    expect(body.errors.some((e) => e.field === 'stress')).toBe(true);
  });

  it('G49 criterion 4 — an unknown/extra key is stripped, not rejected (decision: strip)', () => {
    const req = { body: { name: 'ok', role: 'masterPt' } };
    const res = mockRes();
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(req.body).not.toHaveProperty('role');
  });

  it('400s on a missing required field, naming it', () => {
    const req = { body: {} };
    const res = mockRes();
    const next = vi.fn();
    validate(schema)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('tags the returned middleware with VALIDATE_SCHEMA (used by the route-coverage test)', () => {
    const mw = validate(schema);
    expect(mw[VALIDATE_SCHEMA]).toEqual({ schema });
  });
});

describe('G49 criterion 3 — schemas/workouts.js createWorkout rejects a bad set entry', () => {
  const { createWorkout } = require('../../schemas/workouts.js');

  it('names the offending index and field for exercise_id + a malformed set', () => {
    const req = {
      body: {
        exercises: [{ exercise_id: 'abc', sets: [{ weight: -1, reps: 'x' }] }],
      },
    };
    const res = mockRes();
    const next = vi.fn();
    validate(createWorkout)(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const fields = res.json.mock.calls[0][0].errors.map((e) => e.field);
    // Zod's issue path is exercises.0.exercise_id / exercises.0.sets.0.reps — the index
    // is IN the path, satisfying "names the offending index and field".
    expect(fields.some((f) => f.startsWith('exercises.0'))).toBe(true);
  });

  it('accepts a well-formed workout body (known-good control)', () => {
    const req = {
      body: {
        name: 'Leg day',
        exercises: [{ exercise_id: 1, sets: [{ weight: 60, reps: 10, rir: 2 }] }],
      },
    };
    const res = mockRes();
    const next = vi.fn();
    validate(createWorkout)(req, res, next);
    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});
