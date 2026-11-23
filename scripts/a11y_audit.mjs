// G53 — lint-style screen-reader check for the five core screens (G61: and every other routed
// screen, see G61_SCREENS).
//
// Counts, per file, the interactive JSX elements and how many of them lack an
// accessibilityLabel / accessibilityRole:
//   * tappables (TouchableOpacity, TouchableHighlight, TouchableWithoutFeedback, Pressable,
//     CustomButton) need BOTH accessibilityLabel and accessibilityRole;
//   * text fields and pickers (TextInput, CustomInput, Picker) need accessibilityLabel.
// ExerciseRow is not counted here: it sets role + label itself from its `label` prop.
//
// A static scan of the JSX source: it cannot see a label added by spreading props, so a spread
// counts as unlabelled (keep labels explicit). TalkBack on a device stays the final word.
//
// G63 — three more checks, all failing the run:
//   * TARGET SIZE: every TouchableOpacity/Highlight/Pressable must reach 44x44pt once its hitSlop
//     is added. The size is ESTIMATED from source: the touchable's declared height/minHeight/
//     width/minWidth, else its padding + border + the content (one line per child <Text> at
//     fontSize x 1.2, plus the Text's own padding/border; static text width at fontSize x 0.55 per
//     character). Styles are read from `style={styles.x}`, arrays of those, and inline object
//     literals; `cond && styles.x` is ignored (the box must be big enough without it) and
//     `c ? a : b` takes the smaller. A side that cannot be estimated (percent or flex sizing,
//     dynamic text, icons, a TouchableWithoutFeedback that styles its child) is counted as
//     "unsized" and printed, not failed: the phone is still the final word on those.
//   * OPT-OUTS: `accessible={false}` hides an element and its children from the screen reader.
//     It is allowed only on a modal backdrop wrapper marked with a `/* a11y-backdrop */` comment
//     inside the tag, or on an entry of OPT_OUT_ALLOWED (with its reason).
//   * COVERAGE: every .js file under screens/ must be in AUDITED or in NOT_SCREENS (with its
//     reason), so a new screen cannot be skipped silently.
//
// Usage: node scripts/a11y_audit.mjs   (prints a table, exits 1 if anything fails)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadTheme, styleBlock } from './contrast_audit.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const THEME = loadTheme();

export const CORE_SCREENS = [
  'screens/Login.js',
  'screens/Client/ClientHome.js',
  'screens/Client/TrainingScreen.js',
  'screens/Trainer/TrainerDashboard.js',
  'screens/Client/ProgressScreen.js',
];

// G61 — every other routed screen, plus the heatmap cell (a tappable component with no label prop
// passed through from outside).
export const G61_SCREENS = [
  'screens/Client/LeaderboardScreen.js',
  'screens/Client/LifestyleScreen.js',
  'screens/Client/IntakeScreen.js',
  'screens/Trainer/TrainerHome.js',
  'screens/Trainer/ClientOverview.js',
  'screens/Trainer/ClientsManagementScreen.js',
  'screens/Trainer/CreateWorkout.js',
  'screens/Trainer/EditWorkout.js',
  'screens/Trainer/ProfileScreen.js',
  'screens/Trainer/ProgramBuilderScreen.js',
  'screens/Trainer/ProgramsListScreen.js',
  'screens/Trainer/TrainerScreen.js',
  'screens/Trainer/TVScreen.js',
  'screens/Trainer/WorkoutsMenu.js',
  'components/VolumeHeatmapCell.js',
];

// G63 — Logout has a labelled button and a screen of its own (not routed today).
export const G63_SCREENS = ['screens/Logout.js'];

export const AUDITED = [...CORE_SCREENS, ...G61_SCREENS, ...G63_SCREENS];

// G63 — files under screens/ that are not screens, with the reason. Anything else under screens/
// must be in AUDITED.
export const NOT_SCREENS = {
  'screens/Navigation.js': 'the stack navigator: imports the screens, renders no controls of its own',
  'screens/Trainer/GlobalState.js': 'a module-level state holder, no JSX',
  'screens/Trainer/socket-io-handlers.js': 'socket event handlers, no JSX',
};

