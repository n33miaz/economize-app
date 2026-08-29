import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { changePassword, getApiErrorDetail } from "../services/api";
import { useToastStore } from "../store/toastStore";
import { validateNewPassword } from "../utils/passwordPolicy";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import FloatingLabelInput from "../components/FloatingLabelInput";

export default function ChangePassword() {
  const t = useTheme();
  const navigation = useNavigation();
  const { listItemEntering } = useMotionPresets();
  const submitPress = usePressScale();
  const showToast = useToastStore((s) => s.showToast);

  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [currentError, setCurrentError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmationError, setConfirmationError] = useState<string | null>(
    null,
  );
  const [apiError, setApiError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    const nextCurrentError =
      current.length === 0 ? "Informe a senha atual." : null;
    const errors = validateNewPassword(password, confirmation);
    setCurrentError(nextCurrentError);
    setPasswordError(errors.passwordError);
    setConfirmationError(errors.confirmationError);
    if (nextCurrentError || errors.passwordError || errors.confirmationError) {
      return;
    }

    setIsSaving(true);
    setApiError(null);
    try {
      await changePassword(current, password);
      showToast("Senha alterada.", "success");
      navigation.goBack();
    } catch (error) {
      // O 400 traz um ProblemDetail ("Senha atual incorreta")
      setApiError(
        getApiErrorDetail(error) ?? "Não foi possível alterar a senha.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Alterar senha"
        subtitle="Atualize sua senha de acesso"
        showProfileButton={false}
      />
      <ScrollView
        contentContainerStyle={{ padding: spacing[5] }}
        keyboardShouldPersistTaps="handled"
      >
        {apiError && (
          <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
            <Text className="text-danger text-center text-sm">{apiError}</Text>
          </View>
        )}

        <Animated.View entering={listItemEntering(1)} className="mb-4">
          <FloatingLabelInput
            label="Senha atual"
            value={current}
            onChangeText={(text) => {
              setCurrent(text);
              setCurrentError(null);
              setApiError(null);
            }}
            secureTextEntry
            error={currentError}
          />
          {currentError && (
            <Text className="text-danger text-xs mt-1 ml-1">
              {currentError}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={listItemEntering(2)} className="mb-4">
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
            <Text className="text-danger text-xs mt-1 ml-1">
              {passwordError}
            </Text>
          )}
        </Animated.View>

        <Animated.View entering={listItemEntering(3)} className="mb-8">
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
          entering={listItemEntering(4)}
          style={submitPress.pressStyle}
        >
          <TouchableOpacity
            className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
            onPress={handleSubmit}
            onPressIn={submitPress.onPressIn}
            onPressOut={submitPress.onPressOut}
            disabled={isSaving}
            accessibilityLabel="Salvar nova senha"
            accessibilityRole="button"
          >
            {isSaving ? (
              <ActivityIndicator color={t.text.inverse} />
            ) : (
              <Text className="text-primaryDark font-bold text-lg">
                Salvar nova senha
              </Text>
            )}
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </PageContainer>
  );
}
