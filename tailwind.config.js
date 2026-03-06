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
        primary: "#00AEEF",
        primaryDark: "#002E5D",
        secondary: "#F4A900",
        success: "#10B981",
        danger: "#EF4444",
        warning: "#F59E0B",
        background: {
          DEFAULT: "#F8FAFC",
          light: "#FFFFFF",
        },
        cardBackground: "#FFFFFF",
        textPrimary: "#0F172A",
        textSecondary: "#64748B",
        inactive: "#CBD5E1",
        border: "#E2E8F0",
      },
    },
  },
  plugins: [],
};
