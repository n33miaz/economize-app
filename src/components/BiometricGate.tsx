import React, { useCallback, useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { FingerprintPattern } from "lucide-react-native";
import * as LocalAuthentication from "expo-local-authentication";

import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { useAuthStore } from "../store/authStore";
import { usePreferencesStore } from "../store/preferencesStore";

interface Props {
  children: React.ReactNode;
}

export default function BiometricGate({ children }: Props) {
  const token = useAuthStore((s) => s.token);
  const logout = useAuthStore((s) => s.logout);
  const biometricLogin = usePreferencesStore((s) => s.biometricLogin);
  const hasHydrated = usePreferencesStore((s) => s.hasHydrated);
  const setBiometric = usePreferencesStore((s) => s.setBiometric);

  const gateRequired = Boolean(token && biometricLogin);
  // Nasce bloqueado: liberar é sempre decisão do efeito abaixo, nunca do
  // estado inicial (que rodava antes da hidratação e deixava passar direto)
  const [authorized, setAuthorized] = useState(false);
  const [failures, setFailures] = useState(0);

  const runAuth = useCallback(async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!hasHardware || !enrolled) {
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

  // Splash neutro enquanto as preferências hidratam: nada de rotas aqui
  if (!hasHydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: darkTheme.background.base }} />
    );
  }

  if (gateRequired && !authorized) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: darkTheme.background.base,
          alignItems: "center",
          justifyContent: "center",
          padding: spacing[6],
        }}
      >
        <View
          style={{
            width: 88,
            height: 88,
            borderRadius: radius.full,
            backgroundColor: darkTheme.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[5],
            borderWidth: 2,
            borderColor: darkTheme.accent.neon,
          }}
        >
          <FingerprintPattern size={40} color={darkTheme.accent.neon} />
        </View>
        <Text
          style={{
            color: darkTheme.text.primary,
            fontSize: 20,
            fontWeight: "700",
            marginBottom: spacing[2],
          }}
        >
          Economize!
        </Text>
        <Text
          style={{
            color: darkTheme.text.secondary,
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
          style={{
            backgroundColor: darkTheme.accent.neon,
            paddingHorizontal: spacing[6],
            paddingVertical: spacing[3],
            borderRadius: radius.full,
          }}
        >
          <Text
            style={{
              color: darkTheme.text.inverse,
              fontWeight: "700",
              fontSize: 14,
            }}
          >
            Desbloquear
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return <>{children}</>;
}
