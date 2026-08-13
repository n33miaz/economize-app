import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import {
  ChevronRight,
  CircleUserRound,
  FileText,
  Info,
  LogOut,
  ReceiptText,
  Settings,
  Tags,
  TrendingUp,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import Animated from "react-native-reanimated";

import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { useAuthStore } from "../store/authStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";
import { useReportsStore } from "../store/reportsStore";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

function StatCard({
  label,
  value,
  Icon,
}: {
  label: string;
  value: string | number;
  Icon: LucideIcon;
}) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: darkTheme.background.elevated,
        borderRadius: radius.xl,
        padding: spacing[4],
        borderWidth: 1,
        borderColor: darkTheme.border.subtle,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: darkTheme.accent.neonMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing[2],
        }}
      >
        <Icon size={16} color={darkTheme.accent.neon} />
      </View>
      <Text
        style={{
          color: darkTheme.text.primary,
          fontSize: 22,
          fontWeight: "700",
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: darkTheme.text.secondary,
          fontSize: 12,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

function ActionRow({
  Icon,
  label,
  onPress,
  destructive,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const color = destructive
    ? darkTheme.semantic.danger
    : darkTheme.text.primary;
  return (
    <Animated.View style={pressStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={label}
        accessibilityRole="button"
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: darkTheme.background.elevated,
          borderRadius: radius.xl,
          paddingVertical: spacing[4],
          paddingHorizontal: spacing[4],
          marginBottom: spacing[2],
          borderWidth: 1,
          borderColor: darkTheme.border.subtle,
        }}
      >
        <Icon size={20} color={color} />
        <Text
          style={{
            color,
            fontSize: 15,
            fontWeight: "600",
            marginLeft: spacing[3],
            flex: 1,
          }}
        >
          {label}
        </Text>
        {!destructive && (
          <ChevronRight size={18} color={darkTheme.text.tertiary} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function Profile() {
  const navigation = useNavigation();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const { userName, logout } = useAuthStore();
  const { transactions: bankTxs } = useBankStore();
  const { transactions: walletTxs } = useWalletStore();
  const { items: reports, fetch: fetchReports } = useReportsStore();

  React.useEffect(() => {
    // o contador era fixo em 0 — carrega os relatórios reais ao abrir o perfil
    fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initials = (userName || "Usuário")
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleLogout = () => {
    Alert.alert("Sair", "Tem certeza que deseja encerrar a sessão?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sair",
        style: "destructive",
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Perfil"
        subtitle="Sua conta"
        showProfileButton={false}
      />
      <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
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
                fontSize: 32,
                fontWeight: "700",
              }}
            >
              {initials}
            </Text>
          </View>
          <Text
            style={{
              color: darkTheme.text.primary,
              fontSize: 20,
              fontWeight: "700",
            }}
          >
            {userName || "Usuário"}
          </Text>
          <Text
            style={{
              color: darkTheme.text.secondary,
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
            marginBottom: spacing[6],
          }}
        >
          <StatCard
            Icon={ReceiptText}
            label="Transações"
            value={bankTxs.length}
          />
          <StatCard Icon={TrendingUp} label="Ativos" value={walletTxs.length} />
          <StatCard Icon={FileText} label="Relatórios" value={reports.length} />
        </Animated.View>

        <Animated.View entering={listItemEntering(2)}>
          <ActionRow
            Icon={CircleUserRound}
            label="Informações da conta"
            onPress={() => navigation.navigate("Conta" as never)}
          />
          <ActionRow
            Icon={Tags}
            label="Minhas categorias"
            onPress={() => navigation.navigate("Categorias" as never)}
          />
          <ActionRow
            Icon={Settings}
            label="Preferências"
            onPress={() => navigation.navigate("Settings" as never)}
          />
          <ActionRow
            Icon={Info}
            label="Sobre o Economize!"
            onPress={() => navigation.navigate("Sobre" as never)}
          />
          <View style={{ marginTop: spacing[4] }}>
            <ActionRow
              Icon={LogOut}
              label="Sair"
              destructive
              onPress={handleLogout}
            />
          </View>
        </Animated.View>
      </ScrollView>
    </PageContainer>
  );
}
