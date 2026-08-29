import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import SendHorizontal from "lucide-react-native/dist/esm/icons/send-horizontal";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import X from "lucide-react-native/dist/esm/icons/x";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import { ChatMessage, useAiStore } from "../store/aiStore";
import { askConfirm } from "../store/confirmStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const SUGGESTIONS = [
  "Quanto gastei esse mês?",
  "Resumo da semana",
  "Dicas pra economizar",
  "Como diversificar minha carteira?",
];

// Sem animação de entrada: numa lista invertida os presets FadeInUp/Down
// apontam para a direção errada e causam flicker ao paginar o histórico
function MessageBubble({
  item,
  onRetry,
}: {
  item: ChatMessage;
  onRetry: (item: ChatMessage) => void;
}) {
  const t = useTheme();
  const isUser = item.isUser;
  const bubbleBg = item.isError
    ? t.semantic.dangerMuted
    : isUser
      ? t.accent.neonMuted
      : t.background.elevated;
  const borderColor = item.isError
    ? t.semantic.danger
    : isUser
      ? t.accent.neon
      : t.border.subtle;

  return (
    <View
      style={{
        marginBottom: spacing[3],
        maxWidth: "86%",
        alignSelf: isUser ? "flex-end" : "flex-start",
      }}
    >
      <View
        style={{
          backgroundColor: bubbleBg,
          borderWidth: 1,
          borderColor,
          padding: spacing[3],
          borderRadius: radius.xl,
          borderTopRightRadius: isUser ? radius.sm : radius.xl,
          borderTopLeftRadius: isUser ? radius.xl : radius.sm,
        }}
      >
        {!isUser && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 4,
            }}
          >
            <Sparkles size={12} color={t.accent.neon} />
            <Text
              style={{
                color: t.accent.neon,
                fontWeight: "700",
                fontSize: 11,
                marginLeft: 4,
              }}
            >
              Nino
            </Text>
          </View>
        )}
        <Text style={{ color: t.text.primary, fontSize: 14, lineHeight: 20 }}>
          {item.text}
        </Text>
        {item.isError && (
          <View style={{ marginTop: spacing[1] }}>
            <Text
              style={{
                color: t.semantic.danger,
                fontSize: 11,
                fontStyle: "italic",
              }}
            >
              Falha ao enviar.
            </Text>
            <TouchableOpacity
              onPress={() => onRetry(item)}
              accessibilityLabel="Tentar enviar novamente"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                alignSelf: "flex-start",
                marginTop: spacing[1],
                paddingHorizontal: spacing[2],
                paddingVertical: spacing[1],
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: t.semantic.danger,
              }}
            >
              <Text
                style={{
                  color: t.semantic.danger,
                  fontSize: 11,
                  fontWeight: "700",
                }}
              >
                Tentar de novo
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 10,
          marginTop: 2,
          textAlign: isUser ? "right" : "left",
        }}
      >
        {new Date(item.timestamp).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </Text>
    </View>
  );
}

