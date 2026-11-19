// G53 — accessibility and brand-colour checks that run without a device:
// 1. every Touchable/Pressable/CustomButton on the five core screens carries an
//    accessibilityLabel AND accessibilityRole; every text field / picker an accessibilityLabel;
// 2. every declared text/background pair meets WCAG AA (4.5:1, or 3:1 for large text);
// 3. exactly one gold: no gold hex or gold rgba() literal outside constants/Theme.js.
// The TalkBack pass on a phone is still the final word on (1).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { auditFiles, scanSource, countA11yProps, CORE_SCREENS } from '../../scripts/a11y_audit.mjs';
import { audit, contrast, PAIRS } from '../../scripts/contrast_audit.mjs';

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
    const failing = audit().filter((r) => !r.pass).map((r) => `${r.file} ${r.style} ${r.ratio.toFixed(2)}:1`);
    expect(failing).toEqual([]);
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
