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
// Usage: node scripts/a11y_audit.mjs   (prints a table, exits 1 if anything is unlabelled)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

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

export const AUDITED = [...CORE_SCREENS, ...G61_SCREENS];

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
    out.push({ tag, line, kind, attrs, missing: need.filter((p) => !hasProp(attrs, p)) });
  }
  return out;
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
  console.log('| File | Interactive | Unlabelled |');
  console.log('|---|---|---|');
  for (const r of rows) {
    bad += r.unlabelled.length;
    console.log(`| ${r.file} | ${r.items.length} | ${r.unlabelled.length} |`);
    for (const u of r.unlabelled) console.log(`|  line ${u.line} <${u.tag}> | | missing ${u.missing.join(', ')} |`);
  }
  console.log(`\naccessibility props in screens/ + components/: ${countA11yProps()}`);
  console.log(`unlabelled interactive elements on the ${rows.length} audited files: ${bad}`);
  process.exit(bad ? 1 : 0);
}
