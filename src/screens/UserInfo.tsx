import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
} from "react-native";
import {
  CalendarClock,
  Check,
  Clock3,
  FingerprintPattern,
  Info,
  Mail,
  Pencil,
  X,
} from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated from "react-native-reanimated";
import * as LocalAuthentication from "expo-local-authentication";

import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { useAuthStore } from "../store/authStore";
import { useUserStore } from "../store/userStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toLocaleDateString("pt-BR")} às ${date.toLocaleTimeString(
    "pt-BR",
    { hour: "2-digit", minute: "2-digit" },
  )}`;
}

function InfoRow({
  Icon,
  label,
  value,
}: {
  Icon: typeof Mail;
  label: string;
  value: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing[3],
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: darkTheme.accent.neonMuted,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing[3],
        }}
      >
        <Icon size={17} color={darkTheme.accent.neon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: darkTheme.text.secondary, fontSize: 12 }}>
          {label}
        </Text>
        <Text
          style={{
            color: darkTheme.text.primary,
            fontSize: 15,
            fontWeight: "600",
            marginTop: 1,
          }}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function UserInfo() {
  const navigation = useNavigation();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const userName = useAuthStore((s) => s.userName);
  const { me, isLoading, isSaving, fetchMe, updateName } = useUserStore();
  const { biometricLogin, setBiometric } = usePreferencesStore();
  const showToast = useToastStore((s) => s.showToast);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);

  useEffect(() => {
    fetchMe();
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setBiometricAvailable(hasHardware && enrolled);
    })();
    // carga única de dados da tela
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayName = me?.name || userName || "Usuário";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const startEditing = () => {
    setDraftName(displayName);
    setEditing(true);
  };

  const saveName = async () => {
    const name = draftName.trim();
    if (!name) {
      showToast("O nome não pode ficar vazio.", "warning");
      return;
    }
    if (name === displayName) {
      setEditing(false);
      return;
    }
    const ok = await updateName(name);
    if (ok) {
      showToast("Nome atualizado.", "success");
      setEditing(false);
    } else {
      showToast("Não foi possível salvar o nome.", "error");
    }
  };

  const handleBiometricToggle = async (next: boolean) => {
    if (!next) {
      setBiometric(false);
      return;
    }
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Confirme para exigir desbloqueio ao entrar",
    });
    if (result.success) {
      setBiometric(true);
      showToast("Desbloqueio ao entrar ativado.", "success");
    }
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Informações"
        subtitle="Seus dados no Economize!"
        showProfileButton={false}
      />
      <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
        <Animated.View
          entering={cardEntering}
          style={{ alignItems: "center", marginBottom: spacing[6] }}
        >
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radius.full,
              backgroundColor: darkTheme.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: darkTheme.accent.neon,
              marginBottom: spacing[3],
            }}
          >
            <Text
              style={{
                color: darkTheme.accent.neon,
                fontSize: 30,
                fontWeight: "700",
              }}
            >
              {initials}
            </Text>
          </View>

          {editing ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
              }}
            >
              <TextInput
                value={draftName}
                onChangeText={setDraftName}
                autoFocus
                maxLength={100}
                accessibilityLabel="Editar nome"
                style={{
                  color: darkTheme.text.primary,
                  fontSize: 18,
                  fontWeight: "700",
                  borderBottomWidth: 1,
                  borderBottomColor: darkTheme.accent.neon,
                  paddingVertical: spacing[1],
                  minWidth: 180,
                  textAlign: "center",
                }}
              />
              <TouchableOpacity
                onPress={saveName}
                disabled={isSaving}
                accessibilityLabel="Salvar nome"
                accessibilityRole="button"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.full,
                  backgroundColor: darkTheme.accent.neon,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSaving ? (
                  <ActivityIndicator
                    size="small"
                    color={darkTheme.background.base}
                  />
                ) : (
                  <Check size={18} color={darkTheme.background.base} />
                )}
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setEditing(false)}
                accessibilityLabel="Cancelar edição"
                accessibilityRole="button"
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.full,
                  backgroundColor: darkTheme.background.elevated,
                  borderWidth: 1,
                  borderColor: darkTheme.border.default,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={darkTheme.text.secondary} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={startEditing}
              accessibilityLabel="Editar nome"
              accessibilityRole="button"
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: spacing[2],
              }}
            >
              <Text
                style={{
                  color: darkTheme.text.primary,
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                {displayName}
              </Text>
              <Pencil size={16} color={darkTheme.text.tertiary} />
            </TouchableOpacity>
          )}
        </Animated.View>

        <Animated.View
          entering={listItemEntering(1)}
          style={{
            backgroundColor: darkTheme.background.elevated,
            borderRadius: radius["2xl"],
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
            borderWidth: 1,
            borderColor: darkTheme.border.subtle,
            marginBottom: spacing[4],
          }}
        >
          {isLoading && !me ? (
            <ActivityIndicator
              color={darkTheme.accent.neon}
              style={{ paddingVertical: spacing[5] }}
            />
          ) : (
            <>
              <InfoRow Icon={Mail} label="E-mail" value={me?.email ?? "—"} />
              <View
                style={{
                  height: 1,
                  backgroundColor: darkTheme.border.subtle,
                }}
              />
              <InfoRow
                Icon={CalendarClock}
                label="Membro desde"
                value={formatDate(me?.createdAt)}
              />
              <View
                style={{
                  height: 1,
                  backgroundColor: darkTheme.border.subtle,
                }}
              />
              <InfoRow
                Icon={Clock3}
                label="Último acesso"
                value={formatDateTime(me?.lastLoginAt)}
              />
            </>
          )}
        </Animated.View>

        <Animated.View
          entering={listItemEntering(2)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: darkTheme.background.elevated,
            borderRadius: radius["2xl"],
            padding: spacing[4],
            borderWidth: 1,
            borderColor: darkTheme.border.subtle,
            marginBottom: spacing[6],
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              backgroundColor: darkTheme.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing[3],
            }}
          >
            <FingerprintPattern size={17} color={darkTheme.accent.neon} />
          </View>
          <View style={{ flex: 1, marginRight: spacing[3] }}>
            <Text
              style={{
                color: darkTheme.text.primary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Exigir desbloqueio ao entrar
            </Text>
            <Text
              style={{
                color: darkTheme.text.secondary,
                fontSize: 12,
                marginTop: 1,
              }}
            >
              {biometricAvailable
                ? "Biometria ou senha do aparelho a cada abertura"
                : "Indisponível neste dispositivo"}
            </Text>
          </View>
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
        </Animated.View>

        <Animated.View entering={listItemEntering(3)} style={pressStyle}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Sobre" as never)}
            onPressIn={onPressIn}
            onPressOut={onPressOut}
            accessibilityLabel="Sobre o app"
            accessibilityRole="button"
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              gap: spacing[2],
              backgroundColor: darkTheme.background.elevated,
              borderRadius: radius.xl,
              paddingVertical: spacing[4],
              borderWidth: 1,
              borderColor: darkTheme.border.subtle,
            }}
          >
            <Info size={18} color={darkTheme.text.secondary} />
            <Text
              style={{
                color: darkTheme.text.primary,
                fontSize: 15,
                fontWeight: "600",
              }}
            >
              Sobre o Economize!
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </PageContainer>
  );
}