// G63 — `accessible={false}` that is not a marked backdrop: file, a snippet of the tag that
// identifies it, and why it is right.
export const OPT_OUT_ALLOWED = [
  {
    file: 'components/VolumeHeatmapCell.js',
    has: "backgroundColor: 'transparent'",
    why: 'the empty slot for a future day: no colour, no tap target, nothing to announce',
  },
];

// G63 — tappables allowed under 44pt, with the reason.
export const SMALL_TARGET_OK = [
  {
    file: 'components/VolumeHeatmapCell.js',
    has: 'styles.cell',
    why: 'one of 364 heatmap cells; the accessible summary redesign is G53 follow-up 2',
  },
];

export const MIN_TARGET = 44;

const TAPPABLE = ['TouchableOpacity', 'TouchableHighlight', 'TouchableWithoutFeedback', 'Pressable', 'CustomButton'];
const FIELD = ['TextInput', 'CustomInput', 'Picker'];

/** The attribute text of a JSX tag starting at `from`, honouring `{...}` (which may hold `=>`). */
function readAttrs(src, from) {
  let depth = 0;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0 && src[i - 1] !== '=') return src.slice(from, i);
  }
  return src.slice(from);
}

function hasProp(attrs, name) {
  return new RegExp(`(^|\\s)${name}\\s*=`).test(attrs);
}

/** -> [{ tag, line, kind, attrs, missing: ['accessibilityLabel', ...] }] for every interactive element */
export function scanSource(src) {
  const re = new RegExp(`<(${[...TAPPABLE, ...FIELD].join('|')})(?=[\\s>/])`, 'g');
  const out = [];
  let m;
  while ((m = re.exec(src))) {
    const tag = m[1];
    const attrs = readAttrs(src, m.index + m[0].length);
    const kind = TAPPABLE.includes(tag) ? 'tappable' : 'field';
    // G61 — `accessible={false}` is a deliberate opt-out (a modal backdrop or a press-swallowing
    // card that would otherwise hide its children from the screen reader as one focus node).
    const optedOut = /(^|\s)accessible=\{false\}/.test(attrs);
    const need = optedOut ? [] : kind === 'tappable' ? ['accessibilityLabel', 'accessibilityRole'] : ['accessibilityLabel'];
    const line = src.slice(0, m.index).split('\n').length;
    const attrsEnd = m.index + m[0].length + attrs.length;
    out.push({ tag, line, kind, attrs, index: m.index, attrsEnd, missing: need.filter((p) => !hasProp(attrs, p)) });
  }
  return out;
}

// ---------------------------------------------------------------- G63 — target size

/** Split `s` at top-level occurrences of `sep` (outside (), [], {} and quotes). */
function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let quote = null;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      if (c === quote && s[i - 1] !== '\\') quote = null;
    } else if (c === "'" || c === '"' || c === '`') quote = c;
    else if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    else if (depth === 0 && s.startsWith(sep, i)) {
      out.push(s.slice(start, i));
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

/** The text of `{...}` starting at the `{` at index `open` (without the braces). */
function braced(src, open) {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(open + 1, i);
  }
  return null;
}

/** The expression of prop `name` in a tag's attribute text, or null. */
function propExpr(attrs, name) {
  const m = new RegExp(`(?:^|\\s)${name}=\\{`).exec(attrs);
  return m ? braced(attrs, m.index + m[0].length - 1) : null;
}

const SIZE_PROPS = ['height', 'minHeight', 'width', 'minWidth', 'padding', 'paddingVertical', 'paddingHorizontal',
  'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight', 'borderWidth', 'fontSize', 'lineHeight', 'flex'];

/** A size expression -> number, or null when it is not a plain number ('48%', a calculation). */
function numValue(expr, src) {
  const e = expr.trim();
  if (/^-?\d+(\.\d+)?$/.test(e)) return +e;
  let m = e.match(/^Theme\??\.spacing\??\.(\w+)$/);
  if (m) return THEME.spacing[m[1]] ?? null;
  m = e.match(/^[A-Z_][A-Z0-9_]*$/);
  if (m) {
    const c = src.match(new RegExp(`const ${e}\\s*=\\s*(\\d+(?:\\.\\d+)?)\\s*;`));
    return c ? +c[1] : null;
  }
  return null;
}

