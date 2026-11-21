// G53 — WCAG 2.x contrast audit for the five core screens (Login, ClientHome, TrainingScreen,
// TrainerDashboard, ProgressScreen) plus the components they render (CustomButton, CustomInput,
// CustomHeader, RestTimer) and Logout.
//
// The pairs below are declared by hand, one per text style, because the real background of a
// text style is rarely in the same StyleSheet entry: it comes from a parent View, a GlassCard, a
// gradient or a translucent overlay. Each pair names the file and the style key it describes
// (the test checks the key still exists), and `bg` is a list of layers composited bottom to top,
// so a translucent tint is measured over what it actually sits on.
//
// Gradients: the dark page gradient runs #0A0A0A -> #1C1C1C, so light text is measured against
// the lighter end (#1C1C1C, the worst case). The CustomButton gradient runs primary ->
// primaryDark and both ends are measured.
//
// G61 — the text colour is BOUND to the source. For each pair the audit reads the real colour
// from the file (by default the `color:` of the StyleSheet entry named by the pair's style key;
// see BINDINGS for the pairs that are not a style key), measures THAT colour, and also fails the
// row when it no longer equals the declared colour ("drift"), because the background is still
// hand-declared and has to be re-checked by a human whenever the text colour moves. A colour the
// reader cannot resolve fails as "unbound" rather than passing silently.
//
// Usage: node scripts/contrast_audit.mjs   (prints a markdown table, exits 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Load constants/Theme.js without a bundler: it is plain literals plus small helpers. */
export function loadTheme() {
  const src = fs.readFileSync(path.join(ROOT, 'constants', 'Theme.js'), 'utf8')
    .replace(/^export\s+(const|function)\s/gm, '$1 ');
  // eslint-disable-next-line no-new-func
  return new Function(`${src}\nreturn Theme;`)();
}

const THEME = loadTheme();

/** 'colors.primary' -> Theme.colors.primary; anything else is a literal colour. */
function resolve(c) {
  if (c.startsWith('colors.')) {
    const v = THEME.colors[c.slice(7)];
    if (!v) throw new Error(`unknown theme token ${c}`);
    return v;
  }
  return c;
}

/** -> {r,g,b,a} with r/g/b in 0..255 and a in 0..1 */
export function parseColor(input) {
  const c = resolve(input).trim();
  let m = c.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (m) {
    let h = m[1];
    if (h.length === 3) h = h.split('').map((x) => x + x).join('');
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
  }
  m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
  if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
  throw new Error(`cannot parse colour ${input}`);
}

/** Composite layers bottom to top; the bottom layer must be opaque. */
export function composite(layers) {
  const list = Array.isArray(layers) ? layers : [layers];
  let out = parseColor(list[0]);
  if (out.a !== 1) throw new Error(`bottom layer must be opaque: ${list[0]}`);
  for (const l of list.slice(1)) {
    const c = parseColor(l);
    out = {
      r: c.r * c.a + out.r * (1 - c.a),
      g: c.g * c.a + out.g * (1 - c.a),
      b: c.b * c.a + out.b * (1 - c.a),
      a: 1,
    };
  }
  return out;
}

