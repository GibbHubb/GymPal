// G37 — unit spec for the pure PR math in utils/prMath.js.
// Run with `npm test` (vitest).

import { describe, it, expect } from 'vitest';
import { epley1RM, setVolume, bestEpleyOfRows, bestVolumeOfRows } from '../prMath';

describe('epley1RM', () => {
  it('computes the Epley estimated 1RM for a known input', () => {
    // 100 * (1 + 5/30) = 116.666...
    expect(epley1RM(100, 5)).toBeCloseTo(116.67, 2);
  });

  it('is monotonic in reps: more reps at the same weight yields a higher 1RM', () => {
    const low = epley1RM(100, 5);
    const high = epley1RM(100, 10);
    expect(high).toBeGreaterThan(low);
  });

  it('is monotonic in weight: more weight at the same reps yields a higher 1RM', () => {
    const low = epley1RM(80, 5);
    const high = epley1RM(120, 5);
    expect(high).toBeGreaterThan(low);
  });

  it('guards against non-positive weight (e.g. bodyweight-only / zero) by returning 0', () => {
    expect(epley1RM(0, 5)).toBe(0);
    expect(epley1RM(-10, 5)).toBe(0);
  });

  it('guards against non-positive reps by returning 0', () => {
    expect(epley1RM(100, 0)).toBe(0);
    expect(epley1RM(100, -1)).toBe(0);
  });
});

describe('setVolume', () => {
  it('computes weight x reps for a single set', () => {
    expect(setVolume(100, 5)).toBe(500);
  });

  it('guards against non-positive input by returning 0', () => {
    expect(setVolume(0, 5)).toBe(0);
    expect(setVolume(100, 0)).toBe(0);
  });
});

describe('bestEpleyOfRows / bestVolumeOfRows', () => {
  const rows = [
    { weight: 100, reps: 5 },
    { weight: 120, reps: 3 },
    { weight: 80, reps: 10 },
  ];

  it('picks the row with the highest estimated 1RM', () => {
    const expected = Math.max(...rows.map((r) => epley1RM(r.weight, r.reps)));
    expect(bestEpleyOfRows(rows)).toBeCloseTo(expected, 5);
  });

  it('picks the row with the highest single-set volume', () => {
    const expected = Math.max(...rows.map((r) => setVolume(r.weight, r.reps)));
    expect(bestVolumeOfRows(rows)).toBe(expected);
  });

  it('returns 0 for empty or invalid history', () => {
    expect(bestEpleyOfRows([])).toBe(0);
    expect(bestVolumeOfRows([])).toBe(0);
    expect(bestEpleyOfRows(null)).toBe(0);
  });
});
