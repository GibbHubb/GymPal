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
import { auditFiles, scanSource, countA11yProps, CORE_SCREENS, G61_SCREENS } from '../../scripts/a11y_audit.mjs';
import { audit, contrast, styleBlock, PAIRS } from '../../scripts/contrast_audit.mjs';

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
