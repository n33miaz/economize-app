import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { colors, darkTheme } from "../theme/colors";
import { ds } from "../theme/ds";

interface IndicatorCardProps {
  name: string;
  id: string;
  value: number | null | undefined;
  variation: number | null | undefined;
  isFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: (id: string) => void;
  symbol?: string;
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
  }: IndicatorCardProps) => {
    const scale = useSharedValue(1);

    const safeValue = Number(value) || 0;
    const safeVariation = Number(variation) || 0;

    const variationInfo = useMemo(() => {
      const isPositive = safeVariation >= 0;
      return {
        color: isPositive ? colors.success : colors.danger,
        bgColor: isPositive
          ? darkTheme.semantic.successMuted
          : darkTheme.semantic.dangerMuted,
        icon: isPositive ? "caret-up" : "caret-down",
        formatted: `${isPositive ? "+" : ""}${safeVariation.toFixed(2)}%`,
      };
    }, [safeVariation]);

    const displayName = useMemo(() => {
      return name?.split("/")[0].replace("Comercial", "").trim() || "Ativo";
    }, [name]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: scale.value }],
    }));

    const handlePressIn = () => {
      scale.value = withSpring(0.97);
    };

    const handlePressOut = () => {
      scale.value = withSpring(1);
    };

    return (
      <Animated.View style={animatedStyle}>
        <TouchableOpacity
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={0.8}
          style={{
            padding: ds.spacing[5],
            borderRadius: ds.radius["3xl"],
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.cardBackground,
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
                  backgroundColor: darkTheme.accent.neonMuted,
                }}
              >
                <Ionicons name="cash-outline" size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[ds.typography.bodyLg, { color: colors.textPrimary }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text style={[ds.typography.bodySm, { color: colors.textSecondary }]}>
                  {symbol} - BRL
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
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={22}
                color={isFavorite ? colors.warning : colors.inactive}
              />
            </TouchableOpacity>
          </View>

          <View
            style={{
              width: "100%",
              height: 1,
              marginBottom: ds.spacing[4],
              backgroundColor: darkTheme.border.subtle,
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
                  { color: colors.textSecondary, marginBottom: ds.spacing[1] },
                ]}
              >
                Cotação Atual
              </Text>
              <Text style={[ds.typography.numericLg, { color: colors.textPrimary }]}>
                {symbol} {safeValue.toFixed(2)}
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
              <Ionicons
                name={variationInfo.icon as any}
                size={12}
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

export default IndicatorCard;
