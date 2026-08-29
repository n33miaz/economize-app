import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AppState,
  BackHandler,
  Keyboard,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import FingerprintPattern from "lucide-react-native/dist/esm/icons/fingerprint-pattern";
import * as LocalAuthentication from "expo-local-authentication";

import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { askConfirm } from "../store/confirmStore";

interface Props {
  children: React.ReactNode;
}

// Carência para o re-lock ao voltar do background: menos que isso é um
// alt-tab rápido e pedir biometria de novo só irritaria
const RELOCK_GRACE_MS = 30000;

export default function BiometricGate({ children }: Props) {
  const t = useTheme();
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
  const [failures, setFailures] = useState(0);
  const backgroundedAt = useRef<number | null>(null);

  const runAuth = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
      // Sem hardware (web inclusa) o gate degrada em silêncio e desarma a
      // preferência para não travar as próximas aberturas
      setBiometric(false);
      setAuthorized(true);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Desbloqueie o Economize!",
      cancelLabel: "Cancelar",
      disableDeviceFallback: false,
    });
    if (result.success) {
      setAuthorized(true);
      setFailures(0);
    } else {
      setFailures((prev) => {
        const next = prev + 1;
        if (next >= 3) logout();
        return next;
      });
    }
  }, [setBiometric, logout]);

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
        setFailures(0);
        setAuthorized(false);
      }
    });
    return () => subscription.remove();
  }, []);

  const locked = hasHydrated && gateRequired && !authorized;

  // Com as rotas montadas por baixo do overlay, o voltar do Android
  // continuaria navegando às cegas atrás do bloqueio
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

  const handleLogout = useCallback(() => {
    askConfirm({
      title: "Sair da conta",
      message: "Tem certeza que deseja encerrar a sessão?",
      confirmLabel: "Sair",
      destructive: true,
      onConfirm: () => logout(),
    });
  }, [logout]);

  // Splash neutro enquanto as preferências hidratam: nada de rotas aqui
  if (!hasHydrated) {
    return <View style={{ flex: 1, backgroundColor: t.background.base }} />;
  }

  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ flex: 1 }}
        // O overlay esconde o conteúdo dos olhos, mas não do leitor de tela:
        // sem isto o TalkBack/VoiceOver navegaria os dados financeiros por
        // trás do bloqueio
        importantForAccessibility={locked ? "no-hide-descendants" : "auto"}
        accessibilityElementsHidden={locked}
      >
        {children}
      </View>
      {locked && (
        // Overlay no mesmo commit de render das rotas: nenhum frame do
        // conteúdo vaza antes do desbloqueio. O fundo é o base do tema,
        // 100% opaco de propósito.
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
            padding: spacing[5],
          }}
        >
          <View
            style={[
              {
                width: "100%",
                maxWidth: 420,
                backgroundColor: t.background.elevated,
                borderRadius: radius["2xl"],
                borderWidth: 1,
                borderColor: t.border.default,
                padding: spacing[6],
                alignItems: "center",
              },
              shadow.lg,
            ]}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: radius.full,
                backgroundColor: t.accent.neonMuted,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: spacing[5],
                borderWidth: 2,
                borderColor: t.accent.neon,
              }}
            >
              <FingerprintPattern size={40} color={t.accent.neon} />
            </View>
            <Text
              style={{
                color: t.text.primary,
                fontSize: 20,
                fontWeight: "700",
                marginBottom: spacing[2],
              }}
            >
              Economize!
            </Text>
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 14,
                textAlign: "center",
                marginBottom: spacing[6],
              }}
            >
              {failures > 0
                ? `Tentativa ${failures}/3 — toque para tentar novamente.`
                : "Use sua biometria para continuar."}
            </Text>
            <TouchableOpacity
              onPress={runAuth}
              activeOpacity={0.85}
              accessibilityLabel="Desbloquear"
              accessibilityRole="button"
              style={{
                backgroundColor: t.accent.neon,
                paddingHorizontal: spacing[6],
                paddingVertical: spacing[3],
                borderRadius: radius.full,
              }}
            >
              <Text
                style={{
                  color: t.text.inverse,
                  fontWeight: "700",
                  fontSize: 14,
                }}
              >
                Desbloquear
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleLogout}
              activeOpacity={0.7}
              accessibilityLabel="Sair da conta"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{ marginTop: spacing[5] }}
            >
              <Text
                style={{
                  color: t.text.secondary,
                  fontWeight: "600",
                  fontSize: 13,
                }}
              >
                Sair da conta
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
