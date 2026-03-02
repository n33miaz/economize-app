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
import { colors } from "../../theme/colors";

export default function Login({ navigation }: any) {
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
      className="flex-1 bg-background-light justify-center px-6"
    >
      <View className="items-center mb-10">
        <View className="w-24 h-24 bg-blue-50 rounded-3xl justify-center items-center mb-4">
          <Image
            source={require("../../assets/logo.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />
        </View>
        <Text className="text-3xl font-bold text-primaryDark">
          Painel Econômico
        </Text>
        <Text className="text-gray-500 mt-2">
          Acesse sua conta para continuar
        </Text>
      </View>

      {error && (
        <View className="bg-red-100 p-3 rounded-xl mb-4 border border-red-200">
          <Text className="text-red-600 text-center text-sm">{error}</Text>
        </View>
      )}

      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-600 mb-2">E-mail</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-14 text-slate-800"
          placeholder="seu@email.com"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearError();
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </View>

      <View className="mb-6">
        <Text className="text-sm font-bold text-gray-600 mb-2">Senha</Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-14 text-slate-800"
          placeholder="••••••••"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearError();
          }}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        className="bg-primary h-14 rounded-xl justify-center items-center shadow-lg shadow-blue-500/30 active:bg-primaryDark"
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text className="text-white font-bold text-lg">Entrar</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        className="mt-6 items-center"
        onPress={() => navigation.navigate("Register")}
      >
        <Text className="text-gray-500">
          Não tem uma conta?{" "}
          <Text className="text-primary font-bold">Cadastre-se</Text>
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
