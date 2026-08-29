import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";

export interface ChipOption {
  key: string;
  label: string;
  /** Quantidade opcional ao lado do rótulo — some quando é `undefined`. */
  count?: number;
}

interface FilterChipRowProps {
  options: ChipOption[];
  value: string;
  onChange: (key: string) => void;
  /**
   * Entra no rótulo falado de cada chip ("Origem: Nubank"). Sem ele, um leitor
   * de tela ouve só nomes soltos e não sabe o que a fileira decide.
   */
  spokenPrefix: string;
}

/**
 * Fileira de filtros mutuamente exclusivos, rolável na horizontal.
 *
 * Por que não o `SegmentedControl`: ele reparte a largura em partes iguais e
 * assume 2 a 4 opções curtas. Aqui o número de opções vem dos dados (um chip
 * por conta do usuário) e os rótulos são nomes de cartão inteiros — repartir a
 * tela entre cinco deles deixaria "Ultravioleta ····1234" em duas letras.
 *
 * O chip ativo é o único que veste o accent, que é a regra da casa: a marca
 * marca interação, nunca dado.
 */
export default function FilterChipRow({
  options,
  value,
  onChange,
  spokenPrefix,
}: FilterChipRowProps) {
  const t = useTheme();

  if (options.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // O respiro lateral é do contêiner de conteúdo: a fileira sangra até a
      // borda de propósito, para o último chip não parecer cortado
      contentContainerStyle={{ gap: spacing[2], paddingRight: spacing[1] }}
    >
      {options.map((option) => {
        const active = option.key === value;
        return (
          <TouchableOpacity
            key={option.key}
            onPress={() => {
              if (active) return;
              Haptics.selectionAsync();
              onChange(option.key);
            }}
            accessibilityLabel={`${spokenPrefix}: ${option.label}${
              option.count === undefined
                ? ""
                : `, ${option.count} ${option.count === 1 ? "lançamento" : "lançamentos"}`
            }`}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            hitSlop={{ top: 6, bottom: 6, left: 0, right: 0 }}
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              minHeight: 36,
              paddingHorizontal: spacing[3],
              borderRadius: radius.full,
              backgroundColor: active
                ? t.accent.neonMuted
                : t.background.elevated,
              borderWidth: 1,
              borderColor: active ? t.accent.neon : t.border.subtle,
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                color: active ? t.accent.neon : t.text.secondary,
                fontSize: 12,
                fontWeight: "700",
                maxWidth: 190,
              }}
            >
              {option.label}
            </Text>
            {option.count === undefined ? null : (
              <View
                style={{
                  marginLeft: spacing[2],
                  paddingHorizontal: 6,
                  borderRadius: radius.full,
                  backgroundColor: active
                    ? "transparent"
                    : t.background.surface,
                }}
              >
                <Text
                  style={{
                    color: active ? t.accent.neon : t.text.tertiary,
                    fontSize: 11,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {option.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
