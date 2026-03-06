import React, { useMemo } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import * as Haptics from "expo-haptics";

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
        color: isPositive ? "text-green-600" : "text-red-500",
        bgColor: isPositive ? "bg-green-100" : "bg-red-100",
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
          className="bg-white rounded-3xl p-5 shadow-md shadow-gray-200/50 border border-gray-100/80"
        >
          <View className="flex-row justify-between items-start mb-4">
            <View className="flex-row items-center flex-1 mr-2">
              <View className="w-10 h-10 rounded-xl bg-blue-50 items-center justify-center mr-3">
                <Ionicons name="cash-outline" size={20} color="#00ADEF" />
              </View>
              <View className="flex-1">
                <Text
                  className="text-gray-900 font-bold text-base"
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text className="text-gray-400 text-xs font-regular">
                  {symbol} - BRL
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleFavorite(id);
              }}
              className="p-2 -mr-2 -mt-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons
                name={isFavorite ? "star" : "star-outline"}
                size={22}
                color={isFavorite ? "#FBBA00" : "#CBD5E1"}
              />
            </TouchableOpacity>
          </View>

          <View className="h-[1px] bg-gray-50 w-full mb-4" />

          <View className="flex-row justify-between items-end">
            <View>
              <Text className="text-gray-400 text-xs mb-1 font-medium">
                Cotação Atual
              </Text>
              <Text className="text-2xl font-bold text-slate-800 tracking-tight">
                {symbol} {safeValue.toFixed(2)}
              </Text>
            </View>

            <View
              className={`flex-row items-center px-2.5 py-1.5 rounded-lg ${variationInfo.bgColor}`}
            >
              <Ionicons
                name={variationInfo.icon as any}
                size={12}
                color={safeVariation >= 0 ? "#16A34A" : "#EF4444"}
                style={{ marginRight: 4 }}
              />
              <Text className={`${variationInfo.color} font-bold text-xs`}>
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
