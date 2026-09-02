import React from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import ChevronLeft from "lucide-react-native/dist/esm/icons/chevron-left";
import Info from "lucide-react-native/dist/esm/icons/info";
import User from "lucide-react-native/dist/esm/icons/user";
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
   * Seta de voltar à esquerda do título. Sem valor, aparece sozinha nas
   * telas EMPILHADAS (pilha com histórico) e nunca nas raízes das abas.
   * Existe por causa da web: no celular há o botão do sistema e o gesto de
   * borda; no navegador uma tela empilhada sem seta é beco sem saída — a
   * barra de abas fica coberta e nada na interface diz como voltar.
   */
  showBackButton?: boolean;
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
  showBackButton,
  topInset = true,
}: ScreenHeaderProps) {
  const t = useTheme();
  const navigation = useNavigation();
  // Home, Finanças e Mercado vivem dentro do navegador de abas: para elas
  // `getState()` é o estado da aba, não da pilha, e a seta não aparece
  const navState = navigation.getState();
  const isPushed = navState?.type === "stack" && navigation.canGoBack();
  const showBack = showBackButton ?? isPushed;
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
        {showBack && (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            className="bg-elevated active:bg-border"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing[3],
            }}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={20} color={t.text.primary} />
          </TouchableOpacity>
        )}
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
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
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
