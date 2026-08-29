import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import WifiOff from "lucide-react-native/dist/esm/icons/wifi-off";

import { useTheme } from "../theme/ThemeProvider";

interface ErrorStateProps {
  message?: string;
  onRetry: () => void;
}

export default function ErrorState({
  message = "Ops! Algo deu errado.",
  onRetry,
}: ErrorStateProps) {
  const t = useTheme();

  return (
    <View className="flex-1 justify-center items-center p-6">
      <View className="w-20 h-20 bg-danger/15 rounded-full justify-center items-center mb-4">
        <WifiOff size={40} color={t.semantic.danger} />
      </View>
      <Text className="text-xl font-bold text-textPrimary mb-2 text-center">
        Conexão Perdida
      </Text>
      <Text className="text-textSecondary text-center mb-8 font-regular">
        {message}
      </Text>
      <TouchableOpacity
        className="bg-primary px-8 py-3.5 rounded-xl active:bg-accentPressed"
        onPress={onRetry}
        accessibilityLabel="Tentar novamente"
        accessibilityRole="button"
      >
        <Text className="text-primaryDark font-bold text-base">
          Tentar Novamente
        </Text>
      </TouchableOpacity>
    </View>
  );
}
