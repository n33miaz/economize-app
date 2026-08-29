import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import * as Haptics from "../utils/haptics";

// Seletor de opções mutuamente exclusivas (ex.: tema Claro/Escuro/Sistema):
// pílula em surface com o item ativo preenchido pelo accent — o accent só
// aparece no estado selecionado, nunca no repouso
export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (next: T) => void;
  /**
   * "sm" é a pílula compacta das telas de conta. "md" sobe o alvo de toque
   * para os 44px do checklist de acessibilidade — obrigatório quando o
   * controle é escolha principal de formulário, e não ajuste de preferência.
   */
  size?: "sm" | "md";
}) {
  const t = useTheme();
  const optionHeight = size === "md" ? 44 : undefined;
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: t.background.surface,
        borderRadius: radius.full,
        padding: 2,
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => {
              // repetir a opção ativa não muda nada — sem vibrar à toa
              if (active) return;
              Haptics.selectionAsync();
              onChange(opt.value);
            }}
            accessibilityLabel={opt.label}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              minHeight: optionHeight,
              justifyContent: "center",
              borderRadius: radius.full,
              backgroundColor: active ? t.accent.neon : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? t.text.inverse : t.text.primary,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
