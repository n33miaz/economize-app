import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export default function ErrorState({
  message = "Ops! Algo deu errado.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="flex-1 justify-center items-center p-6">
      <View className="w-20 h-20 bg-red-50 rounded-full justify-center items-center mb-4">
        <Ionicons name="cloud-offline-outline" size={40} color="#EF4444" />
      </View>
      <Text className="text-xl font-bold text-slate-800 mb-2 text-center">
        Conexão Perdida
      </Text>
      <Text className="text-gray-500 text-center mb-8 font-regular">
        {message}
      </Text>
      <TouchableOpacity
        className="bg-primary px-8 py-3.5 rounded-xl shadow-lg shadow-blue-500/30 active:bg-primaryDark"
        onPress={onRetry}
      >
        <Text className="text-white font-bold text-base">Tentar Novamente</Text>
      </TouchableOpacity>
    </View>
  );
}
