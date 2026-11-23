// G53 — accessibility and brand-colour checks that run without a device:
// 1. every Touchable/Pressable/CustomButton on the five core screens carries an
//    accessibilityLabel AND accessibilityRole; every text field / picker an accessibilityLabel;
// 2. every declared text/background pair meets WCAG AA (4.5:1, or 3:1 for large text);
// 3. exactly one gold: no gold hex or gold rgba() literal outside constants/Theme.js.
// The TalkBack pass on a phone is still the final word on (1).
// G61 — (1) extends to every other routed screen and the heatmap cell; (2) is bound to the
// source, so a changed `color:` fails; the PB/PR Dismiss pill stays compact with a 44pt target.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  auditFiles, scanSource, countA11yProps, CORE_SCREENS, G61_SCREENS, AUDITED,
  targetSizes, optOuts, uncoveredScreens, NOT_SCREENS, MIN_TARGET,
} from '../../scripts/a11y_audit.mjs';
import { activateAndLongPress, a11yActionHandler } from '../a11yActions';
import { say, sayCount, sayDate, UNKNOWN } from '../a11yText';
import { audit, contrast, styleBlock, PAIRS, loadTheme } from '../../scripts/contrast_audit.mjs';

const ROOT = path.join(__dirname, '..', '..');

function jsFiles(dir) {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((d) => {
    const rel = path.join(dir, d.name);
    if (d.isDirectory()) return jsFiles(rel);
    return d.name.endsWith('.js') ? [rel] : [];
  });
}

describe('screen-reader labels on the core screens', () => {
  it('the scanner flags an unlabelled Touchable and passes a labelled one', () => {
    const src = `
      <TouchableOpacity onPress={() => go()} style={s.a}><Text>x</Text></TouchableOpacity>
      <TouchableOpacity onPress={() => go()} accessibilityRole="button" accessibilityLabel="Go">
      <TextInput placeholder="Sets" />
      <CustomButton title="Go" accessibilityLabel="Go" />`;
    const items = scanSource(src);
    expect(items.map((i) => i.missing)).toEqual([
      ['accessibilityLabel', 'accessibilityRole'],
      [],
      ['accessibilityLabel'],
      ['accessibilityRole'],
    ]);
  });

  it.each(CORE_SCREENS)('%s has no unlabelled interactive element', (file) => {
    const [row] = auditFiles([file]);
    expect(row.items.length).toBeGreaterThan(0);
    expect(row.unlabelled.map((u) => `line ${u.line} <${u.tag}> missing ${u.missing.join(', ')}`)).toEqual([]);
  });

  it('the app carries at least 60 accessibility props (G53 target; was 6)', () => {
    expect(countA11yProps()).toBeGreaterThanOrEqual(60);
  });
});

describe('G61 — screen-reader labels on every other routed screen', () => {
  it.each(G61_SCREENS)('%s has no unlabelled interactive element', (file) => {
    const [row] = auditFiles([file]);
    expect(row.items.length).toBeGreaterThan(0);
    expect(row.unlabelled.map((u) => `line ${u.line} <${u.tag}> missing ${u.missing.join(', ')}`)).toEqual([]);
  });

  it('accessible={false} is an explicit opt-out; anything else still needs label + role', () => {
    const items = scanSource(`
      <TouchableOpacity style={s.backdrop} accessible={false} onPress={close}>
      <TouchableOpacity accessible={true} onPress={go}>
      <TextInput accessible={false} />`);
    expect(items.map((i) => i.missing)).toEqual([[], ['accessibilityLabel', 'accessibilityRole'], []]);
  });

  it('the heatmap cell announces as a button', () => {
    const [row] = auditFiles(['components/VolumeHeatmapCell.js']);
    expect(row.items).toHaveLength(1);
    expect(row.items[0].missing).toEqual([]);
  });
});

