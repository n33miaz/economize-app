import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import Animated, { FadeIn } from "react-native-reanimated";

import BrandOpening from "../../components/BrandOpening";
import FloatingLabelInput from "../../components/FloatingLabelInput";
import { useAuthStore } from "../../store/authStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { askConfirm } from "../../store/confirmStore";
import { useToastStore } from "../../store/toastStore";
import { useTheme } from "../../theme/ThemeProvider";

// Formulário de login não ganha nada em ficar largo; 420 é a medida do cartão
const AUTH_MAX_WIDTH = 420;

export default function Login({ navigation }: any) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, completeLogin, isLoading, error, clearError } = useAuthStore();

  // EC-148: a abertura roda enquanto o app termina de se preparar. Aqui não há
  // métrica para buscar (ninguém entrou ainda), então o "pronto" é o próprio
  // fim do preparo — e o teto de tempo garante que a animação jamais vire a
  // razão da espera, que é a restrição dura do pedido.
  const [pronto, setPronto] = useState(false);
  const [revelado, setRevelado] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setPronto(true), 420);
    // Rede de segurança: conteúdo NUNCA pode depender só de a animação
    // terminar. Se o callback não vier — quadro perdido, teste, plataforma que
    // não anima —, a tela aparece do mesmo jeito
    const resgate = setTimeout(() => setRevelado(true), 2600);
    return () => {
      clearTimeout(id);
      clearTimeout(resgate);
    };
  }, []);

  const handleLogin = async () => {
    if (!email || !password) return;
    try {
      const { biometricLogin, biometricChoiceMade } =
        usePreferencesStore.getState();

      // A oferta de biometria só faz sentido quando há hardware enrolado e o
      // usuário nunca decidiu (nem por aqui, nem pelos toggles). Na web
      // hasHardwareAsync resolve false e o login segue direto, sem modal.
      let askBiometric = false;
      if (!biometricChoiceMade && !biometricLogin) {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled =
          hasHardware && (await LocalAuthentication.isEnrolledAsync());
        askBiometric = hasHardware && enrolled;
      }

      const deferred = await login(email, password, {
        deferCommit: askBiometric,
      });
      if (!deferred) return;

      // Credenciais válidas, token retido: a troca para as rotas autenticadas
      // (completeLogin) só acontece depois da resposta do modal
      askConfirm({
        title: "Desbloquear com biometria?",
        message:
          "Use a digital ou o rosto para proteger o Economize!: vamos pedir o desbloqueio sempre que o app abrir.",
        confirmLabel: "Usar biometria",
        cancelLabel: "Agora não",
        onConfirm: async () => {
          const { setBiometric, setBiometricChoiceMade } =
            usePreferencesStore.getState();
          const showToast = useToastStore.getState().showToast;
          try {
            const result = await LocalAuthentication.authenticateAsync({
              promptMessage: "Confirme sua biometria",
              cancelLabel: "Cancelar",
            });
            if (result.success) {
              setBiometric(true);
              showToast("Desbloqueio por biometria ativado.", "success");
            } else {
              showToast(
                "Biometria não confirmada. Você pode ativar depois no Perfil, em Preferências.",
                "warning",
              );
            }
          } catch {
            // authenticateAsync também REJEITA (não só resolve success=false);
            // sem este catch o login morreria com o token retido na closure
            showToast(
              "Biometria indisponível agora. Você pode ativar depois no Perfil, em Preferências.",
              "warning",
            );
          } finally {
            setBiometricChoiceMade(true);
            completeLogin(deferred.token, deferred.name);
          }
        },
        onCancel: () => {
          const { setBiometric, setBiometricChoiceMade } =
            usePreferencesStore.getState();
          setBiometric(false);
          setBiometricChoiceMade(true);
          completeLogin(deferred.token, deferred.name);
        },
      });
    } catch {
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
        {/* O pote deixou de ser um PNG: é a própria marca desenhada, e o nível
            dela passa a contar o resultado do ciclo depois do login */}
        <View className="w-24 h-24 bg-accentMuted rounded-3xl justify-center items-center mb-4">
          <BrandOpening
            ready={pronto}
            size={64}
            onSettled={() => setRevelado(true)}
          />
        </View>
        {revelado && (
          <Animated.View entering={FadeIn.duration(280)} className="items-center">
            <Text className="text-3xl font-bold text-textPrimary">
              Economize!
            </Text>
            <Text className="text-textSecondary mt-2">
              Acesse sua conta para continuar
            </Text>
          </Animated.View>
        )}
      </View>

      {error && (
        <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
          <Text className="text-danger text-center text-sm">{error}</Text>
        </View>
      )}

      <View className="mb-4">
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
      </View>

      <View className="mb-2">
        <FloatingLabelInput
          label="Senha"
          value={password}
          onChangeText={(text) => {
            setPassword(text);
            clearError();
          }}
          secureTextEntry
        />
      </View>

      <TouchableOpacity
        className="self-end mb-6 py-1"
        onPress={() => navigation.navigate("ForgotPassword")}
        accessibilityLabel="Esqueci minha senha"
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text className="text-primary font-bold text-sm">
          Esqueci minha senha
        </Text>
      </TouchableOpacity>

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
