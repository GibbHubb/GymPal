// G53 — the ONE brand gold. Every gold in screens/ and components/ reads from here.
// Chosen 2026-11-17 as the most-used of the three golds in the tree (#f7bf0b x10, #F6B000 x9,
// #FFD700 x4). To switch gold: change BRAND_GOLD on this line and nothing else (primaryAlpha
// and every tint derive from it); then run `node scripts/contrast_audit.mjs`.
const BRAND_GOLD = '#f7bf0b';

/** The brand gold at opacity `a`, as an rgba() string (tints, chart strokes, glows). */
export function primaryAlpha(a) {
  const h = BRAND_GOLD.slice(1);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

export const Theme = {
  colors: {
    primary: BRAND_GOLD,
    onPrimary: '#1A1A1A', // G53 — text on a gold fill (10.3:1). White on gold is 1.7:1: never use it.
    primaryTint: primaryAlpha(0.12), // G53 — gold-tinted card/banner fill on the dark page
    primaryBorder: primaryAlpha(0.35),
    primaryDark: '#B39700',
    background: '#050505', // Absolute dark depth
    backgroundGradient: ['#0A0A0A', '#1C1C1C'],
    surface: '#161616', // Sleek distinct surface
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    error: '#FF4C4C', // text colour on dark surfaces (4.7:1 or better)
    dangerStrong: '#c62828', // G53 — red FILL behind white text (5.6:1); #FF4C4C/#e53935 fail with white
    // G53 — the TrainingScreen/TVScreen blue family (not re-themed yet, see plan §4)
    blue: '#3274ba', // fill: white text on it is 4.8:1; dark text fails (3.6:1)
    blueLight: '#8ebce6', // fill: dark text on it
    blueText: '#2a64a3', // blue TEXT on white/light-blue surfaces (6.1:1 / 5.5:1)
    placeholderOnLight: '#555555',
    success: '#00E676',
    transparentLight: 'rgba(255, 255, 255, 0.08)',
    transparentDark: 'rgba(0, 0, 0, 0.75)',
    glassBorder: 'rgba(255, 255, 255, 0.15)',
  },
  spacing: {
    s: 8,
    m: 16,
    l: 24,
    xl: 32,
    xxl: 48,
  },
  typography: {
    header: {
      fontSize: 34,
      fontWeight: '900',
      color: '#FFFFFF',
      letterSpacing: 1.5,
      textTransform: 'uppercase',
    },
    title: {
      fontSize: 24,
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.5,
    },
    body: {
      fontSize: 16,
      color: '#E0E0E0',
      lineHeight: 24,
    },
    caption: {
      fontSize: 13,
      color: '#A0A0A0',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
  },
  borderRadius: {
    s: 8,
    m: 14,
    l: 20,
    xl: 30,
    round: 9999,
  },
  shadows: {
    glow: {
      shadowColor: BRAND_GOLD,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 15,
      elevation: 10,
    },
    glass: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.5,
      shadowRadius: 20,
      elevation: 5,
    }
  }
};
