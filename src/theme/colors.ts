export const darkTheme = {
  background: {
    base: "#0A0A0A",
    surface: "#141414",
    elevated: "#1C1C1C",
    overlay: "rgba(0, 0, 0, 0.72)",
  },
  border: {
    subtle: "#1F1F1F",
    default: "#2A2A2A",
    strong: "#3A3A3A",
  },
  text: {
    primary: "#F5F5F5",
    secondary: "#A3A3A3",
    tertiary: "#6B6B6B",
    inverse: "#0A0A0A",
    disabled: "#4A4A4A",
  },
  accent: {
    neon: "#00FF88",
    neonPressed: "#00D973",
    neonMuted: "rgba(0, 255, 136, 0.12)",
  },
  semantic: {
    success: "#22C55E",
    successMuted: "rgba(34, 197, 94, 0.15)",
    danger: "#EF4444",
    dangerMuted: "rgba(239, 68, 68, 0.15)",
    warning: "#F59E0B",
    warningMuted: "rgba(245, 158, 11, 0.15)",
    info: "#3B82F6",
    infoMuted: "rgba(59, 130, 246, 0.15)",
  },
  brand: {
    primary: "#00FF88",
    primaryDark: "#0A0A0A",
  },
} as const;

export const lightTheme = {
  background: {
    base: "#F5F5F5",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    overlay: "rgba(10, 10, 10, 0.5)",
  },
  border: {
    subtle: "#EAEAEA",
    default: "#D4D4D4",
    strong: "#A3A3A3",
  },
  text: {
    primary: "#0A0A0A",
    secondary: "#4A4A4A",
    tertiary: "#737373",
    inverse: "#F5F5F5",
    disabled: "#B4B4B4",
  },
  accent: {
    neon: "#00C26B",
    neonPressed: "#00A85C",
    neonMuted: "rgba(0, 194, 107, 0.12)",
  },
  semantic: {
    success: "#16A34A",
    successMuted: "rgba(22, 163, 74, 0.12)",
    danger: "#DC2626",
    dangerMuted: "rgba(220, 38, 38, 0.12)",
    warning: "#D97706",
    warningMuted: "rgba(217, 119, 6, 0.12)",
    info: "#2563EB",
    infoMuted: "rgba(37, 99, 235, 0.12)",
  },
  brand: {
    primary: "#00C26B",
    primaryDark: "#0A0A0A",
  },
} as const;

export type AppTheme = typeof darkTheme;

export const colors = {
  primary: darkTheme.accent.neon,
  primaryDark: darkTheme.background.base,
  secondary: darkTheme.semantic.warning,
  success: darkTheme.semantic.success,
  danger: darkTheme.semantic.danger,
  warning: darkTheme.semantic.warning,
  background: {
    DEFAULT: darkTheme.background.base,
    light: darkTheme.background.surface,
  },
  cardBackground: darkTheme.background.surface,
  textPrimary: darkTheme.text.primary,
  textSecondary: darkTheme.text.secondary,
  textLight: darkTheme.text.inverse,
  inactive: darkTheme.text.tertiary,
  border: darkTheme.border.default,
  shadow: darkTheme.accent.neon,
  overlay: darkTheme.background.overlay,
};
