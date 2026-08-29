import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import ArrowLeft from "lucide-react-native/dist/esm/icons/arrow-left";
import Animated from "react-native-reanimated";

import FloatingLabelInput from "../../components/FloatingLabelInput";
import { useAuthStore } from "../../store/authStore";
import { useTheme } from "../../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../../theme/motionPresets";
import {
  getPasswordStrength,
  validateNewPassword,
  type PasswordStrength,
} from "../../utils/passwordPolicy";

export default function Register({ navigation }: any) {
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const submitPress = usePressScale();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const { register, isLoading, error, clearError } = useAuthStore();

  const strength: PasswordStrength = getPasswordStrength(password);
  const strengthColor = {
    fraca: t.semantic.danger,
    média: t.semantic.warning,
    forte: t.semantic.success,
  }[strength];

  const handleRegister = async () => {
    if (!name || !email || !password) return;
    const errors = validateNewPassword(password, confirmation);
    setPasswordError(errors.passwordError);
    setConfirmationError(errors.confirmationError);
    if (errors.passwordError || errors.confirmationError) return;
    try {
      await register(name, email, password);
    } catch {
      // Erro tratado no store
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background justify-center px-6"
      // Mesmo teto do Login: a tela de auth não passa pelo PageContainer
      style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
    >
      <TouchableOpacity
        className="absolute top-14 left-6 w-10 h-10 bg-elevated rounded-xl justify-center items-center"
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
        <FloatingLabelInput
          label="Nome Completo"
          value={name}
          onChangeText={(text) => {
            setName(text);
            clearError();
          }}
        />
      </Animated.View>

      <Animated.View entering={listItemEntering(2)} className="mb-4">
        <FloatingLabelInput
          label="E-mail"
          value={email}
          onChangeText={(text) => {
            setEmail(text);
            clearError();
          }}
          autoCapitalize="none"
          keyboardType="email-address"
        />
      </Animated.View>

      <Animated.View entering={listItemEntering(3)} className="mb-4">
        <FloatingLabelInput
          label="Senha"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setPasswordError(null);
            clearError();
          }}
          secureTextEntry
          error={passwordError}
        />
        {passwordError ? (
          <Text className="text-danger text-xs mt-1 ml-1">{passwordError}</Text>
        ) : password.length > 0 ? (
          // Cor semântica é dinâmica por tema — vai inline com tokens
          <Text className="text-xs mt-1 ml-1" style={{ color: strengthColor }}>
            Força da senha: {strength}
          </Text>
        ) : null}
      </Animated.View>

      <Animated.View entering={listItemEntering(4)} className="mb-8">
        <FloatingLabelInput
          label="Confirmar senha"
          value={confirmation}
          onChangeText={(text) => {
            setConfirmation(text);
            setConfirmationError(null);
            clearError();
          }}
          secureTextEntry
          error={confirmationError}
        />
        {confirmationError && (
          <Text className="text-danger text-xs mt-1 ml-1">
            {confirmationError}
          </Text>
        )}
      </Animated.View>

      <Animated.View
        entering={listItemEntering(5)}
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