function channel(v) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function luminance({ r, g, b }) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio of fg (may be translucent) over the composited bg layers. */
export function contrast(fg, bg) {
  const back = composite(bg);
  const front = composite([back, fg].map((c) => (typeof c === 'string' ? c : `rgb(${c.r},${c.g},${c.b})`)));
  const [hi, lo] = [luminance(front), luminance(back)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** WCAG "large text": >= 18pt (24px) or >= 14pt (18.67px) bold. RN sizes are dp, read as px. */
export function isLarge(size, bold) {
  return size >= 24 || (bold && size >= 18.67);
}

/** The theme gold at opacity a, for tints the code builds with primaryAlpha(a). */
function gold(a) {
  const { r, g, b } = parseColor('colors.primary');
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Shared backgrounds
const PAGE = '#1C1C1C';            // light end of Theme.colors.backgroundGradient (worst case)
const CARD = 'colors.surface';     // GlassCard
const WHITE = '#FFFFFF';           // TrainingScreen container
const TIMER_CARD = [WHITE, 'rgba(20, 20, 20, 0.92)']; // RestTimer card, rendered over TrainingScreen

// [file, styleKey, fg, bg layers, fontSize, bold]
export const PAIRS = [
  // Login
  ['screens/Login.js', 'header', 'colors.primary', [PAGE], 48, true],
  ['screens/Login.js', 'subtext', 'colors.textSecondary', [PAGE], 16, false],
  ['components/CustomInput.js', 'input', 'colors.text', [PAGE, 'colors.transparentLight'], 16, false],
  ['components/CustomInput.js', 'input (placeholder)', 'colors.textSecondary', [PAGE, 'colors.transparentLight'], 16, false],
  ['components/CustomButton.js', 'text', 'colors.onPrimary', ['colors.primary'], 16, true],
  ['components/CustomButton.js', 'text (gradient end)', 'colors.onPrimary', ['colors.primaryDark'], 16, true],
  // Logout (not routed today, fixed anyway: it is the shipped 1.9:1 case)
  ['screens/Logout.js', 'text', 'colors.text', ['colors.background'], 18, false],
  ['screens/Logout.js', 'buttonText', 'colors.onPrimary', ['colors.primary'], 14, true],
  // ClientHome
  ['screens/Client/ClientHome.js', 'title', 'colors.text', [PAGE], 34, true],
  ['screens/Client/ClientHome.js', 'logoutText', 'colors.error', ['colors.surface'], 14, true],
  ['screens/Client/ClientHome.js', 'todayLabel', 'colors.textSecondary', [PAGE, 'colors.primaryTint'], 11, true],
  ['screens/Client/ClientHome.js', 'todayTemplate', 'colors.text', [PAGE, 'colors.primaryTint'], 18, true],
  ['screens/Client/ClientHome.js', 'todayCta', 'colors.primary', [PAGE, 'colors.primaryTint'], 12, true],
  ['screens/Client/ClientHome.js', 'templatesHeader', 'colors.text', [PAGE], 16, true],
  ['screens/Client/ClientHome.js', 'templatesEmpty', 'colors.textSecondary', [PAGE], 13, false],
  ['screens/Client/ClientHome.js', 'templateName', 'colors.text', [PAGE, 'colors.primaryTint'], 15, true],
  ['screens/Client/ClientHome.js', 'templateMeta', 'colors.primary', [PAGE, 'colors.primaryTint'], 12, true],
  ['screens/Client/ClientHome.js', 'templateDeleteText', 'colors.error', [PAGE, 'rgba(229,57,53,0.12)'], 16, true],
  ['screens/Client/ClientHome.js', 'badgeText', '#FFFFFF', ['colors.dangerStrong'], 11, true],
  ['screens/Client/ClientHome.js', 'DeloadBanner title', '#92400e', ['#fef3c7'], 14, true],
  ['screens/Client/ClientHome.js', 'DeloadBanner reason', '#78350f', ['#fef3c7'], 12, false],
  // TrainingScreen (white page)
  ['screens/Client/TrainingScreen.js', 'backButtonText', 'colors.blueText', [WHITE], 16, true],
  ['screens/Client/TrainingScreen.js', 'title', 'colors.blueText', [WHITE], 26, true],
  ['screens/Client/TrainingScreen.js', 'input', '#1A1A1A', ['#f8f8f8'], 14, false],
  ['screens/Client/TrainingScreen.js', 'input (placeholder)', 'colors.placeholderOnLight', ['#f8f8f8'], 14, false],
  ['screens/Client/TrainingScreen.js', 'syncBadgeText', 'colors.onPrimary', ['colors.primary'], 13, true],
  ['screens/Client/TrainingScreen.js', 'syncBadgeText (synced)', 'colors.onPrimary', ['#4caf50'], 13, true],
  ['screens/Client/TrainingScreen.js', 'syncBadgeTextOnRed', '#FFFFFF', ['colors.dangerStrong'], 13, true],
  ['screens/Client/TrainingScreen.js', 'liveBannerText', '#FFFFFF', ['colors.blue'], 14, true],
  ['screens/Client/TrainingScreen.js', 'liveExercisesTitle', 'colors.blueText', ['#eef4ff'], 14, true],
  ['screens/Client/TrainingScreen.js', 'liveExerciseItem', '#1A1A1A', ['#eef4ff'], 14, false],
  ['screens/Client/TrainingScreen.js', 'buttonText (Add)', 'colors.onPrimary', ['colors.primary'], 18, true],
  ['screens/Client/TrainingScreen.js', 'buttonText (template)', 'colors.onPrimary', ['colors.blueLight'], 18, true],
  ['screens/Client/TrainingScreen.js', 'buttonTextOnBlue', '#FFFFFF', ['colors.blue'], 18, true],
  ['screens/Client/TrainingScreen.js', 'buttonText (disabled)', 'colors.onPrimary', ['#ccc'], 18, true],
  ['screens/Client/TrainingScreen.js', 'modalTitle', 'colors.blueText', [WHITE], 18, true],
  ['screens/Client/TrainingScreen.js', 'modalCancelText', '#1A1A1A', ['#eee'], 16, true],
  ['screens/Client/TrainingScreen.js', 'searchText', '#1A1A1A', [WHITE], 16, false],
  ['screens/Client/TrainingScreen.js', 'summaryText', '#1A1A1A', [WHITE], 16, true],
  ['screens/Client/TrainingScreen.js', 'pbBannerTitle', 'colors.onPrimary', ['colors.primary'], 16, true],
  ['screens/Client/TrainingScreen.js', 'pbBannerItem', 'colors.onPrimary', ['colors.primary'], 13, true],
  ['screens/Client/TrainingScreen.js', 'pbBannerDismissText', 'colors.primary', ['colors.onPrimary'], 12, true],
  ['screens/Client/TrainingScreen.js', 'prBannerItem', '#1A1A1A', ['#e8f0fe'], 13, true],
  ['components/RestTimer.js', 'time', 'colors.primary', TIMER_CARD, 44, true],
  ['components/RestTimer.js', 'label', '#94a3b8', TIMER_CARD, 11, false],
  ['components/RestTimer.js', 'btnSmallText', '#f8fafc', [...TIMER_CARD, 'rgba(255,255,255,0.08)'], 13, true],
  ['components/RestTimer.js', 'btnSkipText', '#fca5a5', [...TIMER_CARD, 'rgba(248, 113, 113, 0.18)'], 13, true],
  ['components/RestTimer.js', 'doneText', '#22c55e', TIMER_CARD, 20, true],
  ['components/RestTimer.js', 'doneSub', '#94a3b8', TIMER_CARD, 13, false],
  ['components/RestTimer.js', 'btnPrimaryText', 'colors.onPrimary', ['colors.primary'], 14, true],
  // TrainerDashboard
  ['components/CustomHeader.js', 'headerTitle', 'colors.primary', ['colors.background'], 18, true],
  ['components/CustomHeader.js', 'backButtonText', 'colors.primary', ['colors.surface'], 20, true],
  ['screens/Trainer/TrainerDashboard.js', 'username', 'colors.text', [CARD], 18, true],
  ['screens/Trainer/TrainerDashboard.js', 'chip green', '#166534', ['#dcfce7'], 10, true],
  ['screens/Trainer/TrainerDashboard.js', 'chip amber', '#92400e', ['#fef3c7'], 10, true],
  ['screens/Trainer/TrainerDashboard.js', 'chip red', '#991b1b', ['#fee2e2'], 10, true],
  ['screens/Trainer/TrainerDashboard.js', 'chip no_plan', '#475569', ['#e2e8f0'], 10, true],
  ['screens/Trainer/TrainerDashboard.js', 'inactiveBadgeText', '#FFFFFF', ['colors.dangerStrong'], 10, true],
  ['screens/Trainer/TrainerDashboard.js', 'statValue', 'colors.primary', [CARD], 16, true],
  ['screens/Trainer/TrainerDashboard.js', 'statLabel', 'colors.textSecondary', [CARD], 10, false],
  ['screens/Trainer/TrainerDashboard.js', 'emptyText', 'colors.textSecondary', [PAGE], 16, false],
  ['screens/Trainer/TrainerDashboard.js', 'errorText', 'colors.error', [PAGE], 14, false],
  ['screens/Trainer/TrainerDashboard.js', 'retryText', 'colors.onPrimary', ['colors.primary'], 13, true],
  // ProgressScreen
  ['screens/Client/ProgressScreen.js', 'tabText', 'colors.textSecondary', [PAGE, 'colors.transparentLight'], 13, true],
  ['screens/Client/ProgressScreen.js', 'tabTextActive', 'colors.onPrimary', ['colors.primary'], 13, true],
  ['screens/Client/ProgressScreen.js', 'label', 'colors.primary', [CARD], 13, true],
  ['screens/Client/ProgressScreen.js', 'searchInput', 'colors.text', [CARD, 'colors.transparentLight'], 14, false],
  ['screens/Client/ProgressScreen.js', 'searchInput (placeholder)', 'colors.textSecondary', [CARD, 'colors.transparentLight'], 14, false],
  ['screens/Client/ProgressScreen.js', 'exerciseItemText', 'colors.text', [CARD], 14, false],
  ['screens/Client/ProgressScreen.js', 'exerciseItemTextActive', 'colors.primary', [CARD, gold(0.15)], 14, true],
  ['screens/Client/ProgressScreen.js', 'chartTitle', 'colors.text', [PAGE], 18, true],
  ['screens/Client/ProgressScreen.js', 'noDataText', 'colors.textSecondary', [PAGE], 16, false],
  ['screens/Client/ProgressScreen.js', 'infoText', 'colors.primary', [PAGE, gold(0.05)], 14, false],
  ['screens/Client/ProgressScreen.js', 'legendText', 'colors.textSecondary', [PAGE], 12, false],
  ['screens/Client/ProgressScreen.js', 'metricSubmitText', 'colors.onPrimary', ['colors.primary'], 13, true],
  ['screens/Client/ProgressScreen.js', 'chart labelColor', '#FFFFFF', [CARD], 12, false],
];

// G61 — where to read a pair's text colour when it is not the `color:` of the style key named
// by the pair. Keyed by `${file}::${style}`.
//   { prop: 'placeholderTextColor' }  every `placeholderTextColor={...}` in the file (must agree)
//   { fn: 'DeloadBanner', nth: 0 }    the nth `color:` inside `function DeloadBanner(`
//   { map: 'green' }                  `green: { bg: '...', fg: '...' }` (binds the bg too)
//   { chartLabel: true }              every chart-kit `labelColor: ... rgba(r, g, b, ...)` at opacity 1
const BINDINGS = {
  'components/CustomInput.js::input (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Client/TrainingScreen.js::input (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Client/ProgressScreen.js::searchInput (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Client/ClientHome.js::DeloadBanner title': { fn: 'DeloadBanner', nth: 0 },
  'screens/Client/ClientHome.js::DeloadBanner reason': { fn: 'DeloadBanner', nth: 1 },
  'screens/Trainer/TrainerDashboard.js::chip green': { map: 'green' },
  'screens/Trainer/TrainerDashboard.js::chip amber': { map: 'amber' },
  'screens/Trainer/TrainerDashboard.js::chip red': { map: 'red' },
  'screens/Trainer/TrainerDashboard.js::chip no_plan': { map: 'no_plan' },
  'screens/Client/ProgressScreen.js::chart labelColor': { chartLabel: true },
};

/** The text between the `{` at index `open` and its matching `}`. */
function balanced(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return null;
}

/** The body of StyleSheet entry `key` (first match after StyleSheet.create), or null. */
export function styleBlock(src, key) {
  const start = src.indexOf('StyleSheet.create(');
  if (start < 0) return null;
  const re = new RegExp(`(^|[\\s{,])${key}\\s*:\\s*\\{`, 'gm');
  re.lastIndex = start;
  const m = re.exec(src);
  return m ? balanced(src, m.index + m[0].length - 1) : null;
}

/** A colour expression from source -> a colour string, or null if it is not a plain value. */
function resolveExpr(expr) {
  const e = expr.trim();
  let m = e.match(/^['"`]([^'"`]+)['"`]$/);
  if (m) return m[1];
  m = e.match(/^Theme\??\.colors\??\.(\w+)$/);
  if (m) return THEME.colors[m[1]] ?? null;
  return null;
}

/** All `color:` expressions (not backgroundColor/borderColor) in a block of source. */
function colorExprs(block) {
  return [...block.matchAll(/(?:^|[\s{,])color\s*:\s*([^,}\n]+)/g)].map((m) => m[1]);
}

/**
 * The text colour the source actually uses for a pair -> { fg, bg? } or { error }.
 * `read(file)` returns the file's source (injectable so a test can feed a mutated copy).
 */
export function sourceColor(file, style, read) {
  const src = read(file);
  const bind = BINDINGS[`${file}::${style}`];
  const one = (values, what) => {
    if (!values.length) return { error: `no ${what} found` };
    const resolved = [...new Set(values.map(resolveExpr))];
    if (resolved.includes(null)) return { error: `${what} is not a plain colour: ${values.join(' | ')}` };
    if (resolved.length > 1) return { error: `${what} disagrees across the file: ${resolved.join(', ')}` };
    return { fg: resolved[0] };
  };
  if (!bind) {
    const key = style.split(' ')[0];
    const block = styleBlock(src, key);
    if (block === null) return { error: `style ${key} not found` };
    const exprs = colorExprs(block);
    if (exprs.length) return one(exprs, `${key}.color`);
    const spread = block.match(/\.\.\.Theme\.typography\.(\w+)/);
    if (spread && THEME.typography[spread[1]]?.color) return { fg: THEME.typography[spread[1]].color };
    return { error: `style ${key} sets no color` };
  }
  if (bind.prop) {
    const vals = [...src.matchAll(new RegExp(`${bind.prop}=\\{([^}]+)\\}`, 'g'))].map((m) => m[1]);
    return one(vals, bind.prop);
  }
  if (bind.fn) {
    const at = src.search(new RegExp(`function ${bind.fn}\\s*\\(`));
    if (at < 0) return { error: `function ${bind.fn} not found` };
    const body = balanced(src, src.indexOf('{', src.indexOf(')', at)));
    const expr = body && colorExprs(body)[bind.nth];
    return expr ? one([expr], `${bind.fn} color #${bind.nth}`) : { error: `${bind.fn} color #${bind.nth} not found` };
  }
  if (bind.map) {
    const m = src.match(new RegExp(`\\b${bind.map}\\s*:\\s*\\{\\s*bg\\s*:\\s*([^,}]+),\\s*fg\\s*:\\s*([^,}]+)\\}`));
    if (!m) return { error: `chip ${bind.map} not found` };
    const fg = resolveExpr(m[2]);
    const bg = resolveExpr(m[1]);
    return fg && bg ? { fg, bg } : { error: `chip ${bind.map} is not plain colours` };
  }
  if (bind.chartLabel) {
    const vals = [...src.matchAll(/labelColor\s*:[^`\n]*`rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,/g)]
      .map((m) => `'rgb(${m[1]}, ${m[2]}, ${m[3]})'`);
    return one(vals, 'labelColor');
  }
  return { error: 'unknown binding' };
}

const readFromDisk = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

function sameColour(a, b) {
  const x = parseColor(a);
  const y = parseColor(b);
  return x.r === y.r && x.g === y.g && x.b === y.b && x.a === y.a;
}

/**
 * -> one row per pair. `result` is 'pass', 'FAIL' (contrast), 'DRIFT' (source colour differs
 * from the declared one but still passes), 'FAIL + DRIFT', or 'UNBOUND' (source colour
 * unreadable); `pass` is result === 'pass'.
 */
export function audit(pairs = PAIRS, read = readFromDisk) {
  return pairs.map(([file, style, declared, declaredBg, size, bold]) => {
    const need = isLarge(size, bold) ? 3 : 4.5;
    const src = sourceColor(file, style, read);
    const base = { file, style, declared: resolve(declared), size, bold, need };
    if (src.error) {
      return { ...base, fg: '?', bg: declaredBg.map(resolve).join(' + '), ratio: NaN, result: 'UNBOUND', note: src.error, pass: false };
    }
    const bg = src.bg ? [src.bg] : declaredBg;
    const ratio = contrast(src.fg, bg);
    let result = ratio >= need ? 'pass' : 'FAIL';
    let note = '';
    const declaredTop = declaredBg[declaredBg.length - 1];
    if (!sameColour(src.fg, declared) || (src.bg && !sameColour(src.bg, declaredTop))) {
      result = ratio >= need ? 'DRIFT' : 'FAIL + DRIFT';
      note = `source ${src.fg}${src.bg ? ` on ${src.bg}` : ''}, table says ${resolve(declared)}${src.bg ? ` on ${resolve(declaredTop)}` : ''}`;
    }
    return { ...base, fg: src.fg, bg: bg.map(resolve).join(' + '), ratio, result, note, pass: result === 'pass' };
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rows = audit();
  console.log('| File | Style | Text | Background | Size | Ratio | Needs | Result |');
  console.log('|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const result = r.pass ? 'pass' : `**${r.result}**${r.note ? ` (${r.note})` : ''}`;
    const ratio = Number.isNaN(r.ratio) ? '?' : r.ratio.toFixed(2);
    console.log(`| ${r.file} | ${r.style} | ${r.fg} | ${r.bg} | ${r.size}${r.bold ? ' bold' : ''} | ${ratio}:1 | ${r.need}:1 | ${result} |`);
  }
  const failed = rows.filter((r) => !r.pass);
  console.log(`\n${rows.length} pairs, ${failed.length} failing`);
  process.exit(failed.length ? 1 : 0);
}
