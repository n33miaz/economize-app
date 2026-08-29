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
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import Animated from "react-native-reanimated";

import FloatingLabelInput from "../../components/FloatingLabelInput";
import { getApiErrorDetail, resetPassword } from "../../services/api";
import { useToastStore } from "../../store/toastStore";
import { useTheme } from "../../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../../theme/motionPresets";
import { validateNewPassword } from "../../utils/passwordPolicy";

export default function ResetPassword({ navigation, route }: any) {
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const submitPress = usePressScale();
  const showToast = useToastStore((s) => s.showToast);

  // O token chega pelo link do e-mail (web: /reset-password?token=...)
  const token: string | undefined = route?.params?.token;

  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const errors = validateNewPassword(password, confirmation);
    setPasswordError(errors.passwordError);
    setConfirmationError(errors.confirmationError);
    if (errors.passwordError || errors.confirmationError || !token) return;

    setIsSaving(true);
    setApiError(null);
    try {
      await resetPassword(token, password);
      showToast("Senha redefinida. Faça login com a nova senha.", "success");
      navigation.navigate("Login");
    } catch (error) {
      // O 400 traz um ProblemDetail neutro ("Token inválido ou expirado");
      // qualquer outra falha cai na mensagem genérica
      setApiError(
        getApiErrorDetail(error) ?? "Não foi possível redefinir a senha.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (!token) {
    return (
      <View
        className="flex-1 bg-background justify-center px-6"
        style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
      >
        <Animated.View entering={cardEntering} className="items-center">
          <View className="w-20 h-20 bg-danger/15 rounded-full justify-center items-center mb-6">
            <TriangleAlert size={36} color={t.semantic.danger} />
          </View>
          <Text className="text-2xl font-bold text-textPrimary text-center">
            Link inválido
          </Text>
          <Text className="text-textSecondary text-center mt-3 leading-5">
            Este link de redefinição está incompleto ou expirou. Solicite um
            novo para continuar.
          </Text>
          <TouchableOpacity
            className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed self-stretch mt-8"
            onPress={() => navigation.navigate("ForgotPassword")}
            accessibilityLabel="Solicitar novo link"
            accessibilityRole="button"
          >
            <Text className="text-primaryDark font-bold text-lg">
              Solicitar novo link
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="mt-6 items-center"
            onPress={() => navigation.navigate("Login")}
            accessibilityLabel="Voltar ao login"
            accessibilityRole="button"
          >
            <Text className="text-primary font-bold">Voltar ao login</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-background justify-center px-6"
      // Mesmo teto do Login: a tela de auth não passa pelo PageContainer
      style={{ width: "100%", maxWidth: 420, alignSelf: "center" }}
    >
      <TouchableOpacity
        className="absolute top-14 left-6 w-10 h-10 bg-elevated rounded-xl justify-center items-center"
        onPress={() => navigation.navigate("Login")}
        accessibilityLabel="Voltar"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <ArrowLeft size={20} color={t.text.primary} />
      </TouchableOpacity>

      <Animated.View entering={cardEntering} className="mb-10 mt-10">
        <Text className="text-3xl font-bold text-textPrimary">
          Redefinir senha
        </Text>
        <Text className="text-textSecondary mt-2">
          Crie uma nova senha para a sua conta
        </Text>
      </Animated.View>

      {apiError && (
        <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
          <Text className="text-danger text-center text-sm">{apiError}</Text>
        </View>
      )}

      <Animated.View entering={listItemEntering(1)} className="mb-4">
        <FloatingLabelInput
          label="Nova senha"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            setPasswordError(null);
            setApiError(null);
          }}
          secureTextEntry
          error={passwordError}
        />
        {passwordError && (
          <Text className="text-danger text-xs mt-1 ml-1">{passwordError}</Text>
        )}
      </Animated.View>

      <Animated.View entering={listItemEntering(2)} className="mb-8">
        <FloatingLabelInput
          label="Confirmar nova senha"
          value={confirmation}
          onChangeText={(text) => {
            setConfirmation(text);
            setConfirmationError(null);
            setApiError(null);
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
        entering={listItemEntering(3)}
        style={submitPress.pressStyle}
      >
        <TouchableOpacity
          className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
          onPress={handleSubmit}
          onPressIn={submitPress.onPressIn}
          onPressOut={submitPress.onPressOut}
          disabled={isSaving}
          accessibilityLabel="Redefinir senha"
          accessibilityRole="button"
        >
          {isSaving ? (
            <ActivityIndicator color={t.text.inverse} />
          ) : (
            <Text className="text-primaryDark font-bold text-lg">
              Redefinir senha
            </Text>
          )}
        </TouchableOpacity>
      </Animated.View>
    </KeyboardAvoidingView>
  );
}
