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
// Lucide não traz logos de marcas: Code representa o repositório e Globe o
// perfil na web, mantendo a família única de ícones do app
import { Code, Globe } from "lucide-react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const LINKEDIN_URL = "https://www.linkedin.com/in/neemiasmanso/";
const GITHUB_URL = "https://github.com/n33miaz";
const PROJECT_URL = "https://github.com/n33miaz/economize";

function InfoBlock({ title, children }: { title: string; children: string }) {
  const t = useTheme();
  return (
    <View style={{ marginBottom: spacing[5] }}>
      <Text
        style={{
          color: t.text.tertiary,
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
          color: t.text.primary,
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
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  const repoPress = usePressScale();
  const open = (url: string) => Linking.openURL(url);

  return (
    <PageContainer>
      <ScreenHeader
        title="Sobre o Economize!"
        subtitle="Informações do projeto"
        showProfileButton={false}
      />
      <ScrollView contentContainerStyle={{ padding: spacing[5] }}>
        <Animated.View
          entering={cardEntering}
          style={{ alignItems: "center", marginBottom: spacing[6] }}
        >
          <Image
            source={require("../../assets/logo-512.png")}
            style={{ width: 88, height: 88, borderRadius: radius["2xl"] }}
            resizeMode="contain"
          />
          <Text
            style={{
              color: t.text.primary,
              fontSize: 22,
              fontWeight: "700",
              marginTop: spacing[3],
            }}
          >
            Economize!
          </Text>
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            v{Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </Animated.View>

        <Animated.View
          entering={listItemEntering(1)}
          style={{
            backgroundColor: t.background.elevated,
            borderRadius: radius.xl,
            padding: spacing[5],
            borderWidth: 1,
            borderColor: t.border.subtle,
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
        </Animated.View>

        <Animated.View
          entering={listItemEntering(2)}
          style={[{ marginBottom: spacing[6] }, repoPress.pressStyle]}
        >
          <TouchableOpacity
            onPress={() => open(PROJECT_URL)}
            onPressIn={repoPress.onPressIn}
            onPressOut={repoPress.onPressOut}
            accessibilityLabel="Ver código do projeto"
            accessibilityRole="button"
            activeOpacity={0.85}
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.accent.neonMuted,
              borderColor: t.accent.neon,
              borderWidth: 1,
              paddingVertical: spacing[3],
              borderRadius: radius.full,
            }}
          >
            <Code size={18} color={t.accent.neon} />
            <Text
              style={{
                color: t.accent.neon,
                fontWeight: "700",
                marginLeft: spacing[2],
              }}
            >
              Ver código do projeto
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          entering={listItemEntering(3)}
          style={{
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
            paddingTop: spacing[5],
            alignItems: "center",
          }}
        >
          <Text
            style={{
              color: t.text.tertiary,
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
                color: t.text.primary,
                fontWeight: "600",
                fontSize: 13,
              }}
            >
              Neemias Cormino Manso
            </Text>
          </View>
          <View style={{ flexDirection: "row", gap: spacing[3] }}>
            <TouchableOpacity
              onPress={() => open(LINKEDIN_URL)}
              accessibilityLabel="Perfil no LinkedIn"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Globe size={22} color={t.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => open(GITHUB_URL)}
              accessibilityLabel="Perfil no GitHub"
              accessibilityRole="button"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Code size={22} color={t.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 10,
              marginTop: spacing[4],
            }}
          >
            © 2026 Economize! Todos os direitos reservados.
          </Text>
        </Animated.View>
      </ScrollView>
    </PageContainer>
  );
}
