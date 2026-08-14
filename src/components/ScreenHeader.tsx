import React from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Info, User } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";

import { useTheme } from "../theme/ThemeProvider";
import { spacing, radius } from "../theme/ds";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode[];
  showInfoButton?: boolean;
  showProfileButton?: boolean;
  /**
   * Telas apresentadas como modal já nascem abaixo da status bar; somar o
   * statusBarHeight nelas cria uma faixa morta no topo (iOS). Passe false
   * nesses casos para usar só o respiro padrão.
   */
  topInset?: boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightActions,
  showInfoButton = true,
  showProfileButton = true,
  topInset = true,
}: ScreenHeaderProps) {
  const t = useTheme();
  const navigation = useNavigation();
  const paddingTop = topInset
    ? Constants.statusBarHeight + spacing[5]
    : spacing[5];

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
        backgroundColor={t.background.base}
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
              accessibilityRole="button"
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
              <Info size={18} color={t.text.primary} />
            </TouchableOpacity>
          )}

          {showProfileButton && (
            <TouchableOpacity
              accessibilityLabel="Perfil"
              accessibilityRole="button"
              className="bg-elevated active:bg-border"
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => navigation.navigate("Profile" as never)}
            >
              <User size={18} color={t.text.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}
