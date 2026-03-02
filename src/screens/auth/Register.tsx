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
import { useAuthStore } from "../../store/authStore";
import { Ionicons } from "@expo/vector-icons";

export default function Register({ navigation }: any) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { register, isLoading, error, clearError } = useAuthStore();

  const handleRegister = async () => {
    if (!name || !email || !password) return;
    try {
      await register(name, email, password);
    } catch (e) {}
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background-light justify-center px-6"
    >
      <TouchableOpacity
        className="absolute top-14 left-6 w-10 h-10 bg-gray-100 rounded-full justify-center items-center"
        onPress={() => navigation.goBack()}
      >
        <Ionicons name="arrow-back" size={20} color="#333" />
      </TouchableOpacity>

      <View className="mb-10 mt-10">
        <Text className="text-3xl font-bold text-primaryDark">Criar Conta</Text>
        <Text className="text-gray-500 mt-2">
          Comece a gerenciar seus investimentos
        </Text>
      </View>

      {error && (
        <View className="bg-red-100 p-3 rounded-xl mb-4 border border-red-200">
          <Text className="text-red-600 text-center text-sm">{error}</Text>
        </View>
      )}

      <View className="mb-4">
        <Text className="text-sm font-bold text-gray-600 mb-2">
          Nome Completo
        </Text>
        <TextInput
          className="bg-gray-50 border border-gray-200 rounded-xl px-4 h-14 text-slate-800"
          placeholder="João Silva"
          value={name}
          onChangeText={(text) => {
            setName(text);
            clearError();
          }}
        />
      </View>

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

      <View className="mb-8">
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
        onPress={handleRegister}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text className="text-white font-bold text-lg">Cadastrar</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}
