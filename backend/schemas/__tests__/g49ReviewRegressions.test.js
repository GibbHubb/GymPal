// G49 cross-file review, 2026-09-24 — two shapes the new validation layer broke for
// real callers, and the privilege split that replaced a blunt fix. Each test fails
// against the pre-fix code, which is the only reason it is worth having.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const groupWorkouts = require('../groupWorkouts.js');
const users = require('../users.js');
const workouts = require('../workouts.js');

const SECRET = 'g49-review-test-secret';

describe('G49 review — a trainer rep RANGE is not a number', () => {
  const body = (reps) => ({
    name: 'Leg day',
    trainer_id: 1,
    exercises: [{ exercise_id: 1, sets: 3, reps }],
  });

  it('accepts "10-12", which is what the trainer UI actually sends', () => {
    // CreateWorkout.js's rep field is free text; its own placeholder is "10-12".
    // z.coerce.number() made that NaN and 400'd every real submission.
    expect(groupWorkouts.createGroupWorkout.safeParse(body('10-12')).success).toBe(true);
  });

  it('still accepts a plain number', () => {
    expect(groupWorkouts.createGroupWorkout.safeParse(body(12)).success).toBe(true);
  });

  it('still rejects junk', () => {
    expect(groupWorkouts.createGroupWorkout.safeParse(body('')).success).toBe(false);
    expect(groupWorkouts.createGroupWorkout.safeParse(body('x'.repeat(50))).success).toBe(false);
  });
});

describe('G49 review — an offline-queued set must not be a poison pill', () => {
  it('accepts a set with null weight (an older client build, replayed from the queue)', () => {
    // The controller already reads these as `parseFloat(s.weight) || 0`. Rejecting
    // null would 400 forever on every retry — the G36 failure, paid for once.
    const parsed = workouts.createWorkout.safeParse({
      exercises: [{ exercise_id: 1, sets: [{ weight: null, reps: 8, rir: null }] }],
    });
    expect(parsed.success).toBe(true);
  });
});

describe('G49 review — who may grant a role', () => {
  // The schema accepts `role`; the CONTROLLER decides whether to honour it. The
  // schema half is asserted here; the controller half is exercised below.
  it('lets a role through the schema so the trainer flow can ask for one', () => {
    const parsed = users.createUser.safeParse({ username: 'x', password: 'y', role: 'trainer' });
    expect(parsed.success && parsed.data.role).toBe('trainer');
  });

  it('rejects a role that is not one of the three', () => {
    expect(users.createUser.safeParse({ username: 'x', password: 'y', role: 'root' }).success)
      .toBe(false);
  });

  // The controller's `grantableRole` is not exported (it is an implementation
  // detail of createUser), so it is read out of the source the same way the
  // route-guard tests read route tables — a deliberate seam, not a shortcut.
  const grantableRole = (() => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'controllers', 'usersController.js'), 'utf8');
    const start = src.indexOf('const grantableRole');
    const end = src.indexOf('const createUser = async');
    expect(start).toBeGreaterThan(-1);
    process.env.JWT_SECRET = SECRET;
    return new Function('jwt', 'process', `${src.slice(start, end)}; return grantableRole;`)(jwt, process);
  })();

  const withToken = (role) => ({
    headers: { authorization: `Bearer ${jwt.sign({ user_id: 1, role }, SECRET)}` },
  });

  it('refuses a self-assigned role on the PUBLIC signup path', () => {
    expect(grantableRole({ headers: {} }, 'masterPt')).toBe('client');
  });

  it('refuses a client trying to promote itself', () => {
    expect(grantableRole(withToken('client'), 'trainer')).toBe('client');
  });

  it('honours a real trainer adding a teammate — the flow the blunt fix broke', () => {
    expect(grantableRole(withToken('trainer'), 'trainer')).toBe('trainer');
    expect(grantableRole(withToken('masterPt'), 'trainer')).toBe('trainer');
  });

  it('treats an unreadable token as the public path, not as an error', () => {
    expect(grantableRole({ headers: { authorization: 'Bearer nonsense' } }, 'trainer'))
      .toBe('client');
  });
});
