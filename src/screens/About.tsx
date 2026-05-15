import React from "react";
import {
  Image,
  Linking,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

import { darkTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const LINKEDIN_URL = "https://www.linkedin.com/in/neemiasmanso/";
const GITHUB_URL = "https://github.com/n33miaz";
const PROJECT_URL = "https://github.com/n33miaz/economize";

function InfoBlock({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ marginBottom: spacing[5] }}>
      <Text
        style={{
          color: darkTheme.text.tertiary,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: spacing[2],
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: darkTheme.text.primary,
          fontSize: 14,
          lineHeight: 22,
        }}
      >
        {children}
      </Text>
    </View>
  );
}

export default function About() {
  const open = (url: string) => Linking.openURL(url);

  return (
    <PageContainer>
      <ScreenHeader
        title="Sobre o Economize!"
        subtitle="Informações do projeto"
        showProfileButton={false}
      />
      <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
        <View style={{ alignItems: "center", marginBottom: spacing[6] }}>
          <Image
            source={require("../../assets/logo.png")}
            style={{ width: 88, height: 88, borderRadius: radius["2xl"] }}
            resizeMode="contain"
          />
          <Text
            style={{
              color: darkTheme.text.primary,
              fontSize: 22,
              fontWeight: "700",
              marginTop: spacing[3],
            }}
          >
            Economize!
          </Text>
          <Text
            style={{
              color: darkTheme.text.secondary,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            v{Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </View>

        <View
          style={{
            backgroundColor: darkTheme.background.elevated,
            borderRadius: radius.xl,
            padding: spacing[5],
            borderWidth: 1,
            borderColor: darkTheme.border.subtle,
            marginBottom: spacing[5],
          }}
        >
          <InfoBlock title="Missão">
            Tornar finanças pessoais simples, inteligentes e bonitas. Cotações
            em tempo real, carteira, extrato multi-formato e um assistente que
            entende seus gastos.
          </InfoBlock>
          <InfoBlock title="Stack">
            React Native + Expo no app, Spring Boot no backend, Postgres,
            event-driven, JWT e biometria.
          </InfoBlock>
          <InfoBlock title="Privacidade">
            Seus dados ficam armazenados em servidores que você controla. Nada
            é compartilhado com terceiros sem permissão explícita.
          </InfoBlock>
        </View>

        <TouchableOpacity
          onPress={() => open(PROJECT_URL)}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: darkTheme.accent.neonMuted,
            borderColor: darkTheme.accent.neon,
            borderWidth: 1,
            paddingVertical: spacing[3],
            borderRadius: radius.full,
            marginBottom: spacing[6],
          }}
        >
          <Ionicons name="logo-github" size={18} color={darkTheme.accent.neon} />
          <Text
            style={{
              color: darkTheme.accent.neon,
              fontWeight: "700",
              marginLeft: spacing[2],
            }}
          >
            Ver código do projeto
          </Text>
        </TouchableOpacity>

        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: darkTheme.border.subtle,
            paddingTop: spacing[5],
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: darkTheme.text.tertiary,
              fontSize: 11,
              letterSpacing: 1,
              textTransform: "uppercase",
              marginBottom: spacing[3],
            }}
          >
            Desenvolvido por
          </Text>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing[3],
            }}
          >
            <Image
              source={require("../../assets/neemias.jpeg")}
              style={{
                width: 32,
                height: 32,
                borderRadius: radius.full,
                marginRight: spacing[2],
              }}
            />
            <Text
              style={{
                color: darkTheme.text.primary,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              Neemias Cormino Manso
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <TouchableOpacity onPress={() => open(LINKEDIN_URL)}>
              <Ionicons
                name="logo-linkedin"
                size={22}
                color={darkTheme.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => open(GITHUB_URL)}>
              <Ionicons
                name="logo-github"
                size={22}
                color={darkTheme.text.secondary}
              />
            </TouchableOpacity>
          </View>
          <Text
            style={{
              color: darkTheme.text.tertiary,
              fontSize: 10,
              marginTop: spacing[4],
            }}
          >
            © 2026 Economize! Todos os direitos reservados.
          </Text>
        </View>
      </ScrollView>
    </PageContainer>
  );
}
