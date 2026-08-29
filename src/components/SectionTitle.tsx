import React from "react";
import { Text } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";

// Rótulo de seção das telas de conta: uppercase pequeno em cor terciária —
// organiza a página sem competir com o conteúdo dos cards
export default function SectionTitle({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text
      accessibilityRole="header"
      style={{
        color: t.text.tertiary,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginTop: spacing[5],
        marginBottom: spacing[2],
      }}
    >
      {children}
    </Text>
  );
}
