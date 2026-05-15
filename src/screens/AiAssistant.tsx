import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";

import { useAiStore, ChatMessage } from "../store/aiStore";
import { colors } from "../theme/colors";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

export default function AiAssistant() {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const { messages, isLoading, sendMessage, clearHistory } = useAiStore();

  const handleSend = useCallback(async () => {
    if (!inputText.trim()) return;

    const textToSend = inputText.trim();
    setInputText("");
    Keyboard.dismiss();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    await sendMessage(textToSend);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [inputText, sendMessage]);

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.isUser;

    return (
      <Animated.View
        entering={
          isUser ? FadeInUp.duration(300) : FadeInDown.duration(400).delay(100)
        }
        className={`mb-4 max-w-[85%] ${isUser ? "self-end" : "self-start"}`}
      >
        <View
          className={`p-4 rounded-2xl ${
            isUser
              ? "bg-primary rounded-tr-sm"
              : "bg-white border border-gray-100 shadow-sm rounded-tl-sm"
          } ${item.isError ? "bg-red-500" : ""}`}
        >
          {!isUser && (
            <View className="flex-row items-center mb-1">
              <Ionicons name="sparkles" size={14} color={colors.primary} />
              <Text className="text-primary font-bold text-xs ml-1">
                Nino
              </Text>
            </View>
          )}
          <Text
            className={`text-base font-regular leading-6 ${
              isUser ? "text-white" : "text-slate-800"
            }`}
          >
            {item.text}
          </Text>
          {item.isError && (
            <Text className="text-white/80 text-xs mt-1 italic">
              Falha ao enviar. Tente novamente.
            </Text>
          )}
        </View>
        <Text
          className={`text-[10px] text-gray-400 mt-1 ${
            isUser ? "text-right mr-1" : "ml-1"
          }`}
        >
          {new Date(item.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </Animated.View>
    );
  };

  // Botão de limpar histórico 
  const renderFooter = () => {
    if (messages.length <= 1) return null;
    return (
      <TouchableOpacity
        onPress={() => {
          Haptics.selectionAsync();
          clearHistory();
        }}
        className="items-center py-6"
        activeOpacity={0.7}
      >
        <View className="bg-gray-100 px-4 py-2 rounded-full flex-row items-center border border-gray-200">
          <Ionicons
            name="trash-outline"
            size={16}
            color={colors.textSecondary}
          />
          <Text className="text-xs font-bold text-textSecondary ml-2">
            Limpar histórico de conversa
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  // Indicador de carregamento logo acima do input
  const renderHeader = () => {
    if (!isLoading) return null;
    return (
      <View className="py-2 self-start flex-row items-center">
        <View className="bg-white p-3 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm flex-row items-center">
          <ActivityIndicator size="small" color={colors.primary} />
          <Text className="text-gray-400 text-xs ml-2 italic">
            Carregando...
          </Text>
        </View>
      </View>
    );
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Assistente IA"
        subtitle="Análise Financeira Inteligente"
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          inverted
          contentContainerClassName="px-5 py-4"
          showsVerticalScrollIndicator={false}
          ListFooterComponent={renderFooter}
          ListHeaderComponent={renderHeader}
        />

        <View
          className="px-5 py-3 bg-white border-t border-gray-100 flex-row items-end"
          style={{
            paddingBottom:
              Platform.OS === "ios" ? Math.max(insets.bottom, 12) : 12,
          }}
        >
          <TextInput
            className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 pt-3 pb-3 text-base text-slate-800 max-h-32 min-h-[48px]"
            placeholder="Pergunte sobre seus gastos..."
            placeholderTextColor={colors.inactive}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            className={`w-12 h-12 rounded-full justify-center items-center ml-3 shadow-sm ${
              inputText.trim() ? "bg-primary" : "bg-gray-200"
            }`}
            onPress={handleSend}
            disabled={!inputText.trim() || isLoading}
          >
            <Ionicons
              name="send"
              size={20}
              color={inputText.trim() ? "#FFF" : "#94A3B8"}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </PageContainer>
  );
}
