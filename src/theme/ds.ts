import { Platform } from "react-native";

import { typography } from "./typography";

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  "3xl": 32,
  full: 9999,
} as const;

export const shadow = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  glow: {
    shadowColor: "#00FF88",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
} as const;

export const motion = {
  duration: {
    instant: 150,
    fast: 250,
    base: 300,
    slow: 450,
  },
  easing: {
    standard: [0.2, 0.0, 0.0, 1.0] as const,
    emphasized: [0.3, 0.0, 0.8, 0.15] as const,
  },
} as const;

export const ds = {
  spacing,
  radius,
  shadow,
  typography,
  motion,
} as const;
