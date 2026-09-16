import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import ChevronLeft from "lucide-react-native/dist/esm/icons/chevron-left";
import User from "lucide-react-native/dist/esm/icons/user";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";

import { useTheme } from "../theme/ThemeProvider";
import { spacing, radius } from "../theme/ds";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode[];
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
      // SEM cartucho e SEM linha embaixo. O cabeçalho era uma superfície
      // `surface` com borda inferior E cantos inferiores arredondados — três
      // molduras para o mesmo elemento, e o resultado era uma barra que
      // parecia colada por cima da tela. Foi o que o dono apontou em 15/09:
      // "não parece muito moderno essas bordas".
      //
      // Agora ele usa o fundo da PÁGINA e a hierarquia vem só da tipografia,
      // que é como cabeçalho grande funciona no iOS e no Material 3: o título
      // é o maior texto da tela, e nada precisa desenhar uma caixa em volta
      // dele para provar isso. A separação do conteúdo é o próprio respiro.
      style={{
        backgroundColor: t.background.base,
        paddingTop,
        paddingBottom: spacing[4],
        paddingHorizontal: spacing[5],
      }}
    >
      {/* NÃO existe mais botão de informação aqui. Ele aparecia em QUASE TODA
          tela — um "i" repetido em cima de cada cabeçalho, disputando espaço
          com o título — e apontava para a rota "Sobre", que tinha sido tirada
          da navegação num pedido anterior: era um botão que já não levava a
          lugar nenhum. O dono pediu para tirar todos; este era a fábrica
          deles.

          NÃO declarar StatusBar aqui. Este cabeçalho aparece em quase toda
          tela, e a barra de status é GLOBAL: a declaração daqui sobrescrevia a
          do App.tsx, que é a que segue o tema. Com `light-content` fixo os
          ícones do sistema ficavam brancos -- certo no escuro por acidente, e
          ilegível no modo claro, que é fundo claro com ícone branco.
          Quem manda na barra é o App.tsx, e é um lugar só. */}

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
            // 28 e não 24: com o cartucho fora, é a tipografia que faz a
            // hierarquia. Peso 800 onde a fonte tem — a Roboto do app para em
            // 700, e o `tracking-tight` é o que dá o resto da presença
            style={{ fontSize: 28, fontWeight: "700", lineHeight: 34 }}
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
