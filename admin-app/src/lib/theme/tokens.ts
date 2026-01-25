export const colors = {
  primaryBlack: '#121212',
  contentBg: '#1E1E1E',
  hotPink: '#FF007A',
  primaryText: '#FFFFFF',
  secondaryText: '#A0A0A0',
  success: '#34C759',
  error: '#FF3B30',
  warning: '#FF9500',
  info: '#5AC8FA',
} as const;

export const typography = {
  display: {
    fontSize: '28px',
    lineHeight: '1.2',
    fontWeight: '700',
  },
  h1: {
    fontSize: '22px',
    lineHeight: '1.3',
    fontWeight: '700',
  },
  h2: {
    fontSize: '18px',
    lineHeight: '1.4',
    fontWeight: '600',
  },
  body: {
    fontSize: '16px',
    lineHeight: '1.5',
    fontWeight: '400',
  },
  caption: {
    fontSize: '14px',
    lineHeight: '1.4',
    fontWeight: '500',
  },
  small: {
    fontSize: '12px',
    lineHeight: '1.3',
    fontWeight: '400',
  },
} as const;

export const borderRadius = {
  card: '12px',
  button: '8px',
  small: '4px',
  input: '8px',
} as const;

export const breakpoints = {
  xs: '320px',
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;
