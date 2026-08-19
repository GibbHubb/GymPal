// G38 — the server now computes PR baselines in SQL instead of the client
// reducing a full history with prMath. That split is only safe while the two
// agree, so this pins the SQL's formulas against the JS reference.
//
// The SQL (workoutsController.getPrBaselines) is:
//   best_volume = MAX(CASE WHEN weight>0 AND reps>0 THEN weight*reps END)
//   best_1rm    = MAX(CASE WHEN weight>0 AND reps>0 THEN weight*(1+reps/30.0) END)
//   COALESCE(..., 0), grouped per exercise
//
// `sqlBaseline` below is a faithful transcription. If someone edits the query,
// this test should be updated in the same commit — and if the transcription
// and the query drift, the parity assertions here are what catch the maths
// having changed meaning.

import { describe, it, expect } from 'vitest';
import { epley1RM, setVolume, bestEpleyOfRows, bestVolumeOfRows } from '../prMath';

/** Transcription of the server-side aggregate, row-for-row. */
function sqlBaseline(rows) {
  const valid = rows.filter((r) => r.weight > 0 && r.reps > 0);
  return {
    entry_count: rows.length,
    best_volume: valid.length ? Math.max(...valid.map((r) => r.weight * r.reps)) : 0,
    best_1rm: valid.length
      ? Math.max(...valid.map((r) => r.weight * (1 + r.reps / 30)))
      : 0,
  };
}

describe('G38 — SQL baseline matches the prMath reference', () => {
  const cases = [
    { name: 'typical mixed history', rows: [
      { weight: 100, reps: 5 }, { weight: 80, reps: 10 }, { weight: 120, reps: 3 },
    ] },
    { name: 'single row', rows: [{ weight: 60, reps: 8 }] },
    { name: 'zero reps are ignored', rows: [{ weight: 150, reps: 0 }, { weight: 100, reps: 5 }] },
    { name: 'zero weight is ignored', rows: [{ weight: 0, reps: 8 }, { weight: 100, reps: 5 }] },
    { name: 'negatives are ignored', rows: [{ weight: -10, reps: 5 }, { weight: 100, reps: -5 }] },
    { name: 'only invalid rows', rows: [{ weight: 0, reps: 5 }, { weight: 50, reps: 0 }] },
    { name: 'empty history', rows: [] },
  ];

  for (const { name, rows } of cases) {
    it(`agrees on volume — ${name}`, () => {
      expect(sqlBaseline(rows).best_volume).toBe(bestVolumeOfRows(rows));
    });
    it(`agrees on 1RM — ${name}`, () => {
      expect(sqlBaseline(rows).best_1rm).toBeCloseTo(bestEpleyOfRows(rows), 9);
    });
  }

  it('takes the two maxima independently — they can come from different rows', () => {
    // This is the property a naive "best set" single-row query would break.
    const rows = [
      { weight: 80, reps: 10 },  // volume 800, 1RM 106.67
      { weight: 120, reps: 3 },  // volume 360, 1RM 132.00
    ];
    const b = sqlBaseline(rows);
    expect(b.best_volume).toBe(setVolume(80, 10));
    expect(b.best_1rm).toBeCloseTo(epley1RM(120, 3), 9);
    // Verified identically against real Postgres: best_volume 800, best_1rm 132.
    expect(b.best_volume).toBe(800);
    expect(b.best_1rm).toBeCloseTo(132, 9);
  });

  it('an exercise with no rows yields no baseline, so no first-ever PR fires', () => {
    // The endpoint GROUP BYs, so an exercise with zero rows is simply absent
    // from the response; the client treats absent as "no baseline".
    expect(sqlBaseline([]).entry_count).toBe(0);
  });
});
