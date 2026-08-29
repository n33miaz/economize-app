import React from "react";
import { Text, TouchableOpacity } from "react-native";
import Settings2 from "lucide-react-native/dist/esm/icons/settings-2";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { describeWindow, formatWindowLabel } from "../utils/cycleWindow";

interface CycleWindowChipProps {
  start: string | null | undefined;
  end: string | null | undefined;
  onPress: () => void;
}

/**
 * A janela que está sendo somada, com a engrenagem que abre a escolha da
 * âncora (EC-092). O recorte fica visível o tempo todo de propósito: os totais
 * mudam quando o ciclo não começa no dia 1, e um número sem período escrito ao
 * lado é um número que o usuário não consegue conferir.
 */
export default function CycleWindowChip({
  start,
  end,
  onPress,
}: CycleWindowChipProps) {
  const t = useTheme();
  const label = formatWindowLabel(start, end);
  const spoken = describeWindow(start, end);

  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityLabel={
        spoken
          ? `Janela ${spoken}. Toque para escolher o dia em que seu mês vira`
          : "Escolher o dia em que seu mês vira"
      }
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 30,
        paddingHorizontal: spacing[3],
        borderRadius: radius.full,
        backgroundColor: t.background.elevated,
        borderWidth: 1,
        borderColor: t.border.subtle,
      }}
    >
      {label ? (
        <Text
          numberOfLines={1}
          style={{
            color: t.text.secondary,
            fontSize: 12,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
            marginRight: spacing[2],
          }}
        >
          {label}
        </Text>
      ) : null}
      <Settings2 size={13} color={t.text.tertiary} />
    </TouchableOpacity>
  );
}
