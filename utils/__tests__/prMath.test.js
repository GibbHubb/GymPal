// G37 — unit spec for the pure PR math in utils/prMath.js.
// Run with `npm test` (vitest).

import { describe, it, expect } from 'vitest';
import {
  epley1RM,
  setVolume,
  bestEpleyOfRows,
  bestVolumeOfRows,
  mergePersonalBests,
} from '../prMath';

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

describe('mergePersonalBests (G39)', () => {
  const serverPBs = [
    { exercise_id: 1, exercise_name: 'Bench Press', new_volume: 500, previous_best: 450 },
    { exercise_id: 2, exercise_name: 'Squat', new_volume: 800, previous_best: 700 },
  ];

  it('drops a server PB the client already reported as a volume PR', () => {
    const clientPRs = [{ exercise_id: 1, type: 'volume', value: 500, previous: 450 }];
    const out = mergePersonalBests(serverPBs, clientPRs);
    expect(out.map((p) => p.exercise_id)).toEqual([2]);
  });

  it('keeps a server PB when the client only reported a 1RM PR for it', () => {
    // A 1RM PR is a different celebration, so the volume PB is not a duplicate.
    const clientPRs = [{ exercise_id: 1, type: '1rm', value: 120, previous: 110 }];
    expect(mergePersonalBests(serverPBs, clientPRs)).toHaveLength(2);
  });

  it('keeps every server PB when the client path produced nothing (offline fallback)', () => {
    expect(mergePersonalBests(serverPBs, [])).toEqual(serverPBs);
    expect(mergePersonalBests(serverPBs, null)).toEqual(serverPBs);
  });

  it('returns an empty list when every PB is already covered', () => {
    const clientPRs = [
      { exercise_id: 1, type: 'volume' },
      { exercise_id: 2, type: 'volume' },
    ];
    expect(mergePersonalBests(serverPBs, clientPRs)).toEqual([]);
  });

  it('matches ids across string/number types', () => {
    const clientPRs = [{ exercise_id: '1', type: 'volume' }];
    expect(mergePersonalBests(serverPBs, clientPRs).map((p) => p.exercise_id)).toEqual([2]);
  });

  it('returns an empty list for invalid server input', () => {
    expect(mergePersonalBests(null, [])).toEqual([]);
    expect(mergePersonalBests(undefined, [{ exercise_id: 1, type: 'volume' }])).toEqual([]);
  });
});
