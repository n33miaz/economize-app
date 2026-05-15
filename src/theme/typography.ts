import type { TextStyle } from "react-native";

export const typography = {
  display: {
    fontFamily: "Roboto_700Bold",
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 0,
  },
  heading1: {
    fontFamily: "Roboto_700Bold",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0,
  },
  heading2: {
    fontFamily: "Roboto_700Bold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  },
  heading3: {
    fontFamily: "Roboto_700Bold",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyLg: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  body: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  bodySm: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
    textTransform: "uppercase" as const,
  },
  numericDisplay: {
    fontFamily: "Roboto_700Bold",
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
  numericLg: {
    fontFamily: "Roboto_700Bold",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
} as const;
