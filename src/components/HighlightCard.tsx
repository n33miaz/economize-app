import React from "react";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface HighlightCardProps {
  title: string;
  value: number;
  variation: number;
  iconName: keyof typeof Ionicons.glyphMap;
}

export default function HighlightCard({
  title,
  value,
  variation,
  iconName,
}: HighlightCardProps) {
  const isPositive = variation >= 0;
  const variationColor = isPositive ? "text-green-600" : "text-red-500";
  const iconColor = isPositive ? colors.success : colors.danger;

  return (
    <View className="bg-white rounded-2xl p-5 flex-1 mx-2 shadow-sm border border-gray-100 min-w-[150px]">
      <View className="flex-row items-center mb-3">
        <View className="bg-gray-50 p-2 rounded-full mr-2">
          <Ionicons name={iconName} size={20} color="#64748B" />
        </View>
        <Text className="text-gray-500 font-regular text-sm">{title}</Text>
      </View>

      <Text className="text-2xl font-bold text-slate-800 mb-2">
        R$ {value.toFixed(2)}
      </Text>

      <View className="flex-row items-center bg-gray-50 self-start px-2 py-1 rounded-lg">
        <Ionicons
          name={isPositive ? "caret-up" : "caret-down"}
          size={14}
          color={iconColor}
        />
        <Text className={`${variationColor} font-bold text-xs ml-1`}>
          {variation.toFixed(2)}%
        </Text>
      </View>
    </View>
  );
}