/** A style object's body -> { prop: number | null } for the size props it sets. */
function readProps(body, src) {
  const out = {};
  const spread = body.match(/\.\.\.Theme\.typography\.(\w+)/);
  if (spread) {
    const t = THEME.typography[spread[1]] || {};
    for (const k of ['fontSize', 'lineHeight']) if (typeof t[k] === 'number') out[k] = t[k];
  }
  let flat = body;
  for (let prev = null; prev !== flat;) { prev = flat; flat = flat.replace(/\{[^{}]*\}/g, ''); } // drop shadowOffset etc.
  for (const m of flat.matchAll(/(?:^|[\s,{])(\w+)\s*:\s*([^,\n}]+)/g)) {
    if (SIZE_PROPS.includes(m[1])) out[m[1]] = numValue(m[2], src);
  }
  return out;
}

/** One style reference (`styles.x` or `{...}`) -> props, or null if it is something else. */
function styleRef(el, src) {
  const e = el.trim();
  let m = e.match(/^styles\.(\w+)$/);
  if (m) {
    const block = styleBlock(src, m[1]);
    return block === null ? null : readProps(block, src);
  }
  if (e.startsWith('{') && e.endsWith('}')) return readProps(e.slice(1, -1), src);
  return null;
}

/**
 * A `style={...}` expression -> the list of prop sets it can resolve to. `cond && x` is skipped
 * (the box must be big enough without it), `c ? a : b` yields both, anything else (a variable,
 * an animated style) contributes nothing.
 */
function styleVariants(expr, src) {
  if (!expr) return [{}];
  const e = expr.trim();
  const els = e.startsWith('[') && e.endsWith(']') ? splitTop(e.slice(1, -1), ',') : [e];
  let variants = [{}];
  for (const el of els) {
    if (splitTop(el, '&&').length > 1) continue;
    const tern = splitTop(el, '?');
    const options = tern.length > 1 ? splitTop(tern.slice(1).join('?'), ':') : [el];
    const props = options.map((o) => styleRef(o, src) ?? {});
    variants = variants.flatMap((v) => props.map((p) => ({ ...v, ...p })));
  }
  return variants;
}

/** Padding on one axis ('V' or 'H'): null if any contributing value is unreadable. */
function padding(p, axis) {
  const [a, b, both] = axis === 'V' ? ['paddingTop', 'paddingBottom', 'paddingVertical'] : ['paddingLeft', 'paddingRight', 'paddingHorizontal'];
  const side = (k) => (k in p ? p[k] : both in p ? p[both] : 'padding' in p ? p.padding : 0);
  const x = side(a);
  const y = side(b);
  return x === null || y === null ? null : x + y;
}

/** The children source between a tag's `>` and its matching close tag (same tag name). */
function childrenOf(src, tag, attrsEnd) {
  if (src[attrsEnd - 1] === '/') return '';
  const open = new RegExp(`<${tag}(?=[\\s>/])|</${tag}>`, 'g');
  open.lastIndex = attrsEnd + 1;
  let depth = 1;
  let m;
  while ((m = open.exec(src))) {
    depth += m[0].startsWith('</') ? -1 : 1;
    if (depth === 0) return src.slice(attrsEnd + 1, m.index);
  }
  return null;
}

