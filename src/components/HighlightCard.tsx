import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ArrowDownRight, ArrowUpRight } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { colors, darkTheme } from "../theme/colors";
import { ds } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";

interface HighlightCardProps {
  title: string;
  value: number;
  variation: number;
  Icon: LucideIcon;
  onPress?: () => void;
  /** Tipo do indicador — decide o formato do valor (moeda vs. pontos) */
  type?: string;
}

export default function HighlightCard({
  title,
  value,
  variation,
  Icon,
  onPress,
  type,
}: HighlightCardProps) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const isPositive = variation >= 0;
  const semanticColor = isPositive ? colors.success : colors.danger;
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  // Índice não é dinheiro: pontos em pt-BR; o resto é BRL formatado
  const formattedValue =
    type === "index"
      ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pts`
      : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    // flex:1 dentro de ScrollView horizontal colapsava o card — largura
    // mínima fixa e o conteúdo dita o resto
    <Animated.View
      style={[{ minWidth: 150, marginHorizontal: ds.spacing[2] }, pressStyle]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
        accessibilityLabel={`Detalhes de ${title}`}
        accessibilityRole="button"
        style={{
          padding: ds.spacing[5],
          borderRadius: ds.radius["2xl"],
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.cardBackground,
          ...ds.shadow.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: ds.spacing[3],
          }}
        >
          <View
            style={{
              marginRight: ds.spacing[2],
              padding: ds.spacing[2],
              borderRadius: ds.radius.full,
              backgroundColor: darkTheme.background.elevated,
            }}
          >
            <Icon size={20} color={colors.textSecondary} />
          </View>
          <Text style={[ds.typography.body, { color: colors.textSecondary }]}>
            {title}
          </Text>
        </View>

        <Text
          style={[
            ds.typography.numericLg,
            { color: colors.textPrimary, marginBottom: ds.spacing[2] },
          ]}
        >
          {formattedValue}
        </Text>

        <View
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: ds.spacing[2],
            paddingVertical: ds.spacing[1],
            borderRadius: ds.radius.lg,
            backgroundColor: isPositive
              ? darkTheme.semantic.successMuted
              : darkTheme.semantic.dangerMuted,
          }}
        >
          <DeltaIcon size={14} color={semanticColor} />
          <Text
            style={[
              ds.typography.bodySm,
              {
                marginLeft: ds.spacing[1],
                color: semanticColor,
                fontFamily: "Roboto_700Bold",
              },
            ]}
          >
            {variation.toFixed(2)}%
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
