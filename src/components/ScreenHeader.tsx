import React from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";

import { darkTheme } from "../theme/colors";
import { spacing, radius } from "../theme/ds";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode[];
  showInfoButton?: boolean;
  showProfileButton?: boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightActions,
  showInfoButton = true,
  showProfileButton = true,
}: ScreenHeaderProps) {
  const navigation = useNavigation();
  const paddingTop = Constants.statusBarHeight + spacing[5];

  return (
    <View
      className="bg-background-surface border-b border-border"
      style={{
        paddingTop,
        paddingBottom: spacing[5],
        paddingHorizontal: spacing[5],
        borderBottomLeftRadius: radius["2xl"],
        borderBottomRightRadius: radius["2xl"],
      }}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={darkTheme.background.base}
        translucent
      />

      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-4">
          <Text
            className="text-textPrimary tracking-tight"
            style={{ fontSize: 24, fontWeight: "700" }}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Text>
          {subtitle && (
            <Text
              className="text-textSecondary"
              style={{ fontSize: 13, marginTop: 2, fontWeight: "500" }}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Text>
          )}
        </View>

        <View className="flex-row items-center" style={{ gap: spacing[2] }}>
          {rightActions?.map((action, idx) => (
            <React.Fragment key={idx}>{action}</React.Fragment>
          ))}

          {showInfoButton && (
            <TouchableOpacity
              accessibilityLabel="Sobre o app"
              className="bg-elevated active:bg-border"
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => navigation.navigate("Sobre" as never)}
            >
              <Ionicons
                name="information"
                size={18}
                color={darkTheme.text.primary}
              />
            </TouchableOpacity>
          )}

          {showProfileButton && (
            <TouchableOpacity
              accessibilityLabel="Perfil"
              className="bg-elevated active:bg-border"
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => navigation.navigate("Sobre" as never)}
            >
              <Ionicons
                name="person"
                size={16}
                color={darkTheme.text.primary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
