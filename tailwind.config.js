/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./src/components/**/*.{js,jsx,ts,tsx}",
    "./src/screens/**/*.{js,jsx,ts,tsx}",
    "./src/routes/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#00FF88",
        primaryDark: "#0A0A0A",
        secondary: "#F59E0B",
        neon: "#00FF88",
        neonPressed: "#00D973",
        neonMuted: "rgba(0, 255, 136, 0.12)",
        success: "#22C55E",
        danger: "#EF4444",
        warning: "#F59E0B",
        info: "#3B82F6",
        background: {
          DEFAULT: "#0A0A0A",
          light: "#141414",
          surface: "#141414",
          elevated: "#1C1C1C",
        },
        surface: "#141414",
        elevated: "#1C1C1C",
        cardBackground: "#141414",
        textPrimary: "#F5F5F5",
        textSecondary: "#A3A3A3",
        textTertiary: "#6B6B6B",
        inactive: "#6B6B6B",
        border: "#2A2A2A",
      },
      borderRadius: {
        "2xl": "24px",
        "3xl": "32px",
      },
    },
  },
  plugins: [],
};
