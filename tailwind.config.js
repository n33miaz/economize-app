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
        primary: "#00ADEF",
        primaryDark: "#053D99",
        secondary: "#FBBA00",
        success: "#00C853",
        danger: "#FF3B30",
        warning: "#FFCC00",
        background: {
          DEFAULT: "#F2F4F7",
          light: "#FFFFFF",
        },
        cardBackground: "#FFFFFF",
        textPrimary: "#1B1D29",
        textSecondary: "#6B7280",
        inactive: "#94A3B8",
        border: "#E2E8F0",
      },
    },
  },
  plugins: [],
};
