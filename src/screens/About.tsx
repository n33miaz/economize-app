import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  ScrollView,
  Animated,
  Dimensions,
  Image,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const LINKEDIN_URL = "https://www.linkedin.com/in/neemiasmanso/";
const GITHUB_URL = "https://github.com/n33miaz";

const { width } = Dimensions.get("window");

export default function About() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLinkPress = (url: string) => {
    Linking.openURL(url);
  };

  return (
    <PageContainer>
      <ScreenHeader title="Sobre o App" subtitle="Informações do Projeto" />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <Image
                source={require("../../assets/logo.png")}
                style={styles.aboutLogo}
              />
            </View>
            <Text style={styles.appName}>Painel Econômico</Text>
            <Text style={styles.version}>
              v{Constants.expoConfig?.version || "1.0.0"}
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Projeto</Text>
          <Text style={styles.description}>
            Focado em performance e experiência do usuário, utilizando React
            Native com Expo no fronted e Java com Spring Boot no backend. O
            sistema consome APIs públicas para fornecer dados financeiros em
            tempo real, simulando um ambiente corporativo de alta fidelidade.
          </Text>

          <Text style={styles.sectionTitle}>Desenvolvedor</Text>
          <View style={styles.devContainer}>
            <Image
              source={require("../../assets/neemias.jpeg")}
              style={styles.devPhoto}
            />

            <View style={styles.devInfo}>
              <Text style={styles.devName}>Neemias Cormino Manso</Text>
              <Text style={styles.devRole}>FullStack Developer</Text>
            </View>
          </View>

          <View style={styles.buttonGroup}>
            <TouchableOpacity
              style={[styles.button, styles.linkedinButton]}
              onPress={() => handleLinkPress(LINKEDIN_URL)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-linkedin" size={20} color="#FFF" />
              <Text style={styles.buttonText}>LinkedIn</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.githubButton]}
              onPress={() => handleLinkPress(GITHUB_URL)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-github" size={20} color="#FFF" />
              <Text style={styles.buttonText}>GitHub</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text style={styles.footerText}>
          © 2026 Painel Econômico. Todos os direitos reservados.
        </Text>
      </ScrollView>
    </PageContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  card: {
    backgroundColor: colors.cardBackground,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logoContainer: {
    alignItems: "center",
    marginTop: 20,
  },
  devPhoto: {
    width: 40,
    height: 40,
    borderRadius: 20,
    resizeMode: "cover",
  },

  aboutLogo: {
    width: 100,
    height: 100,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(0, 173, 239, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  appName: {
    fontSize: 22,
    fontFamily: "Roboto_700Bold",
    color: colors.primaryDark,
  },
  version: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: "Roboto_400Regular",
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    width: "100%",
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Roboto_700Bold",
    color: colors.textPrimary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    fontFamily: "Roboto_400Regular",
    marginBottom: 20,
    textAlign: "justify",
  },
  devContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 12,
    marginBottom: 24,
  },
  devInfo: {
    marginLeft: 12,
  },
  devName: {
    fontSize: 16,
    fontFamily: "Roboto_700Bold",
    color: colors.textPrimary,
  },
  devRole: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: "Roboto_400Regular",
  },
  buttonGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 10,
    elevation: 2,
  },
  linkedinButton: {
    backgroundColor: colors.primaryDark,
  },
  githubButton: {
    backgroundColor: colors.textPrimary,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 14,
    fontFamily: "Roboto_700Bold",
    marginLeft: 8,
  },
  footerText: {
    marginTop: 24,
    fontSize: 12,
    color: colors.inactive,
    textAlign: "center",
  },
});
