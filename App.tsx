import "./global.css";
import "react-native-gesture-handler";
import React, { useCallback, useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
// Import por subpasta: a raiz do pacote é um barril que puxa os 18 pesos da
// Roboto (2,8 MB de TTF no build) para usar dois
import { useFonts } from "expo-font";
import { Roboto_400Regular } from "@expo-google-fonts/roboto/400Regular";
import { Roboto_700Bold } from "@expo-google-fonts/roboto/700Bold";
import { Platform, UIManager, View, Text } from "react-native";
import * as NavigationBar from "expo-navigation-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import Routes from "./src/routes";
import Toast from "./src/components/Toast";
import ConfirmDialog from "./src/components/ConfirmDialog";
import ServerWakeOverlay from "./src/components/ServerWakeOverlay";
import BiometricGate from "./src/components/BiometricGate";
import { useTheme, useThemeSync } from "./src/theme/ThemeProvider";
import { lightTheme } from "./src/theme/colors";

SplashScreen.preventAutoHideAsync();

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function App() {
  // Repassa a preferência de tema para o NativeWind antes de qualquer tela
  useThemeSync();
  const t = useTheme();
  const isLight = t === lightTheme;
  const [appIsReady, setAppIsReady] = useState(false);
  const [fontsLoaded, fontError] = useFonts({
    Roboto_400Regular,
    Roboto_700Bold,
  });

  useEffect(() => {
    async function prepare() {
      try {
        if (Platform.OS === "android") {
          try {
            await NavigationBar.setBackgroundColorAsync(t.background.base);
            await NavigationBar.setButtonStyleAsync(isLight ? "dark" : "light");
          } catch (e) {
            console.log("Erro ao configurar NavigationBar:", e);
          }
        }
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
  }, [t, isLight]);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady && (fontsLoaded || fontError)) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady, fontsLoaded, fontError]);

  if (!appIsReady || (!fontsLoaded && !fontError)) {
    return null;
  }

  if (fontError) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Erro ao carregar recursos do sistema.</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <StatusBar
          style={isLight ? "dark" : "light"}
          backgroundColor={t.background.base}
        />
        <BiometricGate>
          <Routes />
        </BiometricGate>
        {/* Camadas globais: ficam fora do gate para poderem falar mesmo
            enquanto o app está bloqueado ou sem dados */}
        <ServerWakeOverlay />
        <ConfirmDialog />
        <Toast />
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
