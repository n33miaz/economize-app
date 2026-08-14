import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";

import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../theme/ThemeProvider";

// Formulário de login não ganha nada em ficar largo; 420 é a medida do cartão
const AUTH_MAX_WIDTH = 420;

export default function Login({ navigation }: any) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleLogin = async () => {
    if (!email || !password) return;
    try {
      await login(email, password);
    } catch (e) {
      // Erro tratado no store
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background justify-center px-6"
      // A tela de auth não passa pelo PageContainer: sem este teto o
      // formulário atravessava os 1440px do monitor de ponta a ponta
      style={{ width: "100%", maxWidth: AUTH_MAX_WIDTH, alignSelf: "center" }}
    >
      <View className="items-center mb-10">
        <View className="w-24 h-24 bg-accentMuted rounded-3xl justify-center items-center mb-4 overflow-hidden">
          <Image
            // logo-512 e não logo.png: o original é 2048² com 6 MB, baixado
            // inteiro na primeira tela do site para exibir 64px
            source={require("../../../assets/logo-512.png")}
            // Dimensão em style, não em className: na web o NativeWind não
            // aplica largura/altura em <Image> e ela vinha no tamanho natural
            // (512px), cobrindo o título inteiro
            style={{ width: 64, height: 64 }}
            resizeMode="contain"
          />
        </View>
        <Text className="text-3xl font-bold text-textPrimary">Economize!</Text>
        <Text className="text-textSecondary mt-2">
          Acesse sua conta para continuar
        </Text>
      </View>

      {error && (
        <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
          <Text className="text-danger text-center text-sm">{error}</Text>
        </View>
      )}

      <View className="mb-4">
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
      </View>

      <View className="mb-6">
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
      </View>

      <TouchableOpacity
        className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
        onPress={handleLogin}
        disabled={isLoading}
        accessibilityLabel="Entrar"
        accessibilityRole="button"
      >
        {isLoading ? (
          <ActivityIndicator color={t.text.inverse} />
        ) : (
          <Text className="text-primaryDark font-bold text-lg">Entrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-6 items-center"
        onPress={() => navigation.navigate("Register")}
        accessibilityLabel="Criar conta"
        accessibilityRole="button"
      >
        <Text className="text-textSecondary">
          Não tem uma conta?{" "}
          <Text className="text-primary font-bold">Cadastre-se</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
