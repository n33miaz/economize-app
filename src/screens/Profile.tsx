import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Banknote from "lucide-react-native/dist/esm/icons/banknote";
import CalendarClock from "lucide-react-native/dist/esm/icons/calendar-clock";
import CalendarRange from "lucide-react-native/dist/esm/icons/calendar-range";
import Check from "lucide-react-native/dist/esm/icons/check";
import Clock3 from "lucide-react-native/dist/esm/icons/clock-3";
import FileText from "lucide-react-native/dist/esm/icons/file-text";
import FingerprintPattern from "lucide-react-native/dist/esm/icons/fingerprint-pattern";
import KeyRound from "lucide-react-native/dist/esm/icons/key-round";
import Languages from "lucide-react-native/dist/esm/icons/languages";
import LogOut from "lucide-react-native/dist/esm/icons/log-out";
import Mail from "lucide-react-native/dist/esm/icons/mail";
import Pencil from "lucide-react-native/dist/esm/icons/pencil";
import ReceiptText from "lucide-react-native/dist/esm/icons/receipt-text";
import SlidersHorizontal from "lucide-react-native/dist/esm/icons/sliders-horizontal";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import SunMoon from "lucide-react-native/dist/esm/icons/sun-moon";
import Tags from "lucide-react-native/dist/esm/icons/tags";
import TrendingUp from "lucide-react-native/dist/esm/icons/trending-up";
import X from "lucide-react-native/dist/esm/icons/x";
import type { LucideIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated from "react-native-reanimated";
import * as LocalAuthentication from "expo-local-authentication";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { askConfirm } from "../store/confirmStore";
import { useAuthStore } from "../store/authStore";
import { useUserStore } from "../store/userStore";
import {
  Currency,
  Language,
  ThemeMode,
  selectCycleAnchorDay,
  usePreferencesStore,
} from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";
import { useReportsStore } from "../store/reportsStore";
import * as Haptics from "../utils/haptics";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import ActionRow from "../components/ActionRow";
import CycleAnchorSheet from "../components/CycleAnchorSheet";
import SectionTitle from "../components/SectionTitle";
import SegmentedControl from "../components/SegmentedControl";
import {
  cycleWindowContaining,
  formatWindowLabel,
  isCalendarMonthAnchor,
  todayIso,
} from "../utils/cycleWindow";

// Nomes por extenso: a sigla sozinha não diz nada para quem não vive de câmbio
const CURRENCY_LABELS: Record<Currency, string> = {
  BRL: "Real brasileiro (R$)",
  USD: "Dólar americano (US$)",
  EUR: "Euro (€)",
};

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

function StatCard({
  label,
  value,
  Icon,
  loading,
}: {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  loading?: boolean;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.background.elevated,
        borderRadius: radius.xl,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: t.border.subtle,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: t.accent.neonMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing[2],
        }}
      >
        <Icon size={16} color={t.accent.neon} />
      </View>
      {loading ? (
        // Mesma pegada do número (fontSize 22 ≈ 26 de linha) para não pular
        <Skeleton width={44} height={22} className="my-0.5" />
      ) : (
        <Text
          style={{
            color: t.text.primary,
            fontSize: 22,
            fontWeight: "700",
          }}
        >
          {value}
        </Text>
      )}
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 12,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function InfoRow({
  Icon,
  label,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  value: string;
}) {
  const t = useTheme();
  return (
    <View
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing[3],
      }}
    >
      <View
        style={{
          width: 34,
          height: 34,
          borderRadius: radius.full,
          backgroundColor: t.accent.neonMuted,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing[3],
        }}
      >
        <Icon size={17} color={t.accent.neon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.text.secondary, fontSize: 12 }}>{label}</Text>
        <Text
          style={{
            color: t.text.primary,
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

export default function Profile() {
  const t = useTheme();
  const navigation = useNavigation();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const { userName, logout } = useAuthStore();
  const { me, isLoading, isSaving, fetchMe, updateName } = useUserStore();
  const {
    theme,
    biometricLogin,
    defaultCurrency,
    language,
    setTheme,
    setBiometric,
    setDefaultCurrency,
    setLanguage,
  } = usePreferencesStore();
  const showToast = useToastStore((s) => s.showToast);
  const {
    transactions: bankTxs,
    isLoading: bankLoading,
    fetchTransactions: fetchBankTxs,
  } = useBankStore();
  const {
    transactions: walletTxs,
    isLoading: walletLoading,
    fetchTransactions: fetchWalletTxs,
  } = useWalletStore();
  const {
    items: reports,
    isLoading: reportsLoading,
    fetch: fetchReports,
  } = useReportsStore();

  const anchorDay = usePreferencesStore(selectCycleAnchorDay);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [anchorSheetOpen, setAnchorSheetOpen] = useState(false);

  // Descrição do ciclo na própria linha: quem chegou aqui para conferir a
  // preferência precisa ver o efeito dela sem abrir a folha
  const currentCycle = cycleWindowContaining(anchorDay, todayIso());
  const anchorDescription = isCalendarMonthAnchor(anchorDay)
    ? "Começa no dia 1, como o calendário"
    : `Dia ${anchorDay} · agora em ${
        formatWindowLabel(currentCycle.start, currentCycle.end) ?? ""
      }`;

  useEffect(() => {
    // O hub concentra dados que antes viviam em três telas: perfil (Conta),
    // contadores das três fontes reais e o suporte a biometria do aparelho
    fetchMe();
    fetchReports();
    fetchBankTxs();
    fetchWalletTxs();
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
    // Mexer no toggle é decisão explícita: o modal de oferta do login não
    // deve reaparecer para quem já escolheu por aqui
    usePreferencesStore.getState().setBiometricChoiceMade(true);
    if (!next) {
      setBiometric(false);
      return;
    }
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Confirme para exigir desbloqueio ao entrar",
      });
      if (result.success) {
        setBiometric(true);
        showToast("Desbloqueio por biometria ativado.", "success");
      }
    } catch {
      // authenticateAsync também rejeita (não só resolve success=false)
      showToast("Biometria indisponível agora. Tente novamente.", "warning");
    }
  };

  const cycleCurrency = () => {
    Haptics.selectionAsync();
    const order: Currency[] = ["BRL", "USD", "EUR"];
    const next = order[(order.indexOf(defaultCurrency) + 1) % order.length];
    setDefaultCurrency(next);
  };

  const cycleLanguage = () => {
    Haptics.selectionAsync();
    const next: Language = language === "pt-BR" ? "en-US" : "pt-BR";
    setLanguage(next);
    // i18n ainda não aplicado nas telas — o aviso mantém a promessa honesta
    showToast("Idioma será aplicado em breve", "info");
  };

  const handleLogout = () => {
    askConfirm({
      title: "Sair",
      message: "Tem certeza que deseja encerrar a sessão?",
      confirmLabel: "Sair",
      destructive: true,
      onConfirm: () => logout(),
    });
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Perfil"
        subtitle="Conta e preferências"
        showProfileButton={false}
      />
      <ScrollView
        contentContainerStyle={{
          padding: spacing[5],
          paddingBottom: spacing[10],
        }}
      >
        <Animated.View
          entering={cardEntering}
          style={{
            alignItems: "center",
            marginBottom: spacing[6],
          }}
        >
          <View
            style={{
              width: 96,
              height: 96,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: t.accent.neon,
              marginBottom: spacing[3],
            }}
          >
            <Text
              style={{
                color: t.accent.neon,
                fontSize: 32,
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
                  color: t.text.primary,
                  fontSize: 18,
                  fontWeight: "700",
                  borderBottomWidth: 1,
                  borderBottomColor: t.accent.neon,
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
                  backgroundColor: t.accent.neon,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color={t.background.base} />
                ) : (
                  <Check size={18} color={t.background.base} />
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
                  backgroundColor: t.background.elevated,
                  borderWidth: 1,
                  borderColor: t.border.default,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} color={t.text.secondary} />
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
                  color: t.text.primary,
                  fontSize: 20,
                  fontWeight: "700",
                }}
              >
                {displayName}
              </Text>
              <Pencil size={16} color={t.text.tertiary} />
            </TouchableOpacity>
          )}
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              marginTop: 2,
            }}
          >
            Membro do Economize!
          </Text>
        </Animated.View>

        <Animated.View
          entering={listItemEntering(1)}
          style={{
            flexDirection: "row",
            gap: spacing[3],
          }}
        >
          <StatCard
            Icon={ReceiptText}
            label="Transações"
            value={bankTxs.length}
            loading={bankLoading && bankTxs.length === 0}
          />
          <StatCard
            Icon={TrendingUp}
            label="Ativos"
            value={walletTxs.length}
            loading={walletLoading && walletTxs.length === 0}
          />
          <StatCard
            Icon={FileText}
            label="Relatórios"
            value={reports.length}
            loading={reportsLoading && reports.length === 0}
          />
        </Animated.View>

        <Animated.View entering={listItemEntering(2)}>
          <SectionTitle>Conta</SectionTitle>
          <View
            style={{
              backgroundColor: t.background.elevated,
              borderRadius: radius["2xl"],
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[2],
              borderWidth: 1,
              borderColor: t.border.subtle,
              marginBottom: spacing[2],
            }}
          >
            {isLoading && !me ? (
              // Esqueletos com a geometria das três InfoRow (ícone + rótulo/valor)
              <>
                {[0, 1, 2].map((i) => (
                  <View
                    key={i}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: spacing[3],
                    }}
                  >
                    <Skeleton
                      width={34}
                      height={34}
                      borderRadius={radius.full}
                      className="mr-3"
                    />
                    <View style={{ flex: 1 }}>
                      <Skeleton width={88} height={12} className="mb-1.5" />
                      <Skeleton width="60%" height={15} />
                    </View>
                  </View>
                ))}
              </>
            ) : (
              <>
                <InfoRow Icon={Mail} label="E-mail" value={me?.email ?? "—"} />
                <View
                  style={{ height: 1, backgroundColor: t.border.subtle }}
                />
                <InfoRow
                  Icon={CalendarClock}
                  label="Membro desde"
                  value={formatDate(me?.createdAt)}
                />
                <View
                  style={{ height: 1, backgroundColor: t.border.subtle }}
                />
                <InfoRow
                  Icon={Clock3}
                  label="Último acesso"
                  value={formatDateTime(me?.lastLoginAt)}
                />
              </>
            )}
          </View>
          <ActionRow
            Icon={Tags}
            label="Minhas categorias"
            description="Organize como seus gastos são agrupados"
            onPress={() => navigation.navigate("Categorias" as never)}
          />
        </Animated.View>

        <Animated.View entering={listItemEntering(3)}>
          <SectionTitle>Preferências</SectionTitle>
          <View
            style={{
              backgroundColor: t.background.elevated,
              borderRadius: radius.xl,
              padding: spacing[4],
              borderWidth: 1,
              borderColor: t.border.subtle,
              marginBottom: spacing[2],
            }}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing[3],
              }}
            >
              <View
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: radius.full,
                  backgroundColor: t.background.surface,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: spacing[3],
                }}
              >
                <SunMoon size={17} color={t.text.primary} />
              </View>
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 15,
                  fontWeight: "600",
                }}
              >
                Aparência
              </Text>
            </View>
            <SegmentedControl<ThemeMode>
              value={theme}
              onChange={setTheme}
              options={[
                { label: "Claro", value: "light" },
                { label: "Escuro", value: "dark" },
                { label: "Sistema", value: "system" },
              ]}
            />
          </View>
          <ActionRow
            Icon={CalendarRange}
            label="Ciclo do mês"
            description={anchorDescription}
            onPress={() => setAnchorSheetOpen(true)}
          />
          <ActionRow
            Icon={Banknote}
            label="Moeda padrão"
            description={CURRENCY_LABELS[defaultCurrency]}
            onPress={cycleCurrency}
          />
          <ActionRow
            Icon={Languages}
            label="Idioma"
            description={
              language === "pt-BR" ? "Português (Brasil)" : "English (US)"
            }
            onPress={cycleLanguage}
          />
          <ActionRow
            Icon={FingerprintPattern}
            label="Desbloqueio por biometria"
            description={
              biometricAvailable
                ? "Exige biometria ou senha do aparelho ao abrir"
                : "Indisponível neste dispositivo"
            }
            disabled={!biometricAvailable}
            right={
              <Switch
                value={biometricLogin}
                onValueChange={handleBiometricToggle}
                disabled={!biometricAvailable}
                accessibilityLabel="Desbloqueio por biometria"
                trackColor={{
                  false: t.border.default,
                  true: t.accent.neon,
                }}
                thumbColor={t.background.base}
              />
            }
          />
        </Animated.View>

        <Animated.View entering={listItemEntering(4)}>
          <SectionTitle>Mais</SectionTitle>
          <ActionRow
            Icon={KeyRound}
            label="Alterar senha"
            description="Atualize sua senha de acesso"
            onPress={() => navigation.navigate("Alterar Senha" as never)}
          />
          <ActionRow
            Icon={Sparkles}
            label="Opções de IA"
            description="Provedor do assistente e sua própria chave"
            onPress={() => navigation.navigate("Opções de IA" as never)}
          />
          <ActionRow
            Icon={SlidersHorizontal}
            label="Opções avançadas"
            description="Exportar dados, notificações e suporte"
            onPress={() => navigation.navigate("Opções avançadas" as never)}
          />
        </Animated.View>

        <Animated.View
          entering={listItemEntering(5)}
          style={{ marginTop: spacing[4] }}
        >
          <ActionRow
            Icon={LogOut}
            label="Sair"
            destructive
            onPress={handleLogout}
          />
        </Animated.View>
      </ScrollView>

      <CycleAnchorSheet
        visible={anchorSheetOpen}
        onClose={() => setAnchorSheetOpen(false)}
      />
    </PageContainer>
  );
}
