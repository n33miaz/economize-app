import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  BackHandler,
  Keyboard,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FingerprintPattern from "lucide-react-native/dist/esm/icons/fingerprint-pattern";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";
import {
  biometricSupport,
  forgetBiometrics,
  verifyBiometrics,
} from "../utils/biometrics";

interface Props {
  children: React.ReactNode;
}

/**
 * Quanto tempo fora do app conta como "voltei já", por política.
 *
 * <p>Era 30 segundos fixos aqui. O dono pediu em 16/09/2026 uma configuração
 * para "não bloquear toda vez que sair do app (só ao fechá-lo ou depois de um
 * tempo)" — e estava certo: trocar para o WhatsApp para conferir um Pix e
 * voltar pedia o dedo de novo, o que é cerimônia sem segurança. Quem estava
 * com o telefone na mão continua sendo a mesma pessoa.
 *
 * <p>A política agora mora na preferência (`relockPolicy`). `onClose` devolve
 * infinito: nenhuma volta do segundo plano tranca, e a tranca continua
 * valendo no app FECHADO — que é o caso em que ela protege de verdade, porque
 * é o estado em que o aparelho fica sobre a mesa.
 */
function graceMs(
  policy: "always" | "after" | "onClose",
  minutes: number,
): number {
  if (policy === "always") return 0;
  if (policy === "onClose") return Number.POSITIVE_INFINITY;
  return Math.max(1, minutes) * 60_000;
}

/**
 * A tranca do app.
 *
 * <p>Quando ela está armada, o que aparece é uma TELA INTEIRA — não um
 * diálogo sobre o conteúdo. A diferença não é estética: um diálogo diz "há um
 * app atrás disto, responda para continuar", e o que se quer dizer aqui é "o
 * app está fechado". Por isso o fundo é o da aplicação, sem cartão, sem
 * moldura e com o mínimo de texto: o ícone, uma linha dizendo por que a tela
 * existe, um botão em destaque e uma saída discreta pela senha.
 */
