import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, darkTheme } from "../theme/colors";
import { ds } from "../theme/ds";

interface HighlightCardProps {
  title: string;
  value: number;
  variation: number;
  iconName: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
}

export default function HighlightCard({
  title,
  value,
  variation,
  iconName,
  onPress,
}: HighlightCardProps) {
  const isPositive = variation >= 0;
  const semanticColor = isPositive ? colors.success : colors.danger;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flex: 1,
        minWidth: 150,
        marginHorizontal: ds.spacing[2],
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
          <Ionicons name={iconName} size={20} color={colors.textSecondary} />
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
        R$ {value.toFixed(2)}
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
        <Ionicons
          name={isPositive ? "caret-up" : "caret-down"}
          size={14}
          color={semanticColor}
        />
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
  );
}
