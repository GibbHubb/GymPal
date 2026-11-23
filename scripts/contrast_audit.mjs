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
// G62 — the table also covers the G61 screens, and the BACKGROUND is bound too wherever it is a
// literal in a named style: the text style's own `backgroundColor`, the container style named in
// the pair's 7th field (a button's fill), or an entry of a `const groupColors = [...]` list. The
// bound colour replaces the top declared layer and is measured; a mismatch with the table is DRIFT,
// an unreadable or missing one is UNBOUND. The "Bg from" column says which rows are bound and
// which are still declared by hand (parents, GlassCards, gradients).
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

  // G62 — the G61 screens. A 7th field names the container style whose `backgroundColor` the text
  // sits on (read from source, see sourceBackground); a text style with its own backgroundColor is
  // bound without it. Unsized text is RN's default 14. fontWeight '600' is not bold for WCAG.
  // Disabled controls (opacity 0.5/0.6) are exempt (WCAG 1.4.3) and not tabled.
  // LeaderboardScreen (GlassCard over the dark page)
  ['screens/Client/LeaderboardScreen.js', 'intro', 'colors.text', [CARD], 14, false],
  ['screens/Client/LeaderboardScreen.js', 'optInText', 'colors.onPrimary', [CARD, 'colors.primary'], 14, true, 'optInButton'],
  ['screens/Client/LeaderboardScreen.js', 'optOutText', '#FFFFFF', [CARD, 'colors.dangerStrong'], 14, true, 'optOutButton'],
  ['screens/Client/LeaderboardScreen.js', 'errorText', 'colors.error', [PAGE], 14, false],
  ['screens/Client/LeaderboardScreen.js', 'emptyText', 'colors.textSecondary', [PAGE], 14, false],
  ['screens/Client/LeaderboardScreen.js', 'rank', 'colors.primary', [PAGE, 'rgba(255,255,255,0.04)'], 14, true, 'row'],
  ['screens/Client/LeaderboardScreen.js', 'name', 'colors.text', [PAGE, 'rgba(255,255,255,0.04)'], 14, false, 'row'],
  ['screens/Client/LeaderboardScreen.js', 'meta', 'colors.textSecondary', [PAGE, 'rgba(255,255,255,0.04)'], 14, false, 'row'],
  // LifestyleScreen (container fills the page with Theme.colors.background; form in a GlassCard)
  ['screens/Client/LifestyleScreen.js', 'label', 'colors.textSecondary', [CARD], 13, false],
  ['screens/Client/LifestyleScreen.js', 'selectorText', 'colors.text', [CARD, 'colors.surface'], 18, true, 'selectorButton'],
  ['screens/Client/LifestyleScreen.js', 'selectedSelectorText', '#000', [CARD, 'colors.primary'], 18, true, 'selectedButton'],
  ['screens/Client/LifestyleScreen.js', 'input', 'colors.text', [CARD, 'colors.transparentLight'], 14, false],
  ['screens/Client/LifestyleScreen.js', 'input (placeholder)', 'colors.textSecondary', [CARD, 'colors.transparentLight'], 14, false],
  ['screens/Client/LifestyleScreen.js', 'subtitle', 'colors.primary', ['colors.background'], 18, true, 'container'],
  ['screens/Client/LifestyleScreen.js', 'submissionDate', 'colors.primary', [CARD], 13, true],
  ['screens/Client/LifestyleScreen.js', 'submissionText', 'colors.text', [CARD], 13, false],
  ['screens/Client/LifestyleScreen.js', 'noEntriesText', 'colors.textSecondary', ['colors.background'], 14, false, 'container'],
  // IntakeScreen (dark page; the back button is a CustomButton, so its text sits on the gold gradient)
  ['screens/Client/IntakeScreen.js', 'backButtonText', 'colors.onPrimary', ['colors.primary'], 14, false],
  ['screens/Client/IntakeScreen.js', 'backButtonText (gradient end)', 'colors.onPrimary', ['colors.primaryDark'], 14, false],
  ['screens/Client/IntakeScreen.js', 'title', '#FFFFFF', [PAGE], 34, true],
  ['screens/Client/IntakeScreen.js', 'label', 'colors.primary', [PAGE], 13, false],
  ['screens/Client/IntakeScreen.js', 'labelMuted', 'colors.textSecondary', [PAGE, 'colors.surface'], 13, false, 'bmiContainer'],
  ['screens/Client/IntakeScreen.js', 'bmiValue', 'colors.primary', [PAGE, 'colors.surface'], 24, true, 'bmiContainer'],
  // TrainerHome (dark page; Quick Actions on a translucent BlurView card)
  ['screens/Trainer/TrainerHome.js', 'logoutText', 'colors.error', [PAGE, 'rgba(255, 76, 76, 0.1)'], 12, true, 'logoutBtn'],
  ['screens/Trainer/TrainerHome.js', 'title', 'colors.primary', [PAGE], 34, true],
  ['screens/Trainer/TrainerHome.js', 'sectionTitle', '#FFFFFF', [PAGE, 'rgba(22, 22, 22, 0.4)'], 24, true, 'glassCard'],
  // ClientsManagementScreen (dark page; rows are GlassCards)
  ['screens/Trainer/ClientsManagementScreen.js', 'input', 'colors.text', [PAGE, 'rgba(255,255,255,0.05)'], 14, false],
  ['screens/Trainer/ClientsManagementScreen.js', 'input (placeholder)', 'colors.textSecondary', [PAGE, 'rgba(255,255,255,0.05)'], 14, false],
  ['screens/Trainer/ClientsManagementScreen.js', 'btnPrimaryText', '#000', ['colors.primary'], 14, true, 'btnPrimary'],
  ['screens/Trainer/ClientsManagementScreen.js', 'tabText', 'colors.text', [PAGE], 13, false],
  ['screens/Trainer/ClientsManagementScreen.js', 'tabText (active)', 'colors.text', [PAGE, gold(0.12)], 13, false, 'tabActive'],
  ['screens/Trainer/ClientsManagementScreen.js', 'username', 'colors.text', [CARD], 16, false],
  ['screens/Trainer/ClientsManagementScreen.js', 'meta', '#888', [CARD], 12, false],
  ['screens/Trainer/ClientsManagementScreen.js', 'btnText', 'colors.text', [CARD], 12, false],
  ['screens/Trainer/ClientsManagementScreen.js', 'btnDangerText', 'colors.error', [CARD], 14, true],
  ['screens/Trainer/ClientsManagementScreen.js', 'empty', '#888', [PAGE], 14, false],
  // ProgramBuilderScreen (dark page; picker/assign modals are a slate card)
  ['screens/Trainer/ProgramBuilderScreen.js', 'title', 'colors.primary', [PAGE], 24, true],
  ['screens/Trainer/ProgramBuilderScreen.js', 'subtitle', 'rgba(255,255,255,0.5)', [PAGE], 12, false],
  ['screens/Trainer/ProgramBuilderScreen.js', 'notFound', 'colors.text', [PAGE], 14, false],
  ['screens/Trainer/ProgramBuilderScreen.js', 'headText (day)', 'colors.text', [PAGE, 'rgba(255,255,255,0.05)'], 12, true, 'dowHead'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'headText (week)', 'colors.text', [PAGE, gold(0.12)], 12, true, 'weekHead'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'cellText', 'colors.text', [PAGE, 'rgba(255,255,255,0.03)'], 11, false, 'cell'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'cellText (filled)', 'colors.text', [PAGE, gold(0.18)], 11, false, 'cellFilled'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'modalTitle', 'colors.text', ['#1e293b'], 16, true, 'modalCard'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'modalRowText', 'colors.text', ['#1e293b'], 14, false, 'modalCard'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'modalRowDanger', '#fca5a5', ['#1e293b'], 14, false, 'modalCard'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'modalRowMuted', 'colors.textSecondary', ['#1e293b'], 14, false, 'modalCard'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'label', 'rgba(255,255,255,0.5)', ['#1e293b'], 11, false, 'modalCard'],
  ['screens/Trainer/ProgramBuilderScreen.js', 'input', 'colors.text', ['#1e293b', 'rgba(255,255,255,0.06)'], 14, false],
  ['screens/Trainer/ProgramBuilderScreen.js', 'input (placeholder)', 'colors.textSecondary', ['#1e293b', 'rgba(255,255,255,0.06)'], 14, false],
  ['screens/Trainer/ProgramBuilderScreen.js', 'empty', 'rgba(255,255,255,0.5)', ['#1e293b'], 14, false, 'modalCard'],
  // ProgramsListScreen (dark page; create box and rows are translucent white)
  ['screens/Trainer/ProgramsListScreen.js', 'title', 'colors.primary', [PAGE], 24, true],
  ['screens/Trainer/ProgramsListScreen.js', 'sectionLabel', 'rgba(255,255,255,0.5)', [PAGE, 'rgba(255,255,255,0.04)'], 11, false, 'createBox'],
  ['screens/Trainer/ProgramsListScreen.js', 'inlineLabel', 'rgba(255,255,255,0.7)', [PAGE, 'rgba(255,255,255,0.04)'], 13, false, 'createBox'],
  ['screens/Trainer/ProgramsListScreen.js', 'input', 'colors.text', [PAGE, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.06)'], 14, false],
  ['screens/Trainer/ProgramsListScreen.js', 'input (placeholder)', 'colors.textSecondary', [PAGE, 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0.06)'], 14, false],
  ['screens/Trainer/ProgramsListScreen.js', 'rowTitle', 'colors.text', [PAGE, 'rgba(255,255,255,0.04)'], 16, false, 'row'],
  ['screens/Trainer/ProgramsListScreen.js', 'rowMeta', 'rgba(255,255,255,0.5)', [PAGE, 'rgba(255,255,255,0.04)'], 12, false, 'row'],
  ['screens/Trainer/ProgramsListScreen.js', 'del', '#fca5a5', [PAGE, 'rgba(255,255,255,0.04)'], 18, false, 'row'],
  ['screens/Trainer/ProgramsListScreen.js', 'empty', 'rgba(255,255,255,0.5)', [PAGE], 13, false],
  // WorkoutsMenu (white page)
  ['screens/Trainer/WorkoutsMenu.js', 'backButtonText', '#1A1A1A', [WHITE, 'colors.primary'], 16, true, 'backButton'],
  ['screens/Trainer/WorkoutsMenu.js', 'header', '#3274ba', [WHITE], 24, true, 'container'],
  ['screens/Trainer/WorkoutsMenu.js', 'searchInput', '#333', [WHITE, '#f8f8f8'], 14, false],
  ['screens/Trainer/WorkoutsMenu.js', 'searchInput (placeholder)', '#555', [WHITE, '#f8f8f8'], 14, false],
  ['screens/Trainer/WorkoutsMenu.js', 'workoutName', '#1A1A1A', [WHITE, '#8ebce6'], 16, true, 'workoutItem'],
  ['screens/Trainer/WorkoutsMenu.js', 'workoutDate', '#333', [WHITE, '#8ebce6'], 14, false, 'workoutItem'],
  ['screens/Trainer/WorkoutsMenu.js', 'emptyText', '#555', [WHITE], 16, false, 'container'],
  ['screens/Trainer/WorkoutsMenu.js', 'subButtonText', '#fff', [WHITE, '#3274ba'], 14, true, 'subButton'],
  ['screens/Trainer/WorkoutsMenu.js', 'mainButtonText', '#fff', [WHITE, '#3274ba'], 14, true, 'mainButton'],
  ['screens/Trainer/WorkoutsMenu.js', 'createWorkoutButtonText', '#1A1A1A', [WHITE, 'colors.primary'], 18, true, 'createWorkoutButton'],
  // ClientOverview (white page; Add Client modal is a white card)
  ['screens/Trainer/ClientOverview.js', 'backButtonText', '#1A1A1A', [WHITE, 'colors.primary'], 18, true, 'backButton'],
  ['screens/Trainer/ClientOverview.js', 'header', '#3274ba', [WHITE], 24, true, 'container'],
  ['screens/Trainer/ClientOverview.js', 'searchInput (placeholder)', '#555', [WHITE], 14, false, 'container'],
  ['screens/Trainer/ClientOverview.js', 'addButtonText', '#1A1A1A', [WHITE, '#32a852'], 16, true, 'addButton'],
  ['screens/Trainer/ClientOverview.js', 'username', '#1A1A1A', [WHITE, 'colors.primary'], 16, true, 'userCard'],
  ['screens/Trainer/ClientOverview.js', 'emptyMessage', '#555', [WHITE], 14, false, 'container'],
  ['screens/Trainer/ClientOverview.js', 'roleLabel', '#1A1A1A', [WHITE], 14, false, 'modalContent'],
  ['screens/Trainer/ClientOverview.js', 'roleText', '#1A1A1A', [WHITE], 14, false, 'modalContent'],
  ['screens/Trainer/ClientOverview.js', 'roleTextSelected', '#FFFFFF', [WHITE, '#3274ba'], 14, true, 'roleSelected'],
  ['screens/Trainer/ClientOverview.js', 'modalHeader', '#3274ba', [WHITE], 22, true, 'modalContent'],
  ['screens/Trainer/ClientOverview.js', 'cancelText', '#fff', [WHITE, 'colors.dangerStrong'], 16, true, 'cancelButton'],
  ['screens/Trainer/ClientOverview.js', 'saveText', '#1A1A1A', [WHITE, '#32a852'], 16, true, 'saveButton'],
  // ProfileScreen (white page)
  ['screens/Trainer/ProfileScreen.js', 'header', '#3274ba', [WHITE], 24, true, 'container'],
  ['screens/Trainer/ProfileScreen.js', 'backButtonText', '#3274ba', [WHITE], 18, false, 'container'],
  ['screens/Trainer/ProfileScreen.js', 'saveButtonText', '#1A1A1A', [WHITE, '#32a852'], 16, true, 'saveButton'],
  // TrainerScreen (container fills the page with Theme.colors.background)
  ['screens/Trainer/TrainerScreen.js', 'logo', 'colors.primary', ['colors.background'], 28, true, 'container'],
  ['screens/Trainer/TrainerScreen.js', 'backBtnText', '#fff', ['colors.surface'], 13, true, 'backBtn'],
  ['screens/Trainer/TrainerScreen.js', 'header', 'colors.primary', ['colors.background'], 24, true, 'container'],
  ['screens/Trainer/TrainerScreen.js', 'sessionLabel', 'colors.primary', ['colors.surface'], 13, false, 'sessionContainer'],
  ['screens/Trainer/TrainerScreen.js', 'sessionInput', '#fff', ['colors.surface', 'rgba(255,255,255,0.05)'], 14, false],
  ['screens/Trainer/TrainerScreen.js', 'sessionInput (placeholder)', '#888', ['colors.surface', 'rgba(255,255,255,0.05)'], 14, false],
  ['screens/Trainer/TrainerScreen.js', 'sessionStatusText (live)', '#000', ['colors.success'], 11, true, 'sessionActiveButton'],
  ['screens/Trainer/TrainerScreen.js', 'sessionStatusText (go live)', '#000', ['colors.primary'], 11, true, 'sessionInactiveButton'],
  // participant header cells are filled with groupColors[i] at runtime: one row per list entry
  ['screens/Trainer/TrainerScreen.js', 'headerCell (group pink)', '#1A1A1A', ['#fcc0d8'], 12, true, 'groupColors[0]'],
  ['screens/Trainer/TrainerScreen.js', 'headerCell (group orange)', '#1A1A1A', ['#fc6e4c'], 12, true, 'groupColors[1]'],
  ['screens/Trainer/TrainerScreen.js', 'headerCell (group gold)', '#1A1A1A', ['colors.primary'], 12, true, 'groupColors[2]'],
  ['screens/Trainer/TrainerScreen.js', 'headerCell (group blue)', '#1A1A1A', ['#8ebce6'], 12, true, 'groupColors[3]'],
  ['screens/Trainer/TrainerScreen.js', 'subHeaderText', 'colors.textSecondary', ['colors.background'], 10, true, 'container'],
  ['screens/Trainer/TrainerScreen.js', 'exerciseText', 'colors.text', ['colors.background'], 14, true, 'container'],
  ['screens/Trainer/TrainerScreen.js', 'dataText', '#fff', ['colors.background', 'rgba(255,255,255,0.03)'], 14, true, 'dataBox'],
  ['screens/Trainer/TrainerScreen.js', 'dataText (placeholder)', 'colors.textSecondary', ['colors.background', 'rgba(255,255,255,0.03)'], 14, true, 'dataBox'],
  ['screens/Trainer/TrainerScreen.js', 'timerText', 'colors.primary', ['colors.surface'], 18, true, 'timerContainer'],
  ['screens/Trainer/TrainerScreen.js', 'timeAdjustText', '#fff', ['colors.surface', 'rgba(255,255,255,0.05)'], 10, true, 'timeAdjustBtn'],
  ['screens/Trainer/TrainerScreen.js', 'startButtonText', '#000', ['colors.primary'], 12, true, 'startButton'],
  ['screens/Trainer/TrainerScreen.js', 'pauseButtonText', '#fff', ['colors.dangerStrong'], 12, true, 'pauseButton'],
  ['screens/Trainer/TrainerScreen.js', 'resetButtonText', '#fff', ['colors.surface'], 12, true, 'resetButton'],
  ['screens/Trainer/TrainerScreen.js', 'nextButtonText', '#000', ['colors.primary'], 12, true, 'nextButton'],
  ['screens/Trainer/TrainerScreen.js', 'input', '#fff', ['colors.surface'], 14, false],
  ['screens/Trainer/TrainerScreen.js', 'input (placeholder)', '#888', ['colors.surface'], 14, false],
  ['screens/Trainer/TrainerScreen.js', 'buttonText', '#000', ['colors.primary'], 14, true, 'addButton'],
  ['screens/Trainer/TrainerScreen.js', 'debugText', 'colors.primary', ['colors.background', 'rgba(0,0,0,0.9)'], 9, false, 'debugContainer'],
  ['screens/Trainer/TrainerScreen.js', 'liveSessionTitle', 'colors.primary', ['colors.surface'], 12, true, 'liveSessionPanel'],
  ['screens/Trainer/TrainerScreen.js', 'liveSessionInput', '#fff', ['colors.surface', 'rgba(255,255,255,0.05)'], 13, false],
  ['screens/Trainer/TrainerScreen.js', 'liveSessionInput (placeholder)', '#888', ['colors.surface', 'rgba(255,255,255,0.05)'], 13, false],
  ['screens/Trainer/TrainerScreen.js', 'liveSessionBtnText (start)', '#000', ['colors.primary'], 12, true, 'liveSessionBtnStart'],
  ['screens/Trainer/TrainerScreen.js', 'liveSessionBtnText (end)', '#000', ['colors.error'], 12, true, 'liveSessionBtnEnd'],
  ['screens/Trainer/TrainerScreen.js', 'liveSessionBtnText (push)', '#000', ['#5c7cfa'], 12, true, 'liveSessionBtnPush'],
  ['screens/Trainer/TrainerScreen.js', 'templatesChevron', 'colors.primary', ['colors.surface'], 12, false, 'liveSessionPanel'],
  ['screens/Trainer/TrainerScreen.js', 'templatesEmpty', '#888', ['colors.surface'], 12, false, 'liveSessionPanel'],
  ['screens/Trainer/TrainerScreen.js', 'templateName', '#fff', ['colors.surface'], 13, false, 'liveSessionPanel'],
  ['screens/Trainer/TrainerScreen.js', 'templateMeta', '#888', ['colors.surface'], 11, false, 'liveSessionPanel'],
  ['screens/Trainer/TrainerScreen.js', 'templateDeleteText', 'colors.error', ['colors.surface'], 16, false, 'liveSessionPanel'],
  // CreateWorkout (container fills the page with Theme.colors.background; exercise cards override
  // GlassCard's fill with a 2% white)
  ['screens/Trainer/CreateWorkout.js', 'header', 'colors.primary', ['colors.background'], 34, true, 'container'],
  ['screens/Trainer/CreateWorkout.js', 'input', '#fff', ['colors.surface'], 14, false],
  ['screens/Trainer/CreateWorkout.js', 'input (placeholder)', '#888', ['colors.surface'], 14, false],
  ['screens/Trainer/CreateWorkout.js', 'label', 'colors.primary', ['colors.background'], 13, false, 'container'],
  ['screens/Trainer/CreateWorkout.js', 'difficultyText', '#fff', ['colors.surface'], 12, false, 'difficultyButton'],
  ['screens/Trainer/CreateWorkout.js', 'difficultyTextSelected', '#000', ['colors.primary'], 12, false, 'difficultySelected'],
  ['screens/Trainer/CreateWorkout.js', 'exerciseLabel', 'colors.primary', ['colors.background', 'rgba(255,255,255,0.02)'], 16, true, 'exerciseCard'],
  ['screens/Trainer/CreateWorkout.js', 'removeText', 'colors.error', ['colors.background', 'rgba(255,255,255,0.02)'], 14, true, 'exerciseCard'],
  ['screens/Trainer/CreateWorkout.js', 'chipText', '#94a3b8', ['colors.background', 'rgba(255,255,255,0.02)'], 12, false, 'exerciseCard'],
  ['screens/Trainer/CreateWorkout.js', 'chipTextOn', '#22c55e', ['colors.background', 'rgba(255,255,255,0.02)'], 12, false, 'exerciseCard'],
  ['screens/Trainer/CreateWorkout.js', 'dropdownItemText', '#fff', ['colors.surface'], 14, false, 'dropdown'],
  ['screens/Trainer/CreateWorkout.js', 'statLabel', 'colors.textSecondary', ['colors.background', 'rgba(255,255,255,0.02)'], 10, false, 'exerciseCard'],
  ['screens/Trainer/CreateWorkout.js', 'statInput', '#fff', ['colors.background', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.03)'], 14, false],
  ['screens/Trainer/CreateWorkout.js', 'statInput (placeholder)', 'colors.textSecondary', ['colors.background', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.03)'], 14, false],
  // EditWorkout (container fills the page with Theme.colors.background)
  ['screens/Trainer/EditWorkout.js', 'header', 'colors.primary', ['colors.background'], 24, true, 'container'],
  ['screens/Trainer/EditWorkout.js', 'input', '#fff', ['colors.surface'], 14, false],
  ['screens/Trainer/EditWorkout.js', 'input (placeholder)', '#888', ['colors.surface'], 14, false],
  ['screens/Trainer/EditWorkout.js', 'repsInput', '#fff', ['colors.surface'], 14, false],
  ['screens/Trainer/EditWorkout.js', 'repsInput (placeholder)', '#888', ['colors.surface'], 14, false],
  ['screens/Trainer/EditWorkout.js', 'buttonText', '#000', ['colors.primary'], 14, true, 'addButton'],
  ['screens/Trainer/EditWorkout.js', 'headerCell', 'colors.text', ['colors.background', 'rgba(255,255,255,0.02)'], 12, true, 'headerCellContainer'],
  ['screens/Trainer/EditWorkout.js', 'removeIconText', 'colors.error', ['colors.background', 'rgba(255,255,255,0.02)'], 12, false, 'headerCellContainer'],
  ['screens/Trainer/EditWorkout.js', 'subHeaderText', 'colors.textSecondary', ['colors.background'], 10, true, 'container'],
  ['screens/Trainer/EditWorkout.js', 'exerciseText', 'colors.text', ['colors.background'], 13, true, 'container'],
  ['screens/Trainer/EditWorkout.js', 'dataText', '#fff', ['colors.background', 'rgba(255,255,255,0.03)'], 14, true, 'dataBox'],
  ['screens/Trainer/EditWorkout.js', 'dataText (placeholder)', 'colors.textSecondary', ['colors.background', 'rgba(255,255,255,0.03)'], 14, true, 'dataBox'],
  ['screens/Trainer/EditWorkout.js', 'dropdownItemText', '#fff', ['colors.surface'], 14, false, 'dropdown'],
  // TVScreen (white page; session picker and waiting screens on loadingContainer)
  ['screens/Trainer/TVScreen.js', 'loadingText', '#3274ba', [WHITE], 24, true, 'loadingContainer'],
  ['screens/Trainer/TVScreen.js', 'sessionInfoText', '#333', [WHITE], 18, false, 'loadingContainer'],
  ['screens/Trainer/TVScreen.js', 'connectionStatus', '#666', [WHITE], 16, false, 'loadingContainer'],
  ['screens/Trainer/TVScreen.js', 'noSessionsText', '#495057', ['#f8f9fa'], 16, false, 'sessionsContainer'],
  ['screens/Trainer/TVScreen.js', 'sessionName', 'colors.blueText', ['#e9ecef'], 18, true, 'sessionItem'],
  ['screens/Trainer/TVScreen.js', 'sessionDetails', '#495057', ['#e9ecef'], 14, false, 'sessionItem'],
  ['screens/Trainer/TVScreen.js', 'refreshButtonText', '#1A1A1A', ['colors.primary'], 14, true, 'refreshButton'],
  ['screens/Trainer/TVScreen.js', 'leaveButtonText', '#fff', ['#dc3545'], 14, true, 'leaveButton'],
  ['screens/Trainer/TVScreen.js', 'sessionInfoName', '#fff', ['#3274ba'], 16, true, 'sessionInfoBar'],
  ['screens/Trainer/TVScreen.js', 'leaveSessionText', '#fff', ['#dc3545'], 12, true, 'leaveSessionButton'],
  ['screens/Trainer/TVScreen.js', 'timerDisplay', '#3274ba', [WHITE], 28, true, 'fullScreen'],
  ['screens/Trainer/TVScreen.js', 'timerDisplay (running)', '#3274ba', ['#e6f7ff'], 28, true, 'timerRunning'],
  ['screens/Trainer/TVScreen.js', 'timerWarning', 'colors.dangerStrong', ['#fff1f0'], 28, true],
  ['screens/Trainer/TVScreen.js', 'groupLabel', '#1A1A1A', [WHITE], 14, false, 'fullScreen'],
  ['screens/Trainer/TVScreen.js', 'headerCell', '#1A1A1A', ['#8ebce6'], 16, true, 'firstColumn'],
  ['screens/Trainer/TVScreen.js', 'headerCellText (group pink)', '#1A1A1A', ['#fcc0d8'], 16, true, 'groupColors[0]'],
  ['screens/Trainer/TVScreen.js', 'headerCellText (group orange)', '#1A1A1A', ['#fc6e4c'], 16, true, 'groupColors[1]'],
  ['screens/Trainer/TVScreen.js', 'headerCellText (group gold)', '#1A1A1A', ['colors.primary'], 16, true, 'groupColors[2]'],
  ['screens/Trainer/TVScreen.js', 'headerCellText (group blue)', '#1A1A1A', ['#8ebce6'], 16, true, 'groupColors[3]'],
  ['screens/Trainer/TVScreen.js', 'exerciseText', '#1A1A1A', ['#8ebce6'], 16, true, 'firstColumn'],
  ['screens/Trainer/TVScreen.js', 'dataText', '#1A1A1A', ['#f7f7f7'], 14, true, 'dataCell'],
  ['screens/Trainer/TVScreen.js', 'dataText (current)', '#1A1A1A', ['#f0f9ff'], 14, true, 'highlightedCell'],
  ['screens/Trainer/TVScreen.js', 'cornerRefreshText', '#fff', ['#3274ba'], 24, true, 'cornerRefreshButton'],
  ['screens/Trainer/TVScreen.js', 'debugText', '#333', ['#f0f0f0'], 12, false, 'debugContainer'],
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
  // G62
  'screens/Client/LifestyleScreen.js::input (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Trainer/ClientsManagementScreen.js::input (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Trainer/ProgramBuilderScreen.js::input (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Trainer/ProgramsListScreen.js::input (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Trainer/WorkoutsMenu.js::searchInput (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Trainer/ClientOverview.js::searchInput (placeholder)': { prop: 'placeholderTextColor' },
  'screens/Trainer/TrainerScreen.js::sessionInput (placeholder)': { prop: 'placeholderTextColor', tagHas: 'styles.sessionInput' },
  'screens/Trainer/TrainerScreen.js::dataText (placeholder)': { prop: 'placeholderTextColor', tagHas: 'styles.dataText' },
  'screens/Trainer/TrainerScreen.js::input (placeholder)': { prop: 'placeholderTextColor', tagHas: 'style={styles.input}' },
  'screens/Trainer/TrainerScreen.js::liveSessionInput (placeholder)': { prop: 'placeholderTextColor', tagHas: 'styles.liveSessionInput' },
  'screens/Trainer/CreateWorkout.js::input (placeholder)': { prop: 'placeholderTextColor', tagHas: 'style={styles.input}' },
  'screens/Trainer/CreateWorkout.js::statInput (placeholder)': { prop: 'placeholderTextColor', tagHas: 'styles.statInput' },
  'screens/Trainer/EditWorkout.js::input (placeholder)': { prop: 'placeholderTextColor', tagHas: 'style={styles.input}' },
  'screens/Trainer/EditWorkout.js::repsInput (placeholder)': { prop: 'placeholderTextColor', tagHas: 'styles.repsInput' },
  // MemoizedInput renders the grid cells with `style={style}` (styles.dataText passed in)
  'screens/Trainer/EditWorkout.js::dataText (placeholder)': { prop: 'placeholderTextColor', tagHas: 'style={style}' },
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

/**
 * A colour expression from source -> a colour string, or null if it is not a plain value.
 * G62 — also `primaryAlpha(n)` (the theme gold at opacity n) and `A || B` (the first operand that
 * resolves, as JS does: `Theme.colors.muted || '#888'` is '#888' because `muted` is no token).
 */
function resolveExpr(expr) {
  const e = expr.trim();
  if (e.includes('||')) {
    for (const part of e.split('||')) {
      const v = resolveExpr(part);
      if (v) return v;
    }
    return null;
  }
  let m = e.match(/^['"`]([^'"`]+)['"`]$/);
  if (m) return m[1];
  m = e.match(/^Theme\??\.colors\??\.(\w+)$/);
  if (m) return THEME.colors[m[1]] ?? null;
  m = e.match(/^primaryAlpha\(\s*([\d.]+)\s*\)$/);
  if (m) return gold(+m[1]);
  return null;
}

// G62 — a property value runs to the next top-level `,` / `}` / newline; a quoted string may hold
// commas ('rgba(255,255,255,0.5)'), which the G61 reader cut short.
const VALUE = String.raw`((?:'[^'\n]*'|"[^"\n]*"|[^,}\n'"])+)`;

/** All `color:` expressions (not backgroundColor/borderColor) in a block of source. */
function colorExprs(block) {
  return [...block.matchAll(new RegExp(String.raw`(?:^|[\s{,])color\s*:\s*` + VALUE, 'g'))].map((m) => m[1]);
}

/** All `backgroundColor:` expressions in a block of source. */
function bgExprs(block) {
  return [...block.matchAll(new RegExp(String.raw`(?:^|[\s{,])backgroundColor\s*:\s*` + VALUE, 'g'))].map((m) => m[1]);
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
    // `prop={expr}` or `prop="literal"`; G62 — `tagHas` narrows to the JSX tags whose attributes
    // contain that text (one input style in a file that uses several placeholder colours).
    const re = new RegExp(`${bind.prop}=(?:\\{([^}]+)\\}|("[^"]*"))`, 'g');
    const vals = [...src.matchAll(re)]
      .filter((m) => !bind.tagHas || tagAround(src, m.index).includes(bind.tagHas))
      .map((m) => m[1] ?? m[2]);
    return one(vals, bind.tagHas ? `${bind.prop} on ${bind.tagHas}` : bind.prop);
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

/** The source of the JSX opening tag that contains index `at` (from its `<` to the `>`). */
function tagAround(src, at) {
  const open = src.lastIndexOf('<', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') depth--;
    else if (src[i] === '>' && depth === 0 && src[i - 1] !== '=') return src.slice(open, i);
  }
  return src.slice(open);
}

/**
 * G62 — the background the source actually draws behind a pair -> { bg, from } (bound), {} (the
 * table's hand-declared layers stand), or { error } (UNBOUND).
 *   1. the text style's own `backgroundColor:` (a text style with a fill: badges, chips);
 *   2. else the pair's 7th field, the style key of the container the text sits on (a button);
 *   3. else nothing: the background comes from a parent View, a GlassCard, a gradient or a
 *      runtime colour, and stays declared by hand.
 * A container named in (2) that is missing, sets no backgroundColor, or sets a non-plain one
 * (a ternary, a variable) is UNBOUND, the same rule as text.
 */
export function sourceBackground(file, style, bgKey, read) {
  const src = read(file);
  const read1 = (key, required) => {
    const block = styleBlock(src, key);
    if (block === null) return required ? { error: `background style ${key} not found` } : {};
    const exprs = bgExprs(block);
    if (!exprs.length) return required ? { error: `background style ${key} sets no backgroundColor` } : {};
    const vals = [...new Set(exprs.map(resolveExpr))];
    if (vals.includes(null)) return { error: `${key}.backgroundColor is not a plain colour: ${exprs.join(' | ')}` };
    if (vals.length > 1) return { error: `${key}.backgroundColor disagrees: ${vals.join(', ')}` };
    return { bg: vals[0], from: key };
  };
  const own = /^[a-z]\w*$/.test(style.split(' ')[0]) ? read1(style.split(' ')[0], false) : {};
  if (own.bg || own.error) return own;
  if (!bgKey) return {};
  // `groupColors[2]`: element n of a `const groupColors = [...]` literal (a runtime fill picked
  // from a fixed list, like the participant header cells)
  const el = bgKey.match(/^(\w+)\[(\d+)\]$/);
  if (el) {
    const m = src.match(new RegExp(`const ${el[1]}\\s*=\\s*\\[([^\\]]*)\\]`));
    if (!m) return { error: `array ${el[1]} not found` };
    const items = m[1].split(',').map((x) => x.trim()).filter(Boolean);
    const v = items[+el[2]] === undefined ? null : resolveExpr(items[+el[2]]);
    return v ? { bg: v, from: bgKey } : { error: `${bgKey} is not a plain colour` };
  }
  return read1(bgKey, true);
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
  return pairs.map(([file, style, declared, declaredBg, size, bold, bgKey]) => {
    const need = isLarge(size, bold) ? 3 : 4.5;
    const src = sourceColor(file, style, read);
    const base = { file, style, declared: resolve(declared), size, bold, need };
    const unbound = (note) => ({ ...base, fg: src.fg ?? '?', bg: declaredBg.map(resolve).join(' + '), bgFrom: '?', ratio: NaN, result: 'UNBOUND', note, pass: false });
    if (src.error) return unbound(src.error);
    // G62 — the chip map binds fg and bg together; otherwise read the background from source.
    const back = src.bg ? { bg: src.bg, from: 'chip map' } : sourceBackground(file, style, bgKey, read);
    if (back.error) return unbound(back.error);
    const declaredTop = declaredBg[declaredBg.length - 1];
    // a bound background replaces the top declared layer; the layers under it (the page a
    // translucent fill sits on) stay as declared
    const bg = back.bg ? [...declaredBg.slice(0, -1), back.bg] : declaredBg;
    let ratio;
    try {
      ratio = contrast(src.fg, bg);
    } catch (e) {
      return unbound(e.message);
    }
    let result = ratio >= need ? 'pass' : 'FAIL';
    let note = '';
    const fgDrift = !sameColour(src.fg, declared);
    const bgDrift = back.bg && !sameColour(back.bg, declaredTop);
    if (fgDrift || bgDrift) {
      result = ratio >= need ? 'DRIFT' : 'FAIL + DRIFT';
      note = `source ${src.fg}${back.bg ? ` on ${back.bg}` : ''}, table says ${resolve(declared)}${back.bg ? ` on ${resolve(declaredTop)}` : ''}`;
    }
    return { ...base, fg: src.fg, bg: bg.map(resolve).join(' + '), bgFrom: back.from ?? 'declared', ratio, result, note, pass: result === 'pass' };
  });
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const rows = audit();
  console.log('| File | Style | Text | Background | Bg from | Size | Ratio | Needs | Result |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    const result = r.pass ? 'pass' : `**${r.result}**${r.note ? ` (${r.note})` : ''}`;
    const ratio = Number.isNaN(r.ratio) ? '?' : r.ratio.toFixed(2);
    console.log(`| ${r.file} | ${r.style} | ${r.fg} | ${r.bg} | ${r.bgFrom} | ${r.size}${r.bold ? ' bold' : ''} | ${ratio}:1 | ${r.need}:1 | ${result} |`);
  }
  const failed = rows.filter((r) => !r.pass);
  const bound = rows.filter((r) => r.bgFrom && r.bgFrom !== 'declared' && r.bgFrom !== '?').length;
  console.log(`\n${rows.length} pairs (${bound} with the background read from source), ${failed.length} failing`);
  process.exit(failed.length ? 1 : 0);
}