export default function BiometricGate({ children }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const biometricLogin = usePreferencesStore((s) => s.biometricLogin);
  const relockPolicy = usePreferencesStore((s) => s.relockPolicy);
  const relockAfterMinutes = usePreferencesStore((s) => s.relockAfterMinutes);
  const prefsHydrated = usePreferencesStore((s) => s.hasHydrated);
  const authHydrated = useAuthStore((s) => s.hasHydrated);
  const setBiometric = usePreferencesStore((s) => s.setBiometric);

  // As duas hidratações precisam ter acontecido: se as preferências chegarem
  // antes do token, o gate decidiria "sem sessão" e liberaria um cold start
  // sem prompt quando o token aparecesse logo depois
  const hasHydrated = prefsHydrated && authHydrated;

  const gateRequired = Boolean(token && biometricLogin);
  // Nasce bloqueado: liberar é sempre decisão do efeito abaixo, nunca do
  // estado inicial (que rodava antes da hidratação e deixava passar direto)
  const [authorized, setAuthorized] = useState(false);
  /** Já houve uma tentativa que não deu certo? Muda só o texto de apoio. */
  const [falhou, setFalhou] = useState(false);
  const [verificando, setVerificando] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  /**
   * Trava de reentrada do pedido de biometria.
   *
   * <p><b>A corrida, encontrada na varredura de 16/09/2026.</b> `runAuth` era
   * chamado de DOIS lugares: o efeito que decide se a tranca vale, e o botão
   * "OK". O `verificando` acendia a luz de ocupado mas ninguém a olhava antes
   * de entrar — e o efeito depende de `authorized`, que só muda no FIM da
   * verificação. Qualquer re-render com a tranca ainda fechada (a hidratação
   * concluindo, o tema mudando, o toque no botão enquanto o prompt abria)
   * disparava uma segunda chamada, e o sistema empilhava dois pedidos de
   * digital — dois diálogos, um atrás do outro, que é parte do que o dono viu
   * como "modais aparecendo todos ao mesmo tempo".
   *
   * <p>Um `ref` e não estado: a decisão de entrar tem de ver o valor do MESMO
   * instante. Estado só muda no render seguinte, que é exatamente a fresta que
   * a segunda chamada usava.
   */
  const verificandoAgora = useRef(false);

  const runAuth = useCallback(async () => {
    if (verificandoAgora.current) return;
    verificandoAgora.current = true;
    setVerificando(true);
    try {
      // A web entra por aqui igual ao celular desde que o adaptador ganhou o
      // caminho do WebAuthn: no navegador do telefone a digital existe, e antes
      // este mesmo teste a declarava "sem hardware" e liberava a tranca
      const { available } = await biometricSupport();
      if (!available) {
        // Sem hardware o gate degrada em silêncio e desarma a preferência para
        // não travar as próximas aberturas
        setBiometric(false);
        forgetBiometrics();
        setAuthorized(true);
        return;
      }
      if (await verifyBiometrics("Desbloqueie o Economize!")) {
        setAuthorized(true);
        setFalhou(false);
      } else {
        // Cancelar, digital molhada, leitor que não respondeu — do ponto de
        // vista de quem está na tela é tudo a mesma coisa: tentar de novo. O
        // botão continua ali, e é ele que pede a biometria outra vez.
        //
        // Não há mais "três erros e a sessão cai": com uma saída explícita
        // pela senha, derrubar a sessão de quem só está com o dedo molhado
        // punia o engano e não protegia de nada — quem tenta adivinhar
        // biometria esbarra primeiro no bloqueio do próprio sistema.
        setFalhou(true);
      }
    } finally {
      verificandoAgora.current = false;
      setVerificando(false);
    }
  }, [setBiometric]);

  useEffect(() => {
    // Só decide depois da hidratação — antes disso não sabemos se o gate vale
    if (!hasHydrated) return;
    if (!gateRequired) {
      setAuthorized(true);
      return;
    }
    if (!authorized) runAuth();
  }, [hasHydrated, gateRequired, authorized, runAuth]);

  // Re-lock ao voltar do background: mais de 30s fora e o app tranca de novo.
  // Lê token/preferência via getState para não recriar o listener a cada
  // mudança de estado.
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "background") {
        backgroundedAt.current = Date.now();
        return;
      }
      if (next !== "active" || backgroundedAt.current == null) return;
      const elapsed = Date.now() - backgroundedAt.current;
      backgroundedAt.current = null;
      const currentToken = useAuthStore.getState().token;
      const prefs = usePreferencesStore.getState();
      const wantsLock = prefs.biometricLogin;
      // Lido do store e não da closure: o listener é montado uma vez, e ler a
      // preferência aqui é o que faz a mudança valer sem remontar o app
      const carencia = graceMs(prefs.relockPolicy, prefs.relockAfterMinutes);
      if (currentToken && wantsLock && elapsed >= carencia) {
        setFalhou(false);
        setAuthorized(false);
      }
    });
    return () => subscription.remove();
    // A política é lida via `getState` dentro do listener; estas duas entram
    // na lista para o efeito ser recriado quando o usuário muda a escolha —
    // sem isso, um listener montado antes da mudança seguiria com a antiga
  }, [relockPolicy, relockAfterMinutes]);

  const locked = hasHydrated && gateRequired && !authorized;

  // Com as rotas montadas por baixo da tela de bloqueio, o voltar do Android
  // continuaria navegando às cegas atrás dela
  useEffect(() => {
    if (!locked) return;
    // Um TextInput focado atrás do overlay reabriria o teclado e a digitação
    // iria para a tela bloqueada
    Keyboard.dismiss();
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, [locked]);

  /**
   * Sair para a tela de senha. É `logout` porque a senha é justamente o que o
   * app não guarda: voltar a pedi-la é voltar ao login.
   */
  const entrarComSenha = useCallback(() => {
    setFalhou(false);
    logout();
  }, [logout]);

  // Splash neutro enquanto as preferências hidratam: nada de rotas aqui
  if (!hasHydrated) {
    return <View style={{ flex: 1, backgroundColor: t.background.base }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        // A tela de bloqueio esconde o conteúdo dos olhos, mas não do leitor
        // de tela: sem isto o TalkBack/VoiceOver navegaria os dados
        // financeiros por trás dela
        importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={locked}
      >
        {children}
      </View>
      {locked && (
        // No mesmo commit de render das rotas: nenhum quadro do conteúdo vaza
        // antes do desbloqueio. Ocupa a tela inteira, com o fundo do app —
        // é o app fechado, não um aviso por cima dele.
        <View
          accessibilityViewIsModal
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: t.background.base,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: spacing[6],
            paddingTop: insets.top,
            paddingBottom: insets.bottom + spacing[6],
          }}
        >
          <View
            style={{
              width: 120,
              height: 120,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing[8],
            }}
          >
            <FingerprintPattern size={56} color={t.accent.neon} />
          </View>

          <Text
            style={{
              color: t.text.primary,
              fontSize: 22,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            Economize! está trancado
          </Text>
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 15,
              lineHeight: 22,
              textAlign: "center",
              marginTop: spacing[3],
              marginBottom: spacing[8],
              maxWidth: 320,
            }}
          >
            {falhou
              ? "Não deu certo. Toque em OK para tentar de novo."
              : "Use sua biometria para abrir."}
          </Text>

          <TouchableOpacity
            onPress={runAuth}
            disabled={verificando}
            activeOpacity={0.85}
            accessibilityLabel="OK"
            accessibilityRole="button"
            accessibilityState={{ disabled: verificando, busy: verificando }}
            style={{
              width: "100%",
              maxWidth: 320,
              backgroundColor: t.accent.neon,
              paddingVertical: spacing[4],
              borderRadius: radius.full,
              alignItems: "center",
              opacity: verificando ? 0.7 : 1,
            }}
          >
            {verificando ? (
              <ActivityIndicator color={t.text.inverse} />
            ) : (
              <Text
                style={{
                  color: t.text.inverse,
                  fontWeight: "700",
                  fontSize: 16,
                }}
              >
                OK
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={entrarComSenha}
            activeOpacity={0.7}
            accessibilityLabel="Entrar com senha"
            accessibilityRole="button"
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={{ marginTop: spacing[6] }}
          >
            <Text
              style={{
                color: t.text.tertiary,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Entrar com senha
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
