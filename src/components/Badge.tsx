import React from "react";
import { Text, View, type StyleProp, type ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";

/**
 * Variantes do §4.4 do design system. Não existe `accent` de propósito: o
 * âmbar é a cor da AÇÃO, e um selo diz estado — pintá-lo de marca faria o
 * olho procurar um botão onde há uma informação.
 */
export type BadgeVariant = "neutral" | "warning" | "success" | "danger" | "info";

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  /** Quando o texto curto não basta para o leitor de tela ("Revisar" → "aguardando revisão"). */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

type Theme = ReturnType<typeof useTheme>;

/**
 * Fundo é o `muted`, texto é o puro (regra do design system). O neutro veste
 * a mesma pílula dos selos de origem e de membro — é procedência, não
 * julgamento — para os três caberem na mesma fileira sem disputar peso.
 */
function paletteFor(t: Theme, variant: BadgeVariant) {
  switch (variant) {
    case "warning":
      return {
        background: t.semantic.warningMuted,
        text: t.semantic.warning,
        border: "transparent",
      };
    case "success":
      return {
        background: t.semantic.successMuted,
        text: t.semantic.success,
        border: "transparent",
      };
    case "danger":
      return {
        background: t.semantic.dangerMuted,
        text: t.semantic.danger,
        border: "transparent",
      };
    case "info":
      return {
        background: t.semantic.infoMuted,
        text: t.semantic.info,
        border: "transparent",
      };
    default:
      return {
        background: t.background.elevated,
        text: t.text.secondary,
        border: t.border.subtle,
      };
  }
}

/** Selo pequeno em pílula: um estado curto ao lado de um conteúdo. */
export default function Badge({
  label,
  variant = "neutral",
  accessibilityLabel,
  style,
}: BadgeProps) {
  const t = useTheme();
  const palette = paletteFor(t, variant);
  return (
    <View
      // Nó acessível único: o leitor lê "aguardando revisão", não uma caixa e
      // depois um texto solto no meio da linha
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[
        {
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          minHeight: 24,
          borderRadius: radius.full,
          paddingHorizontal: spacing[2],
          paddingVertical: 2,
          backgroundColor: palette.background,
          borderWidth: 1,
          borderColor: palette.border,
        },
        style,
      ]}
    >
      <Text
        numberOfLines={1}
        style={{ color: palette.text, fontSize: 11, fontWeight: "600" }}
      >
        {label}
      </Text>
    </View>
  );
}
