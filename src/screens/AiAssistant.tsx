import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { ChatMessage, useAiStore } from "../store/aiStore";
import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const SUGGESTIONS = [
  "Quanto gastei esse mês?",
  "Resumo da semana",
  "Dicas pra economizar",
  "Como diversificar minha carteira?",
];

function MessageBubble({ item }: { item: ChatMessage }) {
  const isUser = item.isUser;
  const bubbleBg = item.isError
    ? darkTheme.semantic.dangerMuted
    : isUser
      ? darkTheme.accent.neonMuted
      : darkTheme.background.elevated;
  const borderColor = item.isError
    ? darkTheme.semantic.danger
    : isUser
      ? darkTheme.accent.neon
      : darkTheme.border.subtle;
  const textColor = darkTheme.text.primary;

  return (
    <Animated.View
      entering={
        isUser ? FadeInUp.duration(280) : FadeInDown.duration(360).delay(80)
      }
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
            <Ionicons
              name="sparkles"
              size={12}
              color={darkTheme.accent.neon}
            />
            <Text
              style={{
                color: darkTheme.accent.neon,
                fontWeight: "700",
                fontSize: 11,
                marginLeft: 4,
              }}
            >
              Nino
            </Text>
          </View>
        )}
        <Text style={{ color: textColor, fontSize: 14, lineHeight: 20 }}>
          {item.text}
        </Text>
        {item.isError && (
          <Text
            style={{
              color: darkTheme.semantic.danger,
              fontSize: 11,
              marginTop: 4,
              fontStyle: "italic",
            }}
          >
            Falha ao enviar. Tente novamente.
          </Text>
        )}
      </View>
      <Text
        style={{
          color: darkTheme.text.tertiary,
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
    </Animated.View>
  );
}

export default function AiAssistant() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const { messages, isLoading, sendMessage, clearHistory } = useAiStore();

  const handleSend = useCallback(
    async (text?: string) => {
      const payload = (text ?? inputText).trim();
      if (!payload) return;
      setInputText("");
      Keyboard.dismiss();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await sendMessage(payload);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [inputText, sendMessage],
  );

  const askClear = () => {
    if (messages.length <= 1) return;
    Alert.alert("Limpar conversa", "Apagar todo o histórico com o Nino?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Limpar",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          clearHistory();
        },
      },
    ]);
  };

  const showSuggestions = messages.length <= 1;

  return (
    <PageContainer>
      <ScreenHeader
        title="Nino"
        subtitle="Assistente financeiro"
        showInfoButton={false}
        showProfileButton={false}
        rightActions={[
          <TouchableOpacity
            key="clear"
            onPress={askClear}
            accessibilityLabel="Limpar histórico"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: darkTheme.background.elevated,
            }}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={
                messages.length > 1
                  ? darkTheme.text.primary
                  : darkTheme.text.tertiary
              }
            />
          </TouchableOpacity>,
        ]}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <MessageBubble item={item} />}
          inverted
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingVertical: spacing[4],
          }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            isLoading ? (
              <View style={{ paddingVertical: spacing[2] }}>
                <View
                  style={{
                    alignSelf: "flex-start",
                    flexDirection: "row",
                    alignItems: "center",
                    backgroundColor: darkTheme.background.elevated,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: darkTheme.border.subtle,
                  }}
                >
                  <ActivityIndicator
                    size="small"
                    color={darkTheme.accent.neon}
                  />
                  <Text
                    style={{
                      color: darkTheme.text.secondary,
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
        />

        {showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
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
                activeOpacity={0.8}
                style={{
                  borderWidth: 1,
                  borderColor: darkTheme.accent.neon,
                  backgroundColor: darkTheme.accent.neonMuted,
                  paddingHorizontal: spacing[3],
                  paddingVertical: spacing[2],
                  borderRadius: radius.full,
                }}
              >
                <Text
                  style={{
                    color: darkTheme.accent.neon,
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
            paddingBottom:
              Platform.OS === "ios"
                ? Math.max(insets.bottom, spacing[3])
                : spacing[3],
            backgroundColor: darkTheme.background.surface,
            borderTopWidth: 1,
            borderTopColor: darkTheme.border.subtle,
            flexDirection: "row",
            alignItems: "flex-end",
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: darkTheme.background.elevated,
              borderWidth: 1,
              borderColor: darkTheme.border.default,
              borderRadius: radius.xl,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              color: darkTheme.text.primary,
              fontSize: 14,
              maxHeight: 128,
              minHeight: 48,
            }}
            placeholder="Pergunte sobre seus gastos..."
            placeholderTextColor={darkTheme.text.tertiary}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!inputText.trim() || isLoading}
            style={{
              width: 48,
              height: 48,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              marginLeft: spacing[3],
              backgroundColor:
                inputText.trim() && !isLoading
                  ? darkTheme.accent.neon
                  : darkTheme.background.elevated,
            }}
          >
            <Ionicons
              name="send"
              size={18}
              color={
                inputText.trim() && !isLoading
                  ? darkTheme.text.inverse
                  : darkTheme.text.tertiary
              }
              style={{ marginLeft: 2 }}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </PageContainer>
  );
}
