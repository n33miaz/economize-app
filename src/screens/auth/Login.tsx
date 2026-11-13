import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Animated, { FadeIn,
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import BrandOpening from "../../components/BrandOpening";
import BiometricPrompt, {
  DURACAO_SELO_MS,
} from "../../components/BiometricPrompt";
import FloatingLabelInput from "../../components/FloatingLabelInput";
import {
  MFA_CHALLENGE_MS,
  MFA_EXPIRED_MESSAGE,
  useAuthStore,
  type LoginOutcome,
} from "../../store/authStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useToastStore } from "../../store/toastStore";
import { APP_VERSION } from "../../utils/appVersion";
import { AUTH_MAX_WIDTH } from "../../utils/layout";
import { useTheme } from "../../theme/ThemeProvider";
import { biometricSupport, enrollBiometrics } from "../../utils/biometrics";
import { useAnnouncement } from "../../hooks/useAnnouncement";
import { ANNOUNCEMENT_PRIORITY } from "../../store/announcementStore";

// Formulário de login não ganha nada em ficar largo; 420 é a medida do cartão

/**
 * Folga para o atraso da rede: o servidor emite o desafio ANTES de a resposta
 * chegar aqui (com a API acordando, segundos antes). Um 401 nos últimos 30 s
 * da janela local já pode ser o desafio vencido do lado de lá, e tratá-lo como
 * "código errado" prenderia a pessoa num passo que não tem mais saída.
 */
const MFA_EXPIRY_MARGIN_MS = 30 * 1000;

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
  // Quando o desafio chegou. O servidor devolve o MESMO 401 para código
  // errado e para desafio vencido; só a idade do desafio separa os dois
  const [mfaIssuedAt, setMfaIssuedAt] = useState<number | null>(null);
  const [sessaoPendente, setSessaoPendente] = useState<SessaoPendente | null>(
    null,
  );

  // EC-148: a abertura roda enquanto o app termina de se preparar. Aqui não há
  // métrica para buscar (ninguém entrou ainda), então o "pronto" é o próprio
  // fim do preparo — e o teto de tempo garante que a animação jamais vire a
  // razão da espera, que é a restrição dura do pedido.
  //
  // `revelado` manda em TUDO, e não só no nome da marca. Pedido do dono em
  // 15/09/2026: "ao abrir o app, nenhum campo e nada deve aparecer além do
  // pote e a animação dele, os outros elementos devem aparecer com fade
  // suave". Antes o formulário já estava lá desde o primeiro quadro, e o pote
  // subia por cima de uma tela cheia — a animação virava enfeite em vez de
  // abertura. O `resgate` de 2,6 s continua sendo a rede: conteúdo nunca pode
  // depender só de a animação terminar.
  const [pronto, setPronto] = useState(false);
  const [revelado, setRevelado] = useState(false);

  // O `error` do authStore é um só para Login e Cadastro: sem limpar ao
  // montar, a tela abria com a falha de outra tela (ou de outra visita)
  useEffect(() => {
    clearError();
  }, [clearError]);

  /**
   * O halo que se dissipa.
   *
   * Enquanto o pote enche, um disco dourado pulsa suavemente atrás dele; no
   * instante em que o pote assenta (`revelado`), o disco cresce e apaga. É o
   * que dá a sensação de "a marca acendeu a tela" sem mover nada de lugar.
   *
   * Só opacidade e escala: as duas são compostas pela GPU e não passam pelo
   * caminho que, na web, devolvia `position: absolute` a elementos de entrada.
   */
  const halo = useSharedValue(0);
  useEffect(() => {
    halo.value = withTiming(revelado ? 1 : 0, {
      duration: revelado ? 620 : 0,
      easing: Easing.out(Easing.quad),
    });
  }, [revelado, halo]);
  const estiloHalo = useAnimatedStyle(() => ({
    opacity: interpolate(halo.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(halo.value, [0, 1], [0.86, 1.35]) }],
  }));

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

  const ofertaDeBiometriaNaVez = useAnnouncement(
    "biometric-offer",
    ANNOUNCEMENT_PRIORITY.biometric,
    sessaoPendente !== null,
  );

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
      setMfaIssuedAt(Date.now());
      return;
    }
    await entrar({ token: outcome.token, name: outcome.name });
  };

  const handleLogin = async () => {
    // Só as pontas: o teclado do celular costuma deixar um espaço depois do
    // e-mail sugerido. Minúsculas NÃO — a API compara o e-mail exato, e
    // quem se cadastrou com maiúscula ficaria trancado para fora
    const emailLimpo = email.trim();
    if (!emailLimpo || !password) return;
    try {
      await seguir(await login(emailLimpo, password, { deferCommit: true }));
    } catch {
      // Erro tratado no store
    }
  };

  /**
   * Desafio vencido: nenhum código serve mais, nem o certo. Voltar à senha é
   * a única saída — antes a tela ficava no passo do código respondendo
   * "tente de novo" para sempre.
   */
  const desafioVencido = () => {
    setMfaToken(null);
    setMfaCode("");
    setMfaIssuedAt(null);
    setPassword("");
    useAuthStore.setState({ error: MFA_EXPIRED_MESSAGE, isLoading: false });
  };

  const idadeDoDesafio = () =>
    mfaIssuedAt === null ? 0 : Date.now() - mfaIssuedAt;

  const handleMfaSubmit = async () => {
    if (!mfaToken || mfaCode.trim().length < 6) return;
    // Vencido aqui já é vencido lá: nem gasta a ida ao servidor
    if (idadeDoDesafio() >= MFA_CHALLENGE_MS) {
      desafioVencido();
      return;
    }
    try {
      await seguir(
        await submitMfaCode(mfaToken, mfaCode.trim(), { deferCommit: true }),
      );
    } catch (error: any) {
      // Erro tratado no store — exceto o 401 no fim da janela, que é o
      // desafio vencendo no servidor e não um código errado
      if (
        error?.response?.status === 401 &&
        idadeDoDesafio() >= MFA_CHALLENGE_MS - MFA_EXPIRY_MARGIN_MS
      ) {
        desafioVencido();
      }
    }
  };

  const handleBiometricEnable = async () => {
    if (!sessaoPendente) return true;
    const { setBiometric, setBiometricChoiceMade } =
      usePreferencesStore.getState();
    const showToast = useToastStore.getState().showToast;

    const ok = await enrollBiometrics(email.trim() || "Economize!");
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
    // A folha mostra o selo de sucesso (anel verde, visto, um pulo curto) e SÓ
    // ENTÃO a tela troca. Sem esta espera a animação é cortada no primeiro
    // quadro — e o instante do desbloqueio é justamente onde a pessoa quer
    // confirmação. O tempo vem do próprio componente, não de um 550 solto aqui.
    setTimeout(
      () => completeLogin(sessaoPendente.token, sessaoPendente.name),
      DURACAO_SELO_MS,
    );
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
        {/* ABERTURA "SÓBRIA" — escolha do dono em 16/09/2026.
            O pote enche, um halo dourado se acende atrás dele e se dissipa, e
            o resto entra com fade PURO. Sem deslocamento de propósito: foi
            `translate` em animação de entrada que colapsou a tela inteira na
            web (Reanimated 3.16 devolvendo `position: absolute` ao terminar),
            e este é o caminho que não repete aquilo. */}
        <View className="w-24 h-24 justify-center items-center mb-4">
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: "absolute",
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: t.accent.neonMuted,
              },
              estiloHalo,
            ]}
          />
          <BrandOpening
            ready={pronto}
            size={64}
            onSettled={() => setRevelado(true)}
          />
        </View>
        {revelado && (
          <Animated.View
            entering={FadeIn.duration(280)}
            className="items-center"
          >
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

      {!revelado ? null : (
        <Animated.View entering={FadeIn.duration(360).delay(60)}>
          {error && (
            <View className="bg-danger/15 p-3 rounded-xl mb-4 border border-danger/40">
              <Text className="text-danger text-center text-sm">{error}</Text>
            </View>
          )}

          {mfaToken ? (
            <>
              <Text className="text-textSecondary text-sm mb-4 text-center">
                Digite o código de 6 dígitos do seu aplicativo autenticador — ou
                um dos códigos de recuperação que você guardou.
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
                  setMfaIssuedAt(null);
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
                className="bg-primary h-14 rounded-xl justify-center items-center active:bg-accentPressed"
                onPress={handleLogin}
                disabled={isLoading}
                accessibilityLabel="Entrar"
                accessibilityRole="button"
              >
                {isLoading ? (
                  <ActivityIndicator color={t.text.inverse} />
                ) : (
                  <Text className="text-primaryDark font-bold text-lg">
                    Entrar
                  </Text>
                )}
              </TouchableOpacity>

              {/* O bloco de baixo, como o dono pediu em 16/09/2026: "embaixo
                  fique com botão igual o de entrar, mas com cor diferente
                  (menos destacado) e precisamos colocar o esqueci a senha
                  também".

                  A entrada por Google e outros provedores ficou para depois —
                  decisão dele —, então o lugar dos botões sociais é ocupado
                  pelo caminho que já existe: criar conta. Mesmo formato do
                  "Entrar" (h-14, mesmo raio) para a mão saber que é botão, e
                  cor recuada para o olho saber qual é o principal.

                  "Esqueci minha senha" desceu para cá. Antes era um link
                  miúdo alinhado à direita, acima do botão: quem erra a senha
                  olha para BAIXO do formulário, não para cima dele. */}
              <TouchableOpacity
                className="mt-3 h-14 rounded-xl justify-center items-center border active:bg-border"
                style={{
                  backgroundColor: t.background.elevated,
                  borderColor: t.border.default,
                }}
                onPress={() => navigation.navigate("Register")}
                accessibilityLabel="Criar conta"
                accessibilityRole="button"
              >
                <Text
                  className="font-bold text-lg"
                  style={{ color: t.text.primary }}
                >
                  Criar conta
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-4 items-center py-1"
                onPress={() => navigation.navigate("ForgotPassword")}
                accessibilityLabel="Esqueci minha senha"
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text className="text-primary font-bold text-sm">
                  Esqueci minha senha
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
        </Animated.View>
      )}

      {/* A oferta entra na FILA da abertura: sem isso ela dividia a tela com o
          anúncio de versão nova, que é montado acima das rotas e aparece até
          sobre o Login. Ver store/announcementStore */}
      <BiometricPrompt
        visible={ofertaDeBiometriaNaVez}
        onEnable={handleBiometricEnable}
        onDecline={handleBiometricDecline}
      />
    </KeyboardAvoidingView>
  );
}
