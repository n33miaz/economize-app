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
import MailCheck from "lucide-react-native/dist/esm/icons/mail-check";
import Animated from "react-native-reanimated";
import axios from "axios";

import FloatingLabelInput from "../../components/FloatingLabelInput";
import { forgotPassword } from "../../services/api";
import { useTheme } from "../../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../../theme/motionPresets";

export default function ForgotPassword({ navigation }: any) {
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const submitPress = usePressScale();
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    const trimmed = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(trimmed)) {
      setEmailError("Informe um e-mail válido.");
      return;
    }
    setIsSending(true);
    try {
      await forgotPassword(trimmed);
      setSent(true);
    } catch (e) {
      // A neutralidade vale para RESPOSTAS do servidor (nunca revelar 4xx);
      // sem resposta HTTP (offline/timeout) dizer "verifique seu e-mail"
      // mentiria — o toast global já explicou e o formulário fica de pé
      if (axios.isAxiosError(e) && e.response) {
        setSent(true);
      }
    } finally {
      setIsSending(false);
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

      {sent ? (
        <Animated.View entering={cardEntering} className="items-center">
          <View className="w-20 h-20 bg-accentMuted rounded-full justify-center items-center mb-6">
            <MailCheck size={36} color={t.accent.neon} />
          </View>
          <Text className="text-2xl font-bold text-textPrimary text-center">
            Verifique seu e-mail
          </Text>
          <Text className="text-textSecondary text-center mt-3 leading-5">
            Se o e-mail informado estiver cadastrado, você receberá em
            instantes um link para redefinir sua senha. Confira também a caixa
            de spam.
          </Text>
          <TouchableOpacity
            className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed self-stretch mt-8"
            onPress={() => navigation.navigate("Login")}
            accessibilityLabel="Voltar ao login"
            accessibilityRole="button"
          >
            <Text className="text-primaryDark font-bold text-lg">
              Voltar ao login
            </Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <>
          <Animated.View entering={cardEntering} className="mb-10 mt-10">
            <Text className="text-3xl font-bold text-textPrimary">
              Esqueci minha senha
            </Text>
            <Text className="text-textSecondary mt-2">
              Informe seu e-mail e enviaremos um link para redefinir a senha
            </Text>
          </Animated.View>

          <Animated.View entering={listItemEntering(1)} className="mb-8">
            <FloatingLabelInput
              label="E-mail"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setEmailError(null);
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              error={emailError}
            />
            {emailError && (
              <Text className="text-danger text-xs mt-1 ml-1">
                {emailError}
              </Text>
            )}
          </Animated.View>

          <Animated.View
            entering={listItemEntering(2)}
            style={submitPress.pressStyle}
          >
            <TouchableOpacity
              className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
              onPress={handleSubmit}
              onPressIn={submitPress.onPressIn}
              onPressOut={submitPress.onPressOut}
              disabled={isSending}
              accessibilityLabel="Enviar link de redefinição"
              accessibilityRole="button"
            >
              {isSending ? (
                <ActivityIndicator color={t.text.inverse} />
              ) : (
                <Text className="text-primaryDark font-bold text-lg">
                  Enviar link
                </Text>
              )}
            </TouchableOpacity>
          </Animated.View>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
