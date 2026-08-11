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
      // Espelho estático do darkTheme de src/theme/colors.ts (default do app);
      // light mode resolve em runtime via useTheme().
      // `accent*` é a grafia atual; `neon*` fica como alias de compatibilidade.
      colors: {
        primary: "#F2C14E",
        primaryDark: "#0F0E0B",
        secondary: "#FB923C",
        accent: "#F2C14E",
        accentPressed: "#DFAB2F",
        accentMuted: "rgba(242, 193, 78, 0.14)",
        neon: "#F2C14E",
        neonPressed: "#DFAB2F",
        neonMuted: "rgba(242, 193, 78, 0.14)",
        success: "#55D97F",
        danger: "#F87171",
        warning: "#FB923C",
        info: "#60A5FA",
        background: {
          DEFAULT: "#0F0E0B",
          light: "#181713",
          surface: "#181713",
          elevated: "#22201B",
        },
        surface: "#181713",
        elevated: "#22201B",
        cardBackground: "#181713",
        textPrimary: "#F6F5F4",
        textSecondary: "#AFABA1",
        textTertiary: "#757166",
        inactive: "#757166",
        border: "#35332C",
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
