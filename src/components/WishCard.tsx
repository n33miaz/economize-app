import React from "react";
import { Pressable, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { formatBRL } from "../utils/money";
import {
  describeLifeCost,
  describePace,
  formatHours,
  formatWorkDays,
  statusLabel,
  wishProgress,
} from "../utils/wishes";
import type { Wish } from "../services/api";

/**
 * O cartão de um desejo.
 *
 * <p>A hierarquia da leitura é deliberada: primeiro o que a coisa custa da
 * SUA vida (as horas), depois o preço em reais. Invertido, o cartão vira mais
 * uma etiqueta de loja — e a tradução para tempo é a razão de a tela existir.
 */
export default function WishCard({
  wish,
  hoursPerMonth,
  onPress,
}: {
  wish: Wish;
  hoursPerMonth: number | null;
  onPress?: () => void;
}) {
  const t = useTheme();
  const { projection } = wish;

  const hours = formatHours(projection.hoursOfWork);
  const days = formatWorkDays(projection.workDays);
  const lifeCost = describeLifeCost(projection.hoursOfWork, hoursPerMonth);
  const pace = describePace(projection);
  const progress = wishProgress(wish);
  const comprado = wish.status === "PURCHASED";

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${wish.name}, ${formatBRL(wish.targetAmount)}${
        hours ? `, ${hours} de trabalho` : ""
      }`}
      className="bg-cardBackground rounded-2xl p-4 mb-3 border border-border"
    >
      <View className="flex-row items-start justify-between mb-1">
        <Text
          className="text-base font-bold text-textPrimary flex-1 pr-2"
          numberOfLines={1}
        >
          {wish.name}
        </Text>
        <View
          className="px-2 py-1 rounded-lg"
          style={{
            backgroundColor: comprado
              ? t.semantic.successMuted
              : t.background.elevated,
          }}
        >
          <Text
            className="text-[10px] font-bold"
            style={{ color: comprado ? t.semantic.success : t.text.tertiary }}
          >
            {statusLabel(wish.status).toUpperCase()}
          </Text>
        </View>
      </View>

      {/* O preço em tempo de vida vem primeiro, e é o número grande */}
      {hours ? (
        <Text className="text-2xl font-bold" style={{ color: t.accent.neon }}>
          {hours}
        </Text>
      ) : (
        <Text className="text-2xl font-bold text-textPrimary">
          {formatBRL(wish.targetAmount)}
        </Text>
      )}

      <Text className="text-xs text-textSecondary mt-0.5">
        {[hours ? formatBRL(wish.targetAmount) : null, days, lifeCost]
          .filter(Boolean)
          .join(" · ")}
      </Text>

      {wish.savedAmount > 0 && (
        <View className="mt-3">
          <View
            className="h-1.5 rounded-full overflow-hidden"
            style={{ backgroundColor: t.background.elevated }}
          >
            <View
              style={{
                width: `${Math.round(progress * 100)}%`,
                height: "100%",
                backgroundColor: t.semantic.success,
              }}
            />
          </View>
          <Text className="text-[11px] text-textSecondary mt-1">
            {formatBRL(wish.savedAmount)} de {formatBRL(wish.targetAmount)} guardados
          </Text>
        </View>
      )}

      {pace && !comprado && (
        <Text className="text-xs text-textSecondary mt-2">{pace}</Text>
      )}
    </Pressable>
  );
}