export default function AiAssistant() {
  const t = useTheme();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const sendPress = usePressScale();
  const [inputText, setInputText] = useState("");
  const { messages, isLoading, sendMessage, retryMessage, clearHistory } =
    useAiStore();

  const handleSend = useCallback(
    async (text?: string) => {
      const payload = (text ?? inputText).trim();
      if (!payload) return;
      setInputText("");
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Haptic acompanha o resultado real — vibrar "sucesso" em falha engana
      const ok = await sendMessage(payload);
      Haptics.notificationAsync(
        ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    },
    [inputText, sendMessage],
  );

  const handleRetry = useCallback(
    async (item: ChatMessage) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const ok = await retryMessage(item.id);
      Haptics.notificationAsync(
        ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
    },
    [retryMessage],
  );

  const askClear = () => {
    if (messages.length <= 1) return;
    askConfirm({
      title: "Limpar conversa",
      message: "Apagar todo o histórico com o Nino?",
      confirmLabel: "Limpar",
      destructive: true,
      onConfirm: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        clearHistory();
      },
    });
  };

  const showSuggestions = messages.length <= 1;

  return (
    <PageContainer>
      {/* Tela modal: já nasce abaixo da status bar, sem inset extra */}
      <ScreenHeader
        title="Nino"
        subtitle="Assistente financeiro"
        showInfoButton={false}
        showProfileButton={false}
        topInset={false}
        rightActions={[
          <TouchableOpacity
            key="close"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Fechar assistente"
            accessibilityRole="button"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.background.elevated,
            }}
          >
            <X size={18} color={t.text.primary} />
          </TouchableOpacity>,
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // Tela modal cobre a janela inteira: nenhum offset de header nativo
        keyboardVerticalOffset={0}
        style={{ flex: 1 }}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble item={item} onRetry={handleRetry} />
          )}
          inverted
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            isLoading ? (
              <View style={{ paddingVertical: spacing[2] }}>
                <View
                  style={{
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: t.background.elevated,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                  }}
                >
                  <ActivityIndicator size="small" color={t.accent.neon} />
                  <Text
                    style={{
                      color: t.text.secondary,
                      fontSize: 12,
                      marginLeft: spacing[2],
                      fontStyle: "italic",
                    }}
                  >
                    Nino está pensando…
                  </Text>
                </View>
              </View>
            ) : null
          }
          // Na lista invertida o footer fica no topo visual — o "fim" do
          // histórico é o lugar discreto para a ação destrutiva
          ListFooterComponent={
            messages.length > 1 ? (
              <TouchableOpacity
                onPress={askClear}
                accessibilityLabel="Limpar conversa"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{
                  alignSelf: "center",
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: spacing[3],
                }}
              >
                <Trash2 size={13} color={t.text.tertiary} />
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 12,
                    fontWeight: "600",
                    marginLeft: spacing[1],
                  }}
                >
                  Limpar conversa
                </Text>
              </TouchableOpacity>
            ) : null
          }
        />

        {showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              paddingHorizontal: spacing[5],
              paddingBottom: spacing[3],
              gap: spacing[2],
            }}
          >
            {SUGGESTIONS.map((suggestion) => (
              <TouchableOpacity
                key={suggestion}
                onPress={() => handleSend(suggestion)}
                accessibilityLabel={suggestion}
                accessibilityRole="button"
                activeOpacity={0.8}
                style={{
                  borderWidth: 1,
                  borderColor: t.accent.neon,
                  backgroundColor: t.accent.neonMuted,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radius.full,
                }}
              >
                <Text
                  style={{
                    color: t.accent.neon,
                    fontSize: 12,
                    fontWeight: "600",
                  }}
                >
                  {suggestion}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        <View
          style={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[2],
            // Insets valem nas duas plataformas — Android com gesto também tem
            paddingBottom: Math.max(insets.bottom, spacing[3]),
            backgroundColor: t.background.surface,
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.default,
              borderRadius: radius.xl,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              color: t.text.primary,
              fontSize: 14,
              maxHeight: 128,
              minHeight: 48,
            }}
            placeholder="Pergunte sobre seus gastos..."
            placeholderTextColor={t.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
            accessibilityLabel="Mensagem para o Nino"
          />
          {/* Margem no wrapper para a escala de toque não deslocar o input */}
          <Animated.View
            style={[{ marginLeft: spacing[3] }, sendPress.pressStyle]}
          >
            <TouchableOpacity
              onPress={() => handleSend()}
              onPressIn={sendPress.onPressIn}
              onPressOut={sendPress.onPressOut}
              disabled={!inputText.trim() || isLoading}
              accessibilityLabel="Enviar mensagem"
              accessibilityRole="button"
              style={{
                width: 48,
                height: 48,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor:
                  inputText.trim() && !isLoading
                    ? t.accent.neon
                    : t.background.elevated,
              }}
            >
              <SendHorizontal
                size={18}
                color={
                  inputText.trim() && !isLoading
                    ? t.text.inverse
                    : t.text.tertiary
                }
                style={{ marginLeft: 2 }}
              />
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </PageContainer>
  );
}
