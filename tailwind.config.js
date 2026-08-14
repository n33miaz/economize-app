/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/screens/**/*.{js,jsx,ts,tsx}",
    "./src/routes/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  // "class" e não "media": quem manda no tema é a preferência do usuário
  // (`preferencesStore.theme`), sincronizada com o NativeWind no ThemeProvider.
  // Em "media" a escolha "Claro" no app era ignorada pelas classes.
  darkMode: "class",
  theme: {
    extend: {
      // As cores saíram do espelho estático do dark e passaram a apontar para
      // as variáveis de ./global.css, que trocam junto com o tema. Antes, 94
      // classes em 14 arquivos continuavam escuras no tema claro (EC-076).
      // Canal RGB separado para os modificadores de opacidade continuarem
      // funcionando (`bg-danger/15`, `border-danger/40`).
      colors: {
        primary: "rgb(var(--color-accent) / <alpha-value>)",
        primaryDark: "rgb(var(--color-brand-dark) / <alpha-value>)",
        secondary: "rgb(var(--color-warning) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        accentPressed: "rgb(var(--color-accent-pressed) / <alpha-value>)",
        accentMuted: "var(--color-accent-muted)",
        // `neon*` é a grafia antiga, mantida como alias de compatibilidade
        neon: "rgb(var(--color-accent) / <alpha-value>)",
        neonPressed: "rgb(var(--color-accent-pressed) / <alpha-value>)",
        neonMuted: "var(--color-accent-muted)",
        success: "rgb(var(--color-success) / <alpha-value>)",
        danger: "rgb(var(--color-danger) / <alpha-value>)",
        warning: "rgb(var(--color-warning) / <alpha-value>)",
        info: "rgb(var(--color-info) / <alpha-value>)",
        background: {
          DEFAULT: "rgb(var(--color-bg-base) / <alpha-value>)",
          light: "rgb(var(--color-bg-surface) / <alpha-value>)",
          surface: "rgb(var(--color-bg-surface) / <alpha-value>)",
          elevated: "rgb(var(--color-bg-elevated) / <alpha-value>)",
        },
        surface: "rgb(var(--color-bg-surface) / <alpha-value>)",
        elevated: "rgb(var(--color-bg-elevated) / <alpha-value>)",
        cardBackground: "rgb(var(--color-bg-surface) / <alpha-value>)",
        textPrimary: "rgb(var(--color-text-primary) / <alpha-value>)",
        textSecondary: "rgb(var(--color-text-secondary) / <alpha-value>)",
        textTertiary: "rgb(var(--color-text-tertiary) / <alpha-value>)",
        inactive: "rgb(var(--color-text-tertiary) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
      },
      // Espelho de ds.radius: lg/xl também sobem um nível (12/18) para que
      // rounded-lg/xl nas classes signifiquem o mesmo que os tokens do ds.ts
      borderRadius: {
        lg: "12px",
        xl: "18px",
        "2xl": "28px",
        "3xl": "36px",
      },
    },
  },
  plugins: [],
};
