import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import CloudOff from "lucide-react-native/dist/esm/icons/cloud-off";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";

interface ErrorStateProps {
  /** O que aconteceu, na frase que o store já classificou. */
  message?: string;
  /** Título do bloco cheio; o padrão não acusa a rede nem o servidor. */
  title?: string;
  onRetry: () => void;
  /**
   * Faixa de uma linha para quando a tela AINDA tem conteúdo: a lista velha
   * fica, e o aviso com "tentar de novo" entra por cima, sem derrubar nada.
   * Serve também à tela feita de blocos independentes (Investimentos), em que
   * a falha de um bloco não pode ocupar a tela inteira nem gritar ao lado de
   * cinco blocos que carregaram.
   */
  compact?: boolean;
}

/**
 * Falha de leitura com saída.
 *
 * "Conexão perdida" era o título de toda falha — inclusive de um 404 e de um
 * 500 com a rede perfeita. O título agora diz só o que se sabe (não deu para
 * carregar) e a mensagem, vinda do store, diz o porquê quando ele é
 * conhecido. O ícone é neutro pelo mesmo motivo: culpar o wi-fi de quem está
 * online é a versão visual de "servidores instáveis".
 */
export default function ErrorState({
  message = "Não foi possível carregar agora.",
  title = "Não foi possível carregar",
  onRetry,
  compact = false,
}: ErrorStateProps) {
  const t = useTheme();

  if (compact) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: t.background.elevated,
          borderWidth: 1,
          borderColor: t.border.subtle,
          borderRadius: radius.xl,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[2],
          marginBottom: spacing[4],
        }}
      >
        <CloudOff size={16} color={t.text.tertiary} />
        <Text
          className="text-textSecondary text-xs flex-1"
          style={{ marginLeft: spacing[2], lineHeight: 16 }}
        >
          {message}
        </Text>
        <TouchableOpacity
          onPress={onRetry}
          accessibilityLabel="Tentar de novo"
          accessibilityRole="button"
          activeOpacity={0.85}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 44,
            paddingHorizontal: spacing[3],
            marginLeft: spacing[2],
            borderRadius: radius.full,
            backgroundColor: t.accent.neonMuted,
          }}
        >
          <RefreshCw size={14} color={t.accent.neon} />
          <Text
            className="text-accent font-bold text-xs"
            style={{ marginLeft: spacing[1] }}
          >
            Tentar de novo
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="flex-1 justify-center items-center p-6">
      <View className="w-20 h-20 bg-elevated rounded-full justify-center items-center mb-4">
        <CloudOff size={40} color={t.text.secondary} />
      </View>
      <Text className="text-xl font-bold text-textPrimary mb-2 text-center">
        {title}
      </Text>
      <Text className="text-textSecondary text-center mb-8 font-regular">
        {message}
      </Text>
      <TouchableOpacity
        className="bg-primary px-8 py-3.5 rounded-xl active:bg-accentPressed"
        onPress={onRetry}
        accessibilityLabel="Tentar de novo"
        accessibilityRole="button"
      >
        <Text className="text-primaryDark font-bold text-base">
          Tentar de novo
        </Text>
      </TouchableOpacity>
    </View>
  );
}
