import React, { useCallback, useEffect, useRef } from "react";
import { ScrollView, Text, TouchableOpacity } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatMonthLabel } from "../utils/cycleWindow";

// Reexportado porque as telas já o consomem daqui; a implementação mora no
// util da janela, junto do resto da aritmética de período (EC-092)
export { formatMonthLabel };

interface MonthSelectorProps {
  /** Chaves `yyyy-MM`. Em modo janela, o mês em que cada ciclo começa. */
  months: string[];
  selected: string | null;
  onSelect: (month: string) => void;
  /** Rótulo do chip; por padrão, o mês. Em modo janela, o ciclo. */
  formatLabel?: (month: string) => string;
  /** Descrição falada do chip — em modo janela, o recorte por extenso. */
  describeOption?: (month: string) => string;
}

/**
 * Linha horizontal de chips com os períodos que têm movimento. O chip
 * selecionado veste o accent; os demais ficam em surface. Ao trocar a
 * seleção, a linha rola sozinha até deixar o chip ativo visível.
 */
export default function MonthSelector({
  months,
  selected,
  onSelect,
  formatLabel,
  describeOption,
}: MonthSelectorProps) {
  const t = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  // Posições medidas por mês: a rolagem automática precisa do x real do chip
  const layoutsRef = useRef<Record<string, { x: number; width: number }>>({});

  const scrollToSelected = useCallback(() => {
    if (!selected) return;
    const layout = layoutsRef.current[selected];
    if (!layout) return;
    scrollRef.current?.scrollTo({
      x: Math.max(layout.x - spacing[5], 0),
      animated: true,
    });
  }, [selected]);

  useEffect(() => {
    scrollToSelected();
  }, [scrollToSelected]);

  if (months.length === 0) return null;

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: spacing[5],
        gap: spacing[2],
      }}
    >
      {months.map((month) => {
        const active = month === selected;
        const label = formatLabel ? formatLabel(month) : formatMonthLabel(month);
        const spoken = describeOption
          ? describeOption(month)
          : `Ver análise de ${label}`;
        return (
          <TouchableOpacity
            key={month}
            onLayout={(e) => {
              layoutsRef.current[month] = e.nativeEvent.layout;
              // o primeiro layout pode chegar depois do effect — rola de novo
              if (active) scrollToSelected();
            }}
            onPress={() => {
              if (!active) onSelect(month);
            }}
            activeOpacity={0.8}
            accessibilityLabel={spoken}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={{
              height: 44,
              paddingHorizontal: spacing[4],
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: active
                ? t.accent.neon
                : t.background.surface,
              borderWidth: 1,
              borderColor: active ? t.accent.neon : t.border.subtle,
            }}
          >
            <Text
              style={{
                color: active ? t.text.inverse : t.text.primary,
                fontSize: 13,
                fontWeight: "700",
              }}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
