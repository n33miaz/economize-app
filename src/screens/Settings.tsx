import React, { useEffect, useState } from "react";
import {
  Alert,
  Linking,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";

import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import {
  Currency,
  Language,
  ThemeMode,
  usePreferencesStore,
} from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

function SectionTitle({ children }: { children: string }) {
  return (
    <Text
      style={{
        color: darkTheme.text.tertiary,
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginTop: spacing[5],
        marginBottom: spacing[2],
      }}
    >
      {children}
    </Text>
  );
}

function Row({
  icon,
  label,
  description,
  right,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  description?: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.7 : 1}
      onPress={onPress}
      disabled={!onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: darkTheme.background.elevated,
        borderRadius: radius.lg,
        paddingVertical: spacing[3],
        paddingHorizontal: spacing[4],
        marginBottom: spacing[2],
        borderWidth: 1,
        borderColor: darkTheme.border.subtle,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: darkTheme.background.surface,
          marginRight: spacing[3],
        }}
      >
        <Ionicons name={icon} size={16} color={darkTheme.text.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: darkTheme.text.primary,
            fontSize: 14,
            fontWeight: "600",
          }}
        >
          {label}
        </Text>
        {description && (
          <Text
            style={{
              color: darkTheme.text.secondary,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {description}
          </Text>
        )}
      </View>
      {right}
    </TouchableOpacity>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (next: T) => void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: darkTheme.background.surface,
        borderRadius: radius.full,
        padding: 2,
        marginBottom: spacing[2],
      }}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <TouchableOpacity
            key={opt.value}
            onPress={() => onChange(opt.value)}
            activeOpacity={0.7}
            style={{
              flex: 1,
              paddingVertical: spacing[2],
              borderRadius: radius.full,
              backgroundColor: active
                ? darkTheme.accent.neon
                : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: active ? darkTheme.text.inverse : darkTheme.text.primary,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function Settings() {
  const {
    theme,
    biometricLogin,
    defaultCurrency,
    language,
    notificationsEnabled,
    setTheme,
    setBiometric,
    setDefaultCurrency,
    setLanguage,
    toggleNotifications,
  } = usePreferencesStore();
  const showToast = useToastStore((s) => s.showToast);

  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && enrolled);
    })();
  }, []);

  const handleBiometricToggle = async (next: boolean) => {
    if (!next) {
      setBiometric(false);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirme para habilitar biometria",
    });
    if (result.success) {
      setBiometric(true);
      showToast("Biometria habilitada", "success");
    }
  };

  const handleClearLocal = () => {
    Alert.alert(
      "Apagar dados locais",
      "Isso vai remover preferências e cache. Deseja continuar?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Apagar",
          style: "destructive",
          onPress: () =>
            showToast("Funcionalidade em breve", "info"),
        },
      ],
    );
  };

  return (
    <PageContainer>
      <ScreenHeader title="Preferências" showProfileButton={false} />
      <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
        <SectionTitle>Aparência</SectionTitle>
        <SegmentedControl<ThemeMode>
          value={theme}
          onChange={setTheme}
          options={[
            { label: "Claro", value: "light" },
            { label: "Escuro", value: "dark" },
            { label: "Sistema", value: "system" },
          ]}
        />

        <SectionTitle>Segurança</SectionTitle>
        <Row
          icon="finger-print-outline"
          label="Bloqueio por biometria"
          description={
            biometricAvailable
              ? "Solicita biometria ao abrir o app"
              : "Indisponível neste dispositivo"
          }
          right={
            <Switch
              value={biometricLogin}
              onValueChange={handleBiometricToggle}
              disabled={!biometricAvailable}
              trackColor={{
                false: darkTheme.border.default,
                true: darkTheme.accent.neon,
              }}
              thumbColor={darkTheme.background.base}
            />
          }
        />

        <SectionTitle>Conta</SectionTitle>
        <Row
          icon="cash-outline"
          label="Moeda padrão"
          description={defaultCurrency}
          onPress={() => {
            const order: Currency[] = ["BRL", "USD", "EUR"];
            const next =
              order[(order.indexOf(defaultCurrency) + 1) % order.length];
            setDefaultCurrency(next);
          }}
        />
        <Row
          icon="language-outline"
          label="Idioma"
          description={language === "pt-BR" ? "Português" : "English"}
          onPress={() => {
            const next: Language = language === "pt-BR" ? "en-US" : "pt-BR";
            setLanguage(next);
            showToast("Idioma será aplicado em breve", "info");
          }}
        />

        <SectionTitle>Notificações</SectionTitle>
        <Row
          icon="notifications-outline"
          label="Resumo semanal"
          description="Receba um resumo do seu mês"
          right={
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{
                false: darkTheme.border.default,
                true: darkTheme.accent.neon,
              }}
              thumbColor={darkTheme.background.base}
            />
          }
        />

        <SectionTitle>Dados</SectionTitle>
        <Row
          icon="cloud-download-outline"
          label="Exportar meus dados"
          description="Receberemos por e-mail (mock)"
          onPress={() => showToast("Enviaremos seu pacote por e-mail", "info")}
        />
        <Row
          icon="trash-outline"
          label="Apagar dados locais"
          description="Cache e preferências"
          onPress={handleClearLocal}
        />

        <SectionTitle>Suporte</SectionTitle>
        <Row
          icon="alert-circle-outline"
          label="Reportar um problema"
          onPress={() =>
            Linking.openURL(
              "mailto:neemias.manso@jcgestaoderiscos.com.br?subject=Economize!%20-%20Suporte",
            )
          }
        />
        <Row
          icon="star-outline"
          label="Avaliar o Economize!"
          onPress={() => showToast("Em breve na loja", "info")}
        />
      </ScrollView>
    </PageContainer>
  );
}
