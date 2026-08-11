import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import Animated from "react-native-reanimated";

import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../../theme/motionPresets";

export default function Register({ navigation }: any) {
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const submitPress = usePressScale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    if (!name || !email || !password) return;
    try {
      await register(name, email, password);
    } catch (e) {
      // Erro tratado no store
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background justify-center px-6"
    >
      <TouchableOpacity
        className="absolute top-14 left-6 w-10 h-10 bg-elevated rounded-full justify-center items-center"
        onPress={() => navigation.goBack()}
        accessibilityLabel="Voltar"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft size={20} color={t.text.primary} />
      </TouchableOpacity>

      <Animated.View entering={cardEntering} className="mb-10 mt-10">
        <Text className="text-3xl font-bold text-textPrimary">
          Criar Conta
        </Text>
        <Text className="text-textSecondary mt-2">
          Comece a gerenciar seus investimentos
        </Text>
      </Animated.View>

      {error && (
        <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
          <Text className="text-danger text-center text-sm">{error}</Text>
        </View>
      )}

      <Animated.View entering={listItemEntering(1)} className="mb-4">
        <Text className="text-sm font-bold text-textSecondary mb-2">
          Nome Completo
        </Text>
        <TextInput
          className="bg-elevated border border-border rounded-xl px-4 h-14 text-textPrimary"
          placeholder="João Silva"
          placeholderTextColor={t.text.tertiary}
          value={name}
          onChangeText={(text) => {
            setName(text);
            clearError();
          }}
          accessibilityLabel="Nome completo"
        />
      </Animated.View>

      <Animated.View entering={listItemEntering(2)} className="mb-4">
        <Text className="text-sm font-bold text-textSecondary mb-2">
          E-mail
        </Text>
        <TextInput
          className="bg-elevated border border-border rounded-xl px-4 h-14 text-textPrimary"
          placeholder="seu@email.com"
          placeholderTextColor={t.text.tertiary}
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearError();
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          accessibilityLabel="E-mail"
        />
      </Animated.View>

      <Animated.View entering={listItemEntering(3)} className="mb-8">
        <Text className="text-sm font-bold text-textSecondary mb-2">Senha</Text>
        <TextInput
          className="bg-elevated border border-border rounded-xl px-4 h-14 text-textPrimary"
          placeholder="••••••••"
          placeholderTextColor={t.text.tertiary}
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearError();
          }}
          secureTextEntry
          accessibilityLabel="Senha"
        />
      </Animated.View>

      <Animated.View
        entering={listItemEntering(4)}
        style={submitPress.pressStyle}
      >
        <TouchableOpacity
          className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
          onPress={handleRegister}
          onPressIn={submitPress.onPressIn}
          onPressOut={submitPress.onPressOut}
          disabled={isLoading}
          accessibilityLabel="Cadastrar"
          accessibilityRole="button"
        >
          {isLoading ? (
            <ActivityIndicator color={t.text.inverse} />
          ) : (
            <Text className="text-primaryDark font-bold text-lg">
              Cadastrar
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
