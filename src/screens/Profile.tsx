import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { useAuthStore } from "../store/authStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";

import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: keyof typeof Ionicons.glyphMap;
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
        <Ionicons name={icon} size={16} color={darkTheme.accent.neon} />
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
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const color = destructive
    ? darkTheme.semantic.danger
    : darkTheme.text.primary;
  return (
    <TouchableOpacity
      onPress={onPress}
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
      <Ionicons name={icon} size={20} color={color} />
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
        <Ionicons
          name="chevron-forward"
          size={18}
          color={darkTheme.text.tertiary}
        />
      )}
    </TouchableOpacity>
  );
}

export default function Profile() {
  const navigation = useNavigation();
  const { userName, logout } = useAuthStore();
  const { transactions: bankTxs } = useBankStore();
  const { transactions: walletTxs } = useWalletStore();

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
        <View
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
        </View>

        <View
          style={{
            flexDirection: "row",
            gap: spacing[3],
            marginBottom: spacing[6],
          }}
        >
          <StatCard
            icon="receipt-outline"
            label="Transações"
            value={bankTxs.length}
          />
          <StatCard
            icon="trending-up-outline"
            label="Ativos"
            value={walletTxs.length}
          />
          <StatCard
            icon="document-text-outline"
            label="Relatórios"
            value={0}
          />
        </View>

        <ActionRow
          icon="settings-outline"
          label="Preferências"
          onPress={() => navigation.navigate("Settings" as never)}
        />
        <ActionRow
          icon="information-circle-outline"
          label="Sobre o Economize!"
          onPress={() => navigation.navigate("Sobre" as never)}
        />
        <View style={{ marginTop: spacing[4] }}>
          <ActionRow
            icon="log-out-outline"
            label="Sair"
            destructive
            onPress={handleLogout}
          />
        </View>
      </ScrollView>
    </PageContainer>
  );
}
