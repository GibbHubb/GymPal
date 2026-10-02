// G52 — the list-screen defects, as checks that run without a device.
//
// 1. No vertical FlatList/SectionList is opened inside a vertical ScrollView or a
//    `<ScreenWrapper scrollable>` (which renders one). A static scan of the JSX: it cannot
//    see nesting across component boundaries, so the Metro-console walk on a device stays
//    the final word (held), but it catches the shape that shipped in TrainingScreen.
// 2. The exercise filter has no cap: a search with more than 20 matches returns all of them.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { filterExercises, exerciseKey } from '../exerciseFilter.js';

const ROOT = path.join(__dirname, '..', '..');

function jsFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = path.join(dir, d.name);
    if (d.isDirectory()) return jsFiles(rel);
    return d.name.endsWith('.js') ? [rel] : [];
  });
}

/** Lines where a vertical virtualized list opens inside a vertical scroll container. */
/** The attribute text of a JSX tag starting at `from`, honouring `{...}` (which may hold `=>`). */
function readAttrs(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) {
      const selfClosing = src[i - 1] === '/';
      return { attrs: src.slice(from, selfClosing ? i - 1 : i), selfClosing, end: i + 1 };
    }
  }
  return { attrs: src.slice(from), selfClosing: false, end: src.length };
}

export function nestedVirtualizedLists(src) {
  const tagRe = /<(\/?)(ScrollView|ScreenWrapper|FlatList|SectionList)\b/g;
  const stack = [];
  const hits = [];
  let m;
  while ((m = tagRe.exec(src))) {
    const [, closing, tag] = m;
    const { attrs, selfClosing, end } = readAttrs(src, tagRe.lastIndex);
    tagRe.lastIndex = end;
    const line = src.slice(0, m.index).split('\n').length;
    const horizontal = /\bhorizontal\b(?!\s*=\s*\{\s*false)/.test(attrs);
    if (tag === 'FlatList' || tag === 'SectionList') {
      if (!closing && !horizontal && stack.some((s) => s.scrolls)) hits.push(line);
      continue;
    }
    if (closing) { stack.pop(); continue; }
    if (selfClosing) continue;
    const scrolls = tag === 'ScrollView'
      ? !horizontal
      : /\bscrollable\b(?!\s*=\s*\{\s*false)/.test(attrs);
    stack.push({ tag, scrolls });
  }
  return hits;
}

describe('no nested vertical virtualized lists (criterion 1, static)', () => {
  const files = [...jsFiles('screens'), ...jsFiles('components')];

  it('scans a real number of files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  for (const f of files) {
    it(f, () => {
      expect(nestedVirtualizedLists(fs.readFileSync(path.join(ROOT, f), 'utf8'))).toEqual([]);
    });
  }

  it('control: the shape TrainingScreen shipped with is caught', () => {
    const shipped = `
      <ScrollView contentContainerStyle={styles.container}>
        <TextInput />
        {q && (<FlatList data={rows} renderItem={r} />)}
      </ScrollView>`;
    expect(nestedVirtualizedLists(shipped)).toHaveLength(1);
    expect(nestedVirtualizedLists('<ScreenWrapper scrollable={true}><FlatList data={a} /></ScreenWrapper>'))
      .toHaveLength(1);
    // Allowed: horizontal lists, and a non-scrolling wrapper.
    expect(nestedVirtualizedLists('<ScrollView><FlatList horizontal data={a} /></ScrollView>')).toEqual([]);
    expect(nestedVirtualizedLists('<ScreenWrapper scrollable={false}><FlatList data={a} /></ScreenWrapper>'))
      .toEqual([]);
  });
});

describe('the exercise filter (criterion 2)', () => {
  const pool = Array.from({ length: 500 }, (_, i) => ({
    exercise_id: i + 1, name: i % 10 === 0 ? `Squat variation ${i}` : `Exercise ${i}`,
  }));

  it('returns EVERY match: 50 squats out of 500, not the first 20', () => {
    const hits = filterExercises(pool, 'squat');
    expect(hits).toHaveLength(50);
    expect(hits.every((e) => e.name.toLowerCase().includes('squat'))).toBe(true);
  });

  it('is case-insensitive, trims, and handles the string entries of the pool', () => {
    expect(filterExercises(['Bench Press', 'Deadlift'], '  BENCH ')).toEqual(['Bench Press']);
  });

  it('an empty query matches nothing (TrainingScreen hides the results)', () => {
    expect(filterExercises(pool, '')).toEqual([]);
  });

  it('keys are unique across a pool with repeated names', () => {
    const dup = [{ exercise_id: 1, name: 'Row' }, { exercise_id: 2, name: 'Row' }, 'Row'];
    expect(new Set(dup.map(exerciseKey)).size).toBe(3);
  });

  it('control: ProgressScreen no longer slices the matches', () => {
    const src = fs.readFileSync(path.join(ROOT, 'screens/Client/ProgressScreen.js'), 'utf8');
    expect(src).not.toMatch(/filteredExercises\.slice\(/);
  });
});
