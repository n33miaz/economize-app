import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { ArrowDownRight, ArrowUpRight, Banknote, Star } from "lucide-react-native";
import Animated from "react-native-reanimated";
import * as Haptics from "../utils/haptics";
import { useTheme } from "../theme/ThemeProvider";
import { ds } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";

interface IndicatorCardProps {
  name: string;
  id: string;
  value: number | null | undefined;
  variation: number | null | undefined;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: (id: string) => void;
  symbol?: string;
  code?: string;
  type?: string;
}

const IndicatorCard = React.memo(
  ({
    name,
    id,
    value,
    variation,
    isFavorite,
    onPress,
    onToggleFavorite,
    symbol = "R$",
    code,
    type,
  }: IndicatorCardProps) => {
    const t = useTheme();
    const { pressStyle, onPressIn, onPressOut } = usePressScale();

    const safeValue = Number(value) || 0;
    const safeVariation = Number(variation) || 0;

    const variationInfo = useMemo(() => {
      const isPositive = safeVariation >= 0;
      return {
        color: isPositive ? t.semantic.success : t.semantic.danger,
        bgColor: isPositive
          ? t.semantic.successMuted
          : t.semantic.dangerMuted,
        Icon: isPositive ? ArrowUpRight : ArrowDownRight,
        formatted: `${isPositive ? "+" : ""}${safeVariation.toFixed(2)}%`,
      };
      // `t` na lista: sem ele as cores ficavam presas ao tema da montagem
    }, [safeVariation, t]);

    const displayName = useMemo(() => {
      return name?.split("/")[0].replace("Comercial", "").trim() || "Ativo";
    }, [name]);

    // "R$ - BRL" era o symbol vazando para o lugar do código do ativo
    const subtitle = useMemo(() => {
      if (type === "index" || symbol === "pts") return "pontos";
      return code ? `${code} · BRL` : "BRL";
    }, [type, symbol, code]);

    const displayValue = useMemo(() => {
      // Índices são pontuados (sem "R$"), no formato pt-BR
      if (symbol === "pts") {
        return `${safeValue.toLocaleString("pt-BR", {
          maximumFractionDigits: 0,
        })} pts`;
      }
      return `${symbol} ${safeValue.toFixed(2)}`;
    }, [symbol, safeValue]);

    const VariationIcon = variationInfo.Icon;

    return (
      <Animated.View style={pressStyle}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          activeOpacity={0.8}
          style={{
            padding: ds.spacing[5],
            borderRadius: ds.radius["3xl"],
            borderWidth: 1,
            borderColor: t.border.default,
            backgroundColor: t.background.surface,
            ...ds.shadow.md,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-start",
              marginBottom: ds.spacing[4],
            }}
          >
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                marginRight: ds.spacing[2],
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  marginRight: ds.spacing[3],
                  borderRadius: ds.radius.xl,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: t.accent.neonMuted,
                }}
              >
                <Banknote size={20} color={t.accent.neon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[ds.typography.bodyLg, { color: t.text.primary }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text style={[ds.typography.bodySm, { color: t.text.secondary }]}>
                  {subtitle}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleFavorite(id);
              }}
              style={{
                marginRight: -ds.spacing[2],
                marginTop: -ds.spacing[2],
                padding: ds.spacing[2],
              }}
              accessibilityLabel={
                isFavorite
                  ? `Remover ${displayName} dos favoritos`
                  : `Adicionar ${displayName} aos favoritos`
              }
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              {/* Favorito ativo preenche a estrela com o accent da marca */}
              <Star
                size={20}
                color={isFavorite ? t.accent.neon : t.text.tertiary}
                fill={isFavorite ? t.accent.neon : "none"}
              />
            </TouchableOpacity>
          </View>

          <View
            style={{
              width: "100%",
              height: 1,
              marginBottom: ds.spacing[4],
              backgroundColor: t.border.subtle,
            }}
          />

          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "flex-end",
            }}
          >
            <View>
              <Text
                style={[
                  ds.typography.bodySm,
                  { color: t.text.secondary, marginBottom: ds.spacing[1] },
                ]}
              >
                Cotação Atual
              </Text>
              <Text style={[ds.typography.numericLg, { color: t.text.primary }]}>
                {displayValue}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingHorizontal: ds.spacing[2],
                paddingVertical: ds.spacing[1],
                borderRadius: ds.radius.lg,
                backgroundColor: variationInfo.bgColor,
              }}
            >
              <VariationIcon
                size={14}
                color={variationInfo.color}
                style={{ marginRight: ds.spacing[1] }}
              />
              <Text
                style={[
                  ds.typography.bodySm,
                  {
                    color: variationInfo.color,
                    fontFamily: "Roboto_700Bold",
                  },
                ]}
              >
                {variationInfo.formatted}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  },
);

IndicatorCard.displayName = "IndicatorCard";

export default IndicatorCard;
