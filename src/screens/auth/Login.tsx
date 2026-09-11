import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import BrandOpening from "../../components/BrandOpening";
import BiometricPrompt from "../../components/BiometricPrompt";
import FloatingLabelInput from "../../components/FloatingLabelInput";
import { useAuthStore, type LoginOutcome } from "../../store/authStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useToastStore } from "../../store/toastStore";
import { APP_VERSION } from "../../utils/appVersion";
import { AUTH_MAX_WIDTH } from "../../utils/layout";
import { useTheme } from "../../theme/ThemeProvider";
import { biometricSupport, enrollBiometrics } from "../../utils/biometrics";

// Formulário de login não ganha nada em ficar largo; 420 é a medida do cartão

/** A sessão retida enquanto o modal de biometria está no ar. */
interface SessaoPendente {
  token: string;
  name: string;
}

export default function Login({ navigation }: any) {
  const t = useTheme();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const { login, submitMfaCode, completeLogin, isLoading, error, clearError } =
    useAuthStore();

  // Desafio do segundo fator em aberto: enquanto existe, a tela troca o campo
  // de senha pelo do código
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [sessaoPendente, setSessaoPendente] = useState<SessaoPendente | null>(
    null,
  );

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

  /**
   * Entrar de fato, ou reter a sessão para o modal de biometria.
   *
   * <p>A oferta só aparece quando há biometria neste aparelho E o usuário
   * nunca respondeu em definitivo. Na web isso passa pelo WebAuthn — no
   * navegador do celular a digital existe, e antes ela era simplesmente
   * ignorada.
   */
  const entrar = async (sessao: SessaoPendente) => {
    const { biometricLogin, biometricChoiceMade } =
      usePreferencesStore.getState();
    if (biometricChoiceMade || biometricLogin) {
      completeLogin(sessao.token, sessao.name);
      return;
    }
    const { available } = await biometricSupport();
    if (!available) {
      completeLogin(sessao.token, sessao.name);
      return;
    }
    // Sessão retida: gravar o token troca a árvore de navegação na hora, e o
    // modal ficaria por baixo de uma tela que já mudou
    setSessaoPendente(sessao);
  };

  /** O que fazer com o que o login (ou o segundo passo) devolveu. */
  const seguir = async (outcome: LoginOutcome | undefined) => {
    if (!outcome) return;
    if (outcome.kind === "mfa") {
      setMfaToken(outcome.mfaToken);
      setMfaCode("");
      return;
    }
    await entrar({ token: outcome.token, name: outcome.name });
  };

  const handleLogin = async () => {
    if (!email || !password) return;
    try {
      await seguir(await login(email, password, { deferCommit: true }));
    } catch {
      // Erro tratado no store
    }
  };

  const handleMfaSubmit = async () => {
    if (!mfaToken || mfaCode.trim().length < 6) return;
    try {
      await seguir(
        await submitMfaCode(mfaToken, mfaCode.trim(), { deferCommit: true }),
      );
    } catch {
      // Erro tratado no store
    }
  };

  const handleBiometricEnable = async () => {
    if (!sessaoPendente) return true;
    const { setBiometric, setBiometricChoiceMade } =
      usePreferencesStore.getState();
    const showToast = useToastStore.getState().showToast;

    const ok = await enrollBiometrics(email || "Economize!");
    if (!ok) {
      showToast(
        "Biometria não confirmada. Você pode ativar depois no Perfil, em Preferências.",
        "warning",
      );
      return false;
    }
    setBiometric(true);
    setBiometricChoiceMade(true);
    showToast("Desbloqueio por biometria ativado.", "success");
    completeLogin(sessaoPendente.token, sessaoPendente.name);
    return true;
  };

  /**
   * Recusar é recusar HOJE. Só o check marcado cala a pergunta para sempre —
   * antes qualquer "agora não" a silenciava, e quem mudasse de ideia tinha de
   * descobrir sozinho o caminho no Perfil.
   */
  const handleBiometricDecline = (naoPerguntarMais: boolean) => {
    if (!sessaoPendente) return;
    const { setBiometric, setBiometricChoiceMade } =
      usePreferencesStore.getState();
    setBiometric(false);
    setBiometricChoiceMade(naoPerguntarMais);
    const { token, name } = sessaoPendente;
    setSessaoPendente(null);
    completeLogin(token, name);
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
              {mfaToken
                ? "Verificação em duas etapas"
                : "Acesse sua conta para continuar"}
            </Text>
          </Animated.View>
        )}
      </View>

      {error && (
        <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
          <Text className="text-danger text-center text-sm">{error}</Text>
        </View>
      )}

      {mfaToken ? (
        <>
          <Text className="text-textSecondary text-sm mb-4 text-center">
            Digite o código de 6 dígitos do seu aplicativo autenticador — ou um
            dos códigos de recuperação que você guardou.
          </Text>
          <View className="mb-6">
            <FloatingLabelInput
              label="Código de verificação"
              value={mfaCode}
              onChangeText={(text) => {
                setMfaCode(text);
                clearError();
              }}
              autoCapitalize="characters"
              // `numeric` travaria o código de recuperação, que tem letras
              keyboardType="default"
            />
          </View>

          <TouchableOpacity
            className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
            onPress={handleMfaSubmit}
            disabled={isLoading}
            accessibilityLabel="Verificar código"
            accessibilityRole="button"
          >
            {isLoading ? (
              <ActivityIndicator color={t.text.inverse} />
            ) : (
              <Text className="text-primaryDark font-bold text-lg">
                Verificar
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-6 items-center"
            onPress={() => {
              setMfaToken(null);
              setMfaCode("");
              setPassword("");
              clearError();
            }}
            accessibilityLabel="Voltar para o login"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text className="text-textSecondary">Usar outra conta</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
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

          {/* A versão do build, na única tela que todo mundo vê antes de
              entrar. Existe para o suporte: quando alguém relata um defeito,
              a primeira pergunta é "qual versão?" — e a resposta tem de estar
              na tela, não em Ajustes do Android. Fica discreta de propósito:
              é informação de diagnóstico, não de produto. */}
          <Text
            className="mt-8 text-center text-xs"
            style={{ color: t.text.tertiary }}
            accessibilityLabel={`Versão do aplicativo ${APP_VERSION}`}
          >
            versão {APP_VERSION}
          </Text>
        </>
      )}

      <BiometricPrompt
        visible={sessaoPendente !== null}
        onEnable={handleBiometricEnable}
        onDecline={handleBiometricDecline}
      />
    </KeyboardAvoidingView>
  );
}