describe('G61 review — honest roles, reachable actions, no "undefined" read aloud', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

  it('a11yActionHandler runs the named action and ignores unknown ones', () => {
    const calls = [];
    const handle = a11yActionHandler({ activate: () => calls.push('a'), longpress: () => calls.push('l') });
    handle({ nativeEvent: { actionName: 'activate' } });
    handle({ nativeEvent: { actionName: 'longpress' } });
    handle({ nativeEvent: { actionName: 'magicTap' } });
    handle(undefined);
    expect(calls).toEqual(['a', 'l']);
    expect(activateAndLongPress('Link')).toEqual([{ name: 'activate' }, { name: 'longpress', label: 'Link' }]);
  });

  it('CreateWorkout superset chip: screen-reader activate/longpress run the same handlers as tap/long press', () => {
    const src = read('screens/Trainer/CreateWorkout.js');
    expect(src).toMatch(/const handleExerciseChange = /); // was called but never defined
    const chip = scanSource(src).find((i) => /Superset, exercise/.test(i.attrs)).attrs;
    expect(chip).toMatch(/onPress=\{\(\) => toggleSupersetKind\(index, exercise\)\}/);
    expect(chip).toMatch(/onLongPress=\{\(\) => toggleLinkPrevious\(index, exercise\)\}/);
    expect(chip).toMatch(/activate: \(\) => toggleSupersetKind\(index, exercise\)/);
    expect(chip).toMatch(/longpress: \(\) => toggleLinkPrevious\(index, exercise\)/);
    expect(chip).toMatch(/accessibilityActions=\{activateAndLongPress\(/);
    // `checked` reports what activate toggles (group_kind), not the long-press link
    expect(chip).toMatch(/accessibilityState=\{\{ checked: exercise\.group_kind === 'superset' \}\}/);
  });

  it('ProgramBuilder modals can be escaped by VoiceOver and the picker has a visible Close', () => {
    const src = read('screens/Trainer/ProgramBuilderScreen.js');
    const cards = scanSource(src).filter((i) => /style=\{styles\.modalCard\}/.test(i.attrs));
    expect(cards).toHaveLength(2);
    for (const c of cards) {
      expect(c.attrs).toMatch(/accessibilityViewIsModal/);
      expect(c.attrs).toMatch(/onAccessibilityEscape=\{\(\) => set(PickerCell\(null\)|ShowAssign\(false\))\}/);
    }
    expect(src).toMatch(/accessibilityLabel="Close the template picker"/);
  });

  it('no button-role element reports a checked state (checked belongs to switch/checkbox/radio/togglebutton)', () => {
    const bad = AUDITED.flatMap((f) => scanSource(read(f))
      .filter((i) => /accessibilityRole="button"/.test(i.attrs) && /accessibilityState=\{\{[^}]*checked/.test(i.attrs))
      .map((i) => `${f}:${i.line}`));
    expect(bad).toEqual([]);
  });

  it('say/sayCount/sayDate never produce undefined, null, NaN or Invalid Date', () => {
    for (const v of [undefined, null, '', '  ', NaN, Infinity]) expect(say(v)).toBe(UNKNOWN);
    expect(say('Bob')).toBe('Bob');
    expect(say(0)).toBe('0');
    expect(sayCount(1, 'week')).toBe('1 week');
    expect(sayCount(3, 'week')).toBe('3 weeks');
    expect(sayCount('4', 'week')).toBe('4 weeks');
    expect(sayCount(undefined, 'week')).toBe('unknown number of weeks');
    expect(sayCount(NaN, 'week')).toBe('unknown number of weeks');
    expect(sayDate(undefined)).toBe('unknown date');
    expect(sayDate('not a date')).toBe('unknown date');
    expect(sayDate('2026-11-21')).not.toMatch(/Invalid|undefined/);
  });

  it('G61 labels never interpolate a raw data field (wrap it in say/sayCount/sayDate)', () => {
    // a `${a.b}` member access straight into a label could read "undefined"; .length of a state
    // array and loop indices are fine.
    const rawFields = (src) => {
      const out = [];
      for (const m of src.matchAll(/(?:accessibilityLabel|label)=\{`([^`]*)`\}/g)) {
        for (const e of m[1].matchAll(/\$\{([^}]*)\}/g)) {
          const expr = e[1].trim();
          if (/^[\w$]+(\??\.[\w$]+)+$/.test(expr) && !/\.length$/.test(expr)) out.push(expr);
        }
      }
      return out;
    };
    // the check bites: raw fields are caught, wrapped ones and .length are not
    expect(rawFields('<X accessibilityLabel={`Open ${item.name}, ${item.total_weeks} weeks, ${say(item.role)}, ${list.length}`} />'))
      .toEqual(['item.name', 'item.total_weeks']);
    expect(G61_SCREENS.flatMap((f) => rawFields(read(f)).map((e) => `${f}: ${e}`))).toEqual([]);
  });
});

describe('G61 — PB/PR Dismiss is a compact pill with a 44pt touch area', () => {
  const src = fs.readFileSync(path.join(ROOT, 'screens/Client/TrainingScreen.js'), 'utf8');
  const height = Number(src.match(/const PB_DISMISS_HEIGHT = (\d+)/)[1]);
  const slop = src.match(/const PB_DISMISS_HIT_SLOP = \{ top: (\d+), bottom: (\d+)/);

  it('the drawn pill is under 32pt and has no 44pt minHeight', () => {
    const block = styleBlock(src, 'pbBannerDismiss');
    expect(block).toMatch(/height:\s*PB_DISMISS_HEIGHT/);
    expect(block).not.toMatch(/minHeight/);
    expect(height).toBeLessThan(32);
  });

  it('height + hitSlop reaches 44pt, on both the PB and the PR Dismiss', () => {
    expect(height + Number(slop[1]) + Number(slop[2])).toBeGreaterThanOrEqual(44);
    // both Dismiss touchables (PB and PR banners) use the pill style and carry the slop next to it
    expect(src.match(/style=\{styles\.pbBannerDismiss\}/g)).toHaveLength(2);
    expect(src.match(/style=\{styles\.pbBannerDismiss\}\s*hitSlop=\{PB_DISMISS_HIT_SLOP\}/g)).toHaveLength(2);
  });
});

describe('G63 — 44pt targets, opt-outs only on backdrops, every screen audited', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const sheet = (body) => `\nconst styles = StyleSheet.create({ ${body} });\n`;
  const one = (jsx, body = '') => targetSizes(`${jsx}${sheet(body)}`)[0];

  it('a bare text button is flagged; hitSlop or min sizes clear it', () => {
    const remove = `<TouchableOpacity accessibilityRole="button" accessibilityLabel="Remove" onPress={() => go()}><Text style={styles.t}>Remove</Text></TouchableOpacity>`;
    expect(one(remove, 't: { fontSize: 14 }').small).toBe(true);
    const slopped = remove.replace('onPress=', 'hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }} onPress=');
    expect(one(slopped, 't: { fontSize: 14 }').small).toBe(false);
    const named = `const SLOP = { top: 14, bottom: 14, left: 8, right: 8 };\n${remove.replace('onPress=', 'hitSlop={SLOP} onPress=')}`;
    expect(one(named, 't: { fontSize: 14 }').small).toBe(false);
    const sized = remove.replace('onPress=', 'style={styles.b} onPress=');
    expect(one(sized, 't: { fontSize: 14 }, b: { minHeight: 44, minWidth: 44 }').small).toBe(false);
  });

  it('a declared height under 44 fails; a conditional style does not rescue it; a ternary takes the smaller', () => {
    const box = (style) => `<TouchableOpacity style={${style}} onPress={f} />`;
    expect(one(box('styles.a'), 'a: { height: 30, width: 60 }').small).toBe(true);
    expect(one(box('[styles.a, big && styles.b]'), 'a: { height: 30, width: 60 }, b: { height: 60 }').small).toBe(true);
    expect(one(box('on ? styles.b : styles.a'), 'a: { height: 30, width: 60 }, b: { height: 60, width: 60 }').small).toBe(true);
    expect(one(box('styles.b'), 'b: { height: 60, width: 60, shadowOffset: { width: 0, height: 2 } }').small).toBe(false);
  });

  it('a side it cannot estimate is reported as unsized, not passed or failed', () => {
    const r = one(`<TouchableOpacity style={styles.a} onPress={f}><Text style={styles.t}>{name}</Text></TouchableOpacity>`,
      "a: { padding: 14, width: '48%' }, t: { fontSize: 14 }");
    expect(r.small).toBe(false);
    expect(r.unsized).toEqual(['width']);
    expect(r.h).toBeCloseTo(14 * 2 + 14 * 1.2, 5);
  });

  it(`every tappable on the audited files reaches ${MIN_TARGET}pt (box + hitSlop)`, () => {
    const small = AUDITED.flatMap((f) => targetSizes(read(f), f).filter((s) => s.small).map((s) => `${f}:${s.line}`));
    expect(small).toEqual([]);
  });

  it('the targets named in G63 reach 44pt by hitSlop or min size, not by a quirk of the estimate', () => {
    const slopped = (f) => targetSizes(read(f), f).filter((s) => s.slop && (s.slop.v > 0 || s.slop.h > 0));
    expect(slopped('screens/Trainer/CreateWorkout.js').length).toBeGreaterThanOrEqual(3); // Remove + 2 chips
    expect(read('screens/Trainer/CreateWorkout.js')).toMatch(/removeExercise\(index\)\} hitSlop=\{REMOVE_HIT_SLOP\}/);
    expect(read('screens/Trainer/CreateWorkout.js').match(/hitSlop=\{CHIP_HIT_SLOP\}/g)).toHaveLength(2);
    expect(read('screens/Trainer/EditWorkout.js')).toMatch(/style=\{styles\.removeIcon\} hitSlop=\{REMOVE_ICON_HIT_SLOP\}/);
    expect(read('screens/Trainer/TrainerScreen.js')).toMatch(/handleDeleteTemplate\(t\.id\)\} hitSlop=/);
    expect(read('screens/Trainer/TrainerScreen.js')).toMatch(/hitSlop=\{COMPACT_HIT_SLOP\} onPress=\{\(\) => setShowSaveModal\(false\)\}/);
  });

  it('accessible={false} is allowed only on a marked backdrop or an allowlisted element', () => {
    expect(optOuts('<TouchableOpacity accessible={false} onPress={close}>')[0].allowed).toBe(false);
    expect(optOuts('<TouchableOpacity /* a11y-backdrop */ accessible={false} onPress={close}>')[0].allowed).toBe(true);
    const bad = AUDITED.flatMap((f) => optOuts(read(f), f).filter((o) => !o.allowed).map((o) => `${f}:${o.line}`));
    expect(bad).toEqual([]);
    // the two ProgramBuilder modals: backdrop + press-swallowing card each
    expect(optOuts(read('screens/Trainer/ProgramBuilderScreen.js'), 'screens/Trainer/ProgramBuilderScreen.js')).toHaveLength(4);
  });

  it('every file under screens/ is audited or listed as not a screen, and the list does not rot', () => {
    expect(uncoveredScreens()).toEqual([]);
    expect(uncoveredScreens(AUDITED.filter((f) => f !== 'screens/Logout.js'))).toEqual(['screens/Logout.js']);
    for (const f of Object.keys(NOT_SCREENS)) {
      expect(fs.existsSync(path.join(ROOT, f)), f).toBe(true);
      expect(AUDITED, f).not.toContain(f);
    }
  });
});

describe('WCAG contrast', () => {
  it('computes known ratios', () => {
    expect(contrast('#FFFFFF', ['#000000'])).toBeCloseTo(21, 5);
    expect(contrast('#FFFFFF', ['#F6B000'])).toBeLessThan(2); // the shipped Logout bug
  });

  it('every audited style key still exists in its file', () => {
    for (const [file, style] of PAIRS) {
      const key = style.split(' ')[0];
      const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
      if (/^[a-z]\w*$/.test(key) && !['chip', 'chart', 'DeloadBanner'].includes(key)) {
        expect(src, `${file}: ${key}`).toMatch(new RegExp(`\\b${key}\\s*:`));
      }
    }
  });

  it('every declared text/background pair passes AA', () => {
    const failing = audit().filter((r) => !r.pass).map((r) => `${r.file} ${r.style} ${r.result} ${r.ratio.toFixed(2)}:1 ${r.note}`);
    expect(failing).toEqual([]);
  });
});

describe('G61 — contrast pairs are bound to the source colour', () => {
  const disk = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  /** A reader that serves `file` with `from` replaced by `to` (must match exactly once). */
  const mutated = (file, from, to) => (f) => {
    const src = disk(f);
    if (f !== file) return src;
    expect(src.split(from).length - 1, `${file}: ${from}`).toBe(1);
    return src.replace(from, to);
  };
  const row = (rows, file, style) => rows.find((r) => r.file === file && r.style === style);

  it('every pair resolves its text colour from the source and matches the table', () => {
    const rows = audit();
    expect(rows.filter((r) => r.result === 'UNBOUND').map((r) => `${r.file} ${r.style}: ${r.note}`)).toEqual([]);
    expect(rows.filter((r) => r.result.includes('DRIFT')).map((r) => `${r.file} ${r.style}: ${r.note}`)).toEqual([]);
  });

  it('a style recoloured to a failing colour fails the audit (white on gold, the Logout bug)', () => {
    const rows = audit(PAIRS, mutated('screens/Logout.js',
      "buttonText: { color: Theme.colors.onPrimary", "buttonText: { color: '#FFFFFF'"));
    const r = row(rows, 'screens/Logout.js', 'buttonText');
    expect(r.pass).toBe(false);
    expect(r.result).toBe('FAIL + DRIFT');
    expect(r.ratio).toBeLessThan(2);
  });

  it('any recolour, even a passing one, fails as DRIFT until the table is re-checked', () => {
    const rows = audit(PAIRS, mutated('screens/Login.js',
      'color: Theme.colors.textSecondary', 'color: Theme.colors.text'));
    const r = row(rows, 'screens/Login.js', 'subtext');
    expect(r.result).toBe('DRIFT');
    expect(r.pass).toBe(false);
  });

  it('placeholder, chip, inline and chart bindings follow the source too', () => {
    const cases = [
      ['components/CustomInput.js', 'input (placeholder)', 'placeholderTextColor={Theme.colors.textSecondary}', "placeholderTextColor={'#444444'}"],
      ['screens/Trainer/TrainerDashboard.js', 'chip green', "bg: '#dcfce7'", "bg: '#22c55e'"],
      ['screens/Client/ClientHome.js', 'DeloadBanner reason', "color: '#78350f'", "color: '#fbbf24'"],
    ];
    for (const [file, style, from, to] of cases) {
      expect(row(audit(PAIRS, mutated(file, from, to)), file, style).pass, `${file} ${style}`).toBe(false);
    }
    const chart = (f) => (f === 'screens/Client/ProgressScreen.js' ? disk(f).replaceAll('rgba(255, 255, 255, ${opacity})', 'rgba(40, 40, 40, ${opacity})') : disk(f));
    expect(row(audit(PAIRS, chart), 'screens/Client/ProgressScreen.js', 'chart labelColor').pass).toBe(false);
  });

  it('a colour the reader cannot resolve fails as UNBOUND instead of passing', () => {
    const rows = audit(PAIRS, mutated('screens/Logout.js',
      'buttonText: { color: Theme.colors.onPrimary', 'buttonText: { color: someVariable'));
    expect(row(rows, 'screens/Logout.js', 'buttonText').result).toBe('UNBOUND');
  });
});

describe('G62 — contrast table covers the G61 screens, backgrounds bound to source', () => {
  const disk = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');
  const mutated = (file, from, to) => (f) => {
    const src = disk(f);
    if (f !== file) return src;
    expect(src.split(from).length - 1, `${file}: ${from}`).toBe(1);
    return src.replace(from, to);
  };
  const row = (rows, file, style) => rows.find((r) => r.file === file && r.style === style);
  const LB = 'screens/Client/LeaderboardScreen.js';

  it('every G61 screen has rows in the table', () => {
    const tabled = new Set(PAIRS.map(([file]) => file));
    const screens = G61_SCREENS.filter((f) => f.startsWith('screens/'));
    expect(screens.filter((f) => !tabled.has(f))).toEqual([]);
  });

  it('the Leaderboard opt-in/out button passes AA: dark on gold, white on the strong red', () => {
    const rows = audit();
    for (const style of ['optInText', 'optOutText']) {
      const r = row(rows, LB, style);
      expect(r.result, style).toBe('pass');
      expect(r.ratio, style).toBeGreaterThanOrEqual(4.5);
      expect(r.bgFrom, style).toMatch(/^opt(In|Out)Button$/);
    }
  });

  it('most rows read their background from source (floor, so bindings are not quietly dropped)', () => {
    const bound = audit().filter((r) => r.bgFrom !== 'declared');
    expect(bound.length).toBeGreaterThanOrEqual(150);
  });

  it('a button fill recoloured back to the shipped bug fails (white on #FF4C4C)', () => {
    const r = row(audit(PAIRS, mutated(LB,
      'optOutButton: { backgroundColor: Theme.colors.dangerStrong }',
      'optOutButton: { backgroundColor: Theme.colors.error }')), LB, 'optOutText');
    expect(r.result).toBe('FAIL + DRIFT');
    expect(r.ratio).toBeLessThan(4.5);
  });

  it('any background recolour, even a passing one, fails as DRIFT until the table is re-checked', () => {
    const r = row(audit(PAIRS, mutated(LB,
      'optInButton: { backgroundColor: Theme.colors.primary }',
      "optInButton: { backgroundColor: '#FFFFFF' }")), LB, 'optInText');
    expect(r.result).toBe('DRIFT');
  });

  it('a text style with its own fill and a runtime colour list are bound too', () => {
    const tv = 'screens/Trainer/TVScreen.js';
    const own = row(audit(PAIRS, mutated(tv, 'backgroundColor: "#fff1f0"', 'backgroundColor: "#ff9999"')), tv, 'timerWarning');
    expect(own.pass).toBe(false);
    const ts = 'screens/Trainer/TrainerScreen.js';
    const list = row(audit(PAIRS, mutated(ts, 'const groupColors = ["#fcc0d8"', 'const groupColors = ["#3a3a3a"')), ts, 'headerCell (group pink)');
    expect(list.result).toBe('FAIL + DRIFT');
  });

  it('an unreadable or missing background fails as UNBOUND instead of passing', () => {
    const ternary = row(audit(PAIRS, mutated(LB,
      'optInButton: { backgroundColor: Theme.colors.primary }',
      'optInButton: { backgroundColor: on ? Theme.colors.primary : Theme.colors.error }')), LB, 'optInText');
    expect(ternary.result).toBe('UNBOUND');
    const renamed = row(audit(PAIRS, mutated(LB, '  optInButton: {', '  optInFill: {')), LB, 'optInText');
    expect(renamed.result).toBe('UNBOUND');
  });

  // CustomButton always draws the gold gradient, so a `textStyle` colour other than onPrimary is
  // white-on-gold again (CreateWorkout's "+ Add Exercise" and Intake's "Back" shipped that way).
  const theme = loadTheme();
  const offGoldText = (src) => scanSource(src).filter((i) => i.tag === 'CustomButton').flatMap((i) => {
    const m = i.attrs.match(/textStyle=\{(\{[^}]*\}|styles\.(\w+))\}/);
    if (!m) return [];
    const body = m[2] ? styleBlock(src, m[2]) ?? '' : m[1];
    const c = body.match(/(?:^|[\s{,])color\s*:\s*([^,}\n]+)/);
    if (!c) return [];
    const expr = c[1].trim();
    const tok = expr.match(/^Theme\.colors\.(\w+)$/);
    const value = tok ? theme.colors[tok[1]] : expr.replace(/['"]/g, '');
    return value === theme.colors.onPrimary ? [] : [`line ${i.line}: ${expr}`];
  });

  it('the CustomButton text check catches white on the gold gradient', () => {
    expect(offGoldText(`<CustomButton onPress={() => go()} textStyle={{ color: '#fff' }} />`)).toHaveLength(1);
    expect(offGoldText(`<CustomButton onPress={() => go()} textStyle={{ color: Theme.colors.onPrimary }} />`)).toEqual([]);
  });

  it('no CustomButton overrides its text colour away from onPrimary', () => {
    const bad = ['screens', 'components'].flatMap(jsFiles)
      .flatMap((f) => offGoldText(fs.readFileSync(path.join(ROOT, f), 'utf8')).map((b) => `${f} ${b}`));
    expect(bad).toEqual([]);
  });
});

describe('one brand gold', () => {
  it('no gold hex or gold rgba() literal outside constants/Theme.js', () => {
    const gold = /#(f6b000|ffd700|f7bf0b)\b|rgba\(\s*(255,\s*215,\s*0|246,\s*176,\s*0|247,\s*191,\s*11)\s*,/i;
    const hits = ['screens', 'components', 'constants']
      .flatMap(jsFiles)
      .filter((f) => !f.replace(/\\/g, '/').endsWith('constants/Theme.js'))
      .flatMap((f) => fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n')
        .map((l, i) => (gold.test(l) ? `${f}:${i + 1}` : null))
        .filter(Boolean));
    expect(hits).toEqual([]);
  });
});
