import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  ScrollView,
  Animated,
  Image,
} from "react-native";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const LINKEDIN_URL = "https://www.linkedin.com/in/neemiasmanso/";
const GITHUB_URL = "https://github.com/n33miaz";

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

  const handleLinkPress = (url: string) => Linking.openURL(url);

  return (
    <PageContainer>
      <ScreenHeader title="Sobre o App" subtitle="Informações do Projeto" />

      <ScrollView contentContainerClassName="p-5 pb-10 items-center">
        <Animated.View
          className="bg-white rounded-3xl p-6 w-full shadow-sm border border-gray-100"
          style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}
        >
          <View className="items-center mt-5">
            <View className="w-20 h-20 rounded-full bg-blue-50 justify-center items-center mb-3">
              <Image
                source={require("../../assets/logo.png")}
                className="w-24 h-24 rounded-2xl mb-4"
                resizeMode="contain"
              />
            </View>
            <Text className="text-2xl font-bold text-primaryDark">
              Painel Econômico
            </Text>
            <Text className="text-sm text-gray-500 font-regular mt-1">
              v{Constants.expoConfig?.version || "1.0.0"}
            </Text>
          </View>

          <View className="h-[1px] bg-gray-200 w-full my-5" />

          <Text className="text-base font-bold text-slate-800 mb-2">
            Projeto
          </Text>
          <Text className="text-sm text-gray-500 leading-6 font-regular mb-5 text-justify">
            Focado em performance e experiência do usuário, utilizando React
            Native com Expo no frontend e Java com Spring Boot no backend. O
            sistema consome APIs públicas para fornecer dados financeiros em
            tempo real, simulando um ambiente corporativo de alta fidelidade.
          </Text>

          <Text className="text-base font-bold text-slate-800 mb-2">
            Desenvolvedor
          </Text>
          <View className="flex-row items-center bg-background p-3 rounded-xl mb-6">
            <Image
              source={require("../../assets/neemias.jpeg")}
              className="w-10 h-10 rounded-full"
              resizeMode="cover"
            />
            <View className="ml-3">
              <Text className="text-base font-bold text-slate-800">
                Neemias Cormino Manso
              </Text>
              <Text className="text-xs text-gray-500 font-regular">
                FullStack Developer
              </Text>
            </View>
          </View>

          <View className="flex-row justify-between gap-3">
            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-primaryDark shadow-sm"
              onPress={() => handleLinkPress(LINKEDIN_URL)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-linkedin" size={20} color="#FFF" />
              <Text className="text-white text-sm font-bold ml-2">
                LinkedIn
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="flex-1 flex-row items-center justify-center py-3 rounded-xl bg-slate-800 shadow-sm"
              onPress={() => handleLinkPress(GITHUB_URL)}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-github" size={20} color="#FFF" />
              <Text className="text-white text-sm font-bold ml-2">GitHub</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        <Text className="mt-6 text-xs text-gray-400 text-center">
          © 2026 Painel Econômico. Todos os direitos reservados.
        </Text>
      </ScrollView>
    </PageContainer>
  );
}
