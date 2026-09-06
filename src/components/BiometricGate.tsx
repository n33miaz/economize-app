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

// Carência para o re-lock ao voltar do background: menos que isso é um
// alt-tab rápido e pedir biometria de novo só irritaria
const RELOCK_GRACE_MS = 30000;

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

  const runAuth = useCallback(async () => {
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
      const wantsLock = usePreferencesStore.getState().biometricLogin;
      if (currentToken && wantsLock && elapsed >= RELOCK_GRACE_MS) {
        setFalhou(false);
        setAuthorized(false);
      }
    });
    return () => subscription.remove();
  }, []);

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