/** Content box of a tappable's children -> { h, w } (null where it cannot be estimated). */
function contentSize(children, src) {
  if (children === null) return { h: null, w: null };
  const tags = [...children.matchAll(/<([A-Z]\w*)/g)].map((m) => m[1]);
  if (!tags.length || tags.some((t) => t !== 'Text' && t !== 'View')) return { h: null, w: null };
  let h = 0;
  let w = 0;
  let wKnown = true;
  for (const m of children.matchAll(/<Text\b/g)) {
    const attrs = readAttrs(children, m.index + 5);
    const p = styleVariants(propExpr(attrs, 'style'), src)[0];
    const fs_ = p.fontSize ?? 14;
    const line = p.lineHeight ?? fs_ * 1.2;
    const padV = padding(p, 'V');
    const padH = padding(p, 'H');
    const bw = (p.borderWidth ?? 0) * 2;
    if (fs_ === null || line === null || padV === null) return { h: null, w: null };
    h += line + padV + bw;
    const close = children.indexOf('</Text>', m.index);
    const text = close < 0 ? '' : children.slice(m.index + 5 + attrs.length + 1, close).trim();
    if (!text || /[{<]/.test(text) || padH === null) wKnown = false;
    else {
      const chars = [...text];
      const width = chars.reduce((s, c) => s + (/[\x20-\x7e]/.test(c) ? 0.55 : 1) * fs_, 0);
      w = Math.max(w, width + padH + bw);
    }
  }
  return { h, w: wKnown ? w : null };
}

/** `hitSlop={...}` -> { v: top + bottom, h: left + right }. */
function hitSlopOf(attrs, src) {
  const expr = propExpr(attrs, 'hitSlop');
  if (!expr) return { v: 0, h: 0 };
  let body = expr.trim();
  if (/^\d+$/.test(body)) return { v: 2 * +body, h: 2 * +body };
  if (/^[A-Za-z_]\w*$/.test(body)) {
    const m = new RegExp(`const ${body}\\s*=\\s*\\{`).exec(src);
    if (!m) return { v: 0, h: 0 };
    body = braced(src, m.index + m[0].length - 1);
  } else if (body.startsWith('{')) body = body.slice(1, -1);
  const get = (k) => {
    const m = body.match(new RegExp(`\\b${k}\\s*:\\s*([^,}\\n]+)`));
    return m ? numValue(m[1], src) ?? 0 : 0;
  };
  return { v: get('top') + get('bottom'), h: get('left') + get('right') };
}

/**
 * -> one row per tappable (CustomButton excluded: its gradient is 16pt padding on each side of
 * the text, over 44) with the estimated box: { tag, line, h, w, slop, small, unsized, exempt }.
 */
export function targetSizes(src, file = '') {
  return scanSource(src).filter((i) => i.kind === 'tappable' && i.tag !== 'CustomButton').map((i) => {
    const base = { tag: i.tag, line: i.line };
    if (/(^|\s)accessible=\{false\}/.test(i.attrs) && i.attrs.includes('a11y-backdrop')) return { ...base, exempt: 'modal backdrop' };
    const ok = SMALL_TARGET_OK.find((x) => x.file === file && i.attrs.includes(x.has));
    if (ok) return { ...base, exempt: ok.why };
    const slop = hitSlopOf(i.attrs, src);
    if (i.tag === 'TouchableWithoutFeedback') return { ...base, h: null, w: null, slop, small: false, unsized: ['height', 'width'] };
    const content = contentSize(childrenOf(src, i.tag, i.attrsEnd), src);
    const sizes = styleVariants(propExpr(i.attrs, 'style'), src).map((p) => {
      const bw = (p.borderWidth ?? 0) * 2;
      const axis = (fixed, min, pad, c) => {
        if (fixed in p || min in p) {
          const vals = [p[fixed], p[min]].filter((v) => v !== undefined);
          return vals.includes(null) ? null : Math.max(...vals);
        }
        return pad === null || c === null ? null : c + pad + bw;
      };
      return {
        h: axis('height', 'minHeight', padding(p, 'V'), content.h),
        // flex sizing stretches along the parent's main axis (usually a row): width unknown
        w: 'flex' in p && !('width' in p || 'minWidth' in p) ? null : axis('width', 'minWidth', padding(p, 'H'), content.w),
      };
    });
    const pick = (k) => (sizes.some((s) => s[k] === null) ? null : Math.min(...sizes.map((s) => s[k])));
    const h = pick('h');
    const w = pick('w');
    const small = (h !== null && h + slop.v < MIN_TARGET) || (w !== null && w + slop.h < MIN_TARGET);
    const unsized = [h === null && 'height', w === null && 'width'].filter(Boolean);
    return { ...base, h, w, slop, small, unsized };
  });
}

// ---------------------------------------------------------------- G63 — opt-outs and coverage

/** -> [{ line, tag, allowed, why }] for every `accessible={false}` in the source. */
export function optOuts(src, file = '') {
  return [...src.matchAll(/accessible=\{false\}/g)].map((m) => {
    const start = src.lastIndexOf('<', m.index);
    const tag = (src.slice(start + 1).match(/^\w+/) || ['?'])[0];
    const attrs = readAttrs(src, start + 1 + tag.length);
    const line = src.slice(0, m.index).split('\n').length;
    if (attrs.includes('a11y-backdrop')) return { line, tag, allowed: true, why: 'marked a11y-backdrop' };
    const ok = OPT_OUT_ALLOWED.find((x) => x.file === file && attrs.includes(x.has));
    return ok ? { line, tag, allowed: true, why: ok.why } : { line, tag, allowed: false, why: 'not a marked backdrop and not in OPT_OUT_ALLOWED' };
  });
}

/** Every .js file under screens/ that is neither audited nor listed in NOT_SCREENS. */
export function uncoveredScreens(audited = AUDITED) {
  const files = [];
  const walk = (dir) => {
    for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${d.name}`;
      if (d.isDirectory()) walk(rel);
      else if (d.name.endsWith('.js')) files.push(rel);
    }
  };
  walk('screens');
  return files.filter((f) => !audited.includes(f) && !(f in NOT_SCREENS));
}

export function auditFiles(files = CORE_SCREENS) {
  return files.map((file) => {
    const items = scanSource(fs.readFileSync(path.join(ROOT, file), 'utf8'));
    return { file, items, unlabelled: items.filter((i) => i.missing.length) };
  });
}

/** Total accessibilityLabel/Role/Hint and accessible= occurrences across the app's JS. */
export function countA11yProps(dirs = ['screens', 'components']) {
  let n = 0;
  const walk = (dir) => {
    for (const d of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = path.join(dir, d.name);
      if (d.isDirectory()) walk(rel);
      else if (d.name.endsWith('.js')) {
        const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        n += (src.match(/accessibility(Label|Role|Hint)\b|accessible=/g) || []).length;
      }
    }
  };
  dirs.forEach(walk);
  return n;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rows = auditFiles(AUDITED);
  let bad = 0;
  let small = 0;
  let unsized = 0;
  let noHeight = 0;
  let badOptOut = 0;
  console.log('| File | Interactive | Unlabelled | Under 44pt | Unsized | Bad opt-outs |');
  console.log('|---|---|---|---|---|---|');
  for (const r of rows) {
    const src = fs.readFileSync(path.join(ROOT, r.file), 'utf8');
    const sizes = targetSizes(src, r.file);
    const smalls = sizes.filter((s) => s.small);
    const unsz = sizes.filter((s) => s.unsized?.length);
    const opts = optOuts(src, r.file).filter((o) => !o.allowed);
    bad += r.unlabelled.length;
    small += smalls.length;
    unsized += unsz.length;
    noHeight += unsz.filter((s) => s.unsized.includes('height')).length;
    badOptOut += opts.length;
    console.log(`| ${r.file} | ${r.items.length} | ${r.unlabelled.length} | ${smalls.length} | ${unsz.length} | ${opts.length} |`);
    for (const u of r.unlabelled) console.log(`|  line ${u.line} <${u.tag}> | | missing ${u.missing.join(', ')} | | | |`);
    const fmt = (v) => (v === null ? '?' : Math.round(v));
    for (const s of smalls) console.log(`|  line ${s.line} <${s.tag}> | | | ${fmt(s.h)}+${s.slop.v} x ${fmt(s.w)}+${s.slop.h} | | |`);
    for (const o of opts) console.log(`|  line ${o.line} <${o.tag}> accessible={false} | | | | | ${o.why} |`);
  }
  const uncovered = uncoveredScreens();
  for (const f of uncovered) console.log(`UNCOVERED: ${f} is under screens/ but in neither AUDITED nor NOT_SCREENS`);
  console.log(`\naccessibility props in screens/ + components/: ${countA11yProps()}`);
  console.log(`unlabelled interactive elements on the ${rows.length} audited files: ${bad}`);
  console.log(`tappables under ${MIN_TARGET}pt (box + hitSlop): ${small}; unsized (a side not estimated, check on a phone): ${unsized} (height unknown: ${noHeight}, width only: ${unsized - noHeight})`);
  console.log(`accessible={false} outside a marked backdrop or the allowlist: ${badOptOut}`);
  console.log(`screen files not covered: ${uncovered.length}`);
  process.exit(bad || small || badOptOut || uncovered.length ? 1 : 0);
}
