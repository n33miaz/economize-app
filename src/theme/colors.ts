// Paleta "Economize Dourado" — neutros com tinta dourada (matiz 43°) para
// coesão de marca. Warning é laranja de propósito: âmbar vestiria a cor da
// marca e viraria ruído semântico. Contraste WCAG (16 pares) e paleta de
// gráficos (CVD + banda de luminosidade) validados por script em 2026-08-10;
// racional e provas em docs/03_DESIGN_SYSTEM.md (workspace, fora do repo).

export const darkTheme = {
  background: {
    base: "#0F0E0B",
    surface: "#181713",
    elevated: "#22201B",
    overlay: "rgba(8, 7, 5, 0.72)",
  },
  border: {
    subtle: "#282520",
    default: "#35332C",
    strong: "#4C483E",
  },
  text: {
    primary: "#F6F5F4",
    secondary: "#AFABA1",
    tertiary: "#757166",
    inverse: "#0F0E0B",
    disabled: "#524F47",
  },
  accent: {
    neon: "#F2C14E",
    neonPressed: "#DFAB2F",
    neonMuted: "rgba(242, 193, 78, 0.14)",
  },
  semantic: {
    success: "#55D97F",
    successMuted: "rgba(85, 217, 127, 0.15)",
    danger: "#F87171",
    dangerMuted: "rgba(248, 113, 113, 0.15)",
    warning: "#FB923C",
    warningMuted: "rgba(251, 146, 60, 0.15)",
    info: "#60A5FA",
    infoMuted: "rgba(96, 165, 250, 0.15)",
  },
  brand: {
    primary: "#F2C14E",
    primaryDark: "#0F0E0B",
  },
  // Séries de gráfico ficam numa banda de luminosidade média — mais profundas
  // que o accent — para leitura sobre superfícies escuras; ordem é fixa
  chart: {
    categorical: [
      "#BC8508",
      "#8F7BE8",
      "#17A2AA",
      "#E05470",
      "#1F94D6",
      "#10A56D",
    ],
    up: "#55D97F",
    down: "#F87171",
    neutral: "#757166",
    line: "#F2C14E",
    grid: "rgba(175, 171, 161, 0.14)",
  },
} as const;

export const lightTheme = {
  background: {
    base: "#F6F5F3",
    surface: "#FFFFFF",
    elevated: "#FFFFFF",
    overlay: "rgba(15, 14, 11, 0.5)",
  },
  border: {
    subtle: "#E9E7E2",
    default: "#D3D1CA",
    strong: "#AFABA1",
  },
  text: {
    primary: "#1A1814",
    secondary: "#504D44",
    tertiary: "#7A766C",
    inverse: "#F8F8F6",
    disabled: "#B9B5AC",
  },
  accent: {
    neon: "#8A6410",
    neonPressed: "#755307",
    neonMuted: "rgba(138, 100, 16, 0.10)",
  },
  semantic: {
    success: "#15803D",
    successMuted: "rgba(21, 128, 61, 0.12)",
    danger: "#DC2626",
    dangerMuted: "rgba(220, 38, 38, 0.12)",
    warning: "#C2410C",
    warningMuted: "rgba(194, 65, 12, 0.12)",
    info: "#2563EB",
    infoMuted: "rgba(37, 99, 235, 0.12)",
  },
  brand: {
    primary: "#8A6410",
    primaryDark: "#0F0E0B",
  },
  chart: {
    categorical: [
      "#9A7100",
      "#6D4FD8",
      "#0891B2",
      "#D23B62",
      "#0673B8",
      "#0E8A5B",
    ],
    up: "#15803D",
    down: "#DC2626",
    neutral: "#7A766C",
    line: "#8A6410",
    grid: "rgba(80, 77, 68, 0.14)",
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
