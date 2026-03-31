export const Theme = {
  colors: {
    primary: '#FFD700', // Epic Vibrant Gold
    primaryDark: '#B39700',
    background: '#050505', // Absolute dark depth
    backgroundGradient: ['#0A0A0A', '#1C1C1C'],
    surface: '#161616', // Sleek distinct surface
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    error: '#FF4C4C',
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
      shadowColor: '#FFD700',
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
