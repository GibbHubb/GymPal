// G36 — unit spec for the derived workout name in utils/workoutNaming.js.
// Run with `npm test` (vitest).

import { describe, it, expect } from 'vitest';
import { deriveWorkoutName, timeOfDayLabel } from '../workoutNaming';

describe('timeOfDayLabel', () => {
  it('labels the three windows by hour', () => {
    expect(timeOfDayLabel(new Date(2026, 0, 1, 8, 0))).toBe('Morning');
    expect(timeOfDayLabel(new Date(2026, 0, 1, 14, 0))).toBe('Afternoon');
    expect(timeOfDayLabel(new Date(2026, 0, 1, 20, 0))).toBe('Evening');
  });

  it('treats the boundaries as the start of the later window', () => {
    expect(timeOfDayLabel(new Date(2026, 0, 1, 11, 59))).toBe('Morning');
    expect(timeOfDayLabel(new Date(2026, 0, 1, 12, 0))).toBe('Afternoon');
    expect(timeOfDayLabel(new Date(2026, 0, 1, 17, 0))).toBe('Evening');
  });

  it('falls back to now for an invalid date rather than throwing', () => {
    expect(['Morning', 'Afternoon', 'Evening']).toContain(timeOfDayLabel(new Date('nope')));
    expect(['Morning', 'Afternoon', 'Evening']).toContain(timeOfDayLabel(undefined));
  });
});

describe('deriveWorkoutName', () => {
  it('uses the single exercise name when only one was trained', () => {
    expect(deriveWorkoutName([{ name: 'Bench Press' }])).toBe('Bench Press');
  });

  it('joins exactly two with an ampersand', () => {
    expect(deriveWorkoutName([{ name: 'Squat' }, { name: 'Deadlift' }])).toBe('Squat & Deadlift');
  });

  it('summarises three or more with a +N more suffix', () => {
    const out = deriveWorkoutName([
      { name: 'Bench Press' },
      { name: 'Squat' },
      { name: 'Row' },
      { name: 'Curl' },
    ]);
    expect(out).toBe('Bench Press, Squat +2 more');
  });

  it('de-duplicates repeated exercises before counting', () => {
    const out = deriveWorkoutName([
      { name: 'Squat' },
      { name: 'Squat' },
      { name: 'Bench Press' },
    ]);
    expect(out).toBe('Squat & Bench Press');
  });

  it('ignores blank and missing names', () => {
    const out = deriveWorkoutName([{ name: '  ' }, { name: 'Squat' }, {}, { name: null }]);
    expect(out).toBe('Squat');
  });

  it('falls back to a time-of-day label when nothing is named', () => {
    expect(deriveWorkoutName([], new Date(2026, 0, 1, 8, 0))).toBe('Morning Workout');
    expect(deriveWorkoutName([{}, { name: '' }], new Date(2026, 0, 1, 20, 0))).toBe('Evening Workout');
  });

  it('never returns an empty string — the backend requires a truthy name', () => {
    for (const input of [null, undefined, [], [{}], 'not-an-array']) {
      expect(deriveWorkoutName(input).length).toBeGreaterThan(0);
    }
  });

  it('truncates an over-long name with an ellipsis', () => {
    const long = 'A'.repeat(80);
    const out = deriveWorkoutName([{ name: long }]);
    expect(out.length).toBeLessThanOrEqual(60);
    expect(out.endsWith('…')).toBe(true);
  });
});
