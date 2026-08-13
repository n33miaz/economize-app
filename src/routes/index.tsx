import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { ChartCandlestick, House, Wallet as WalletTabIcon } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { Platform, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { colors, darkTheme } from "../theme/colors";
import { motion, radius } from "../theme/ds";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";
import {
  ephemeralTransition,
  fadeTransition,
  modalLikeTransition,
  slideRightTransition,
} from "./transitions";

// Telas
import Login from "../screens/auth/Login";
import Register from "../screens/auth/Register";
import Home from "../screens/Home";
import Currencies from "../screens/Currencies";
import Indexes from "../screens/Indexes";
import News from "../screens/News";
import About from "../screens/About";
import Wallet from "../screens/Wallet";
import BankIntegration from "../screens/BankIntegration";
import AiAssistant from "../screens/AiAssistant";
import Profile from "../screens/Profile";
import Settings from "../screens/Settings";
import Reports from "../screens/Reports";
import Favorites from "../screens/Favorites";
import Analytics from "../screens/Analytics";
import Categories from "../screens/Categories";
import StatementReview from "../screens/StatementReview";
import UserInfo from "../screens/UserInfo";

const Stack = createNativeStackNavigator();
const BottomTab = createBottomTabNavigator();
const TopTab = createMaterialTopTabNavigator();

// Moedas e Índices
function IndicatorsTabs() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Indicadores" subtitle="Moedas e Índices Globais" />
      <TopTab.Navigator
        screenOptions={{
          tabBarPressColor: "transparent",
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inactive,
          tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 3 },
          tabBarStyle: {
            backgroundColor: colors.cardBackground,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontFamily: "Roboto_700Bold",
            fontSize: 12,
            textTransform: "capitalize",
          },
        }}
      >
        <TopTab.Screen name="Moedas" component={Currencies} />
        <TopTab.Screen name="Índices" component={Indexes} />
      </TopTab.Navigator>
    </View>
  );
}

// Carteira e Extrato (Open Finance)
function FinanceTabs() {
  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title="Finanças" subtitle="Gestão de Patrimônio" />
      <TopTab.Navigator
        screenOptions={{
          tabBarPressColor: "transparent",
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inactive,
          tabBarIndicatorStyle: { backgroundColor: colors.primary, height: 3 },
          tabBarStyle: {
            backgroundColor: colors.cardBackground,
            elevation: 0,
            shadowOpacity: 0,
          },
          tabBarLabelStyle: {
            fontFamily: "Roboto_700Bold",
            fontSize: 12,
            textTransform: "capitalize",
          },
        }}
      >
        <TopTab.Screen name="Carteira" component={Wallet} />
        <TopTab.Screen name="Extrato" component={BankIntegration} />
      </TopTab.Navigator>
    </View>
  );
}

// Lucide não tem variante preenchida: o estado ativo entra por cross-fade de
// cor (camada inativa some enquanto a camada accent aparece)
function AnimatedTabIcon({
  Icon,
  focused,
  size,
}: {
  Icon: LucideIcon;
  focused: boolean;
  size: number;
}) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, {
      duration: motion.duration.base,
    });
  }, [focused, progress]);

  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    position: "absolute",
  }));

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  return (
    <View className="justify-center items-center">
      <Animated.View style={inactiveStyle}>
        <Icon size={size} color={colors.inactive} />
      </Animated.View>
      <Animated.View style={activeStyle}>
        <Icon size={size} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

function HomeTabIcon({ focused, size }: { focused: boolean; size: number }) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, {
      duration: motion.duration.base,
    });
  }, [focused, progress]);

  // Halo em camada própria animando só a opacidade: evita interpolar cor
  // no worklet e mantém o token accentMuted como única fonte do tom
  const bgStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    position: "absolute",
  }));

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  return (
    <View className="w-12 h-12 rounded-full justify-center items-center">
      <Animated.View
        className="absolute inset-0 rounded-full bg-accentMuted"
        style={bgStyle}
      />
      <Animated.View style={inactiveStyle}>
        <House size={size} color={colors.inactive} />
      </Animated.View>
      <Animated.View style={activeStyle}>
        <House size={size} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

// --- NAVEGAÇÃO PRINCIPAL (BOTTOM TABS) ---
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <BottomTab.Navigator
      initialRouteName="Principal"
      screenOptions={{
        // "shift" desliza + esmaece na troca de tab — mesma família de movimento
        // da entrada do assistente, no lugar do corte seco do fade
        animation: "shift",
        tabBarButton: (props) => (
          <TouchableOpacity {...(props as any)} activeOpacity={1} />
        ),
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.cardBackground,
          height: 70 + (Platform.OS === "ios" ? insets.bottom : 0),
          paddingBottom: Platform.OS === "ios" ? insets.bottom : 10,
          paddingTop: 10,
          // No dark, sombra é invisível — a borda superior faz a separação
          borderTopWidth: 1,
          borderTopColor: colors.border,
          // Cantos superiores arredondados: o fundo do navigator (base) fica
          // visível atrás e a barra ganha a mesma geometria dos cards
          borderTopLeftRadius: radius["2xl"],
          borderTopRightRadius: radius["2xl"],
          overflow: "hidden",
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Roboto_700Bold",
          fontSize: 11,
          marginTop: 4,
        },
      }}
    >
      <BottomTab.Screen
        name="Indicadores"
        component={IndicatorsTabs}
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              Icon={ChartCandlestick}
              focused={focused}
              size={22}
            />
          ),
        }}
      />
      <BottomTab.Screen
        name="Principal"
        component={Home}
        options={{
          tabBarIcon: ({ focused }) => (
            <HomeTabIcon focused={focused} size={24} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Finanças"
        component={FinanceTabs}
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon Icon={WalletTabIcon} focused={focused} size={22} />
          ),
        }}
      />
    </BottomTab.Navigator>
  );
}

// --- ROTAS DE AUTENTICAÇÃO ---
function AuthRoutes() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...fadeTransition }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
    </Stack.Navigator>
  );
}

// Tema do container alinhado aos tokens: evita flashes brancos nas transições
// e pinta o fundo atrás dos cantos arredondados da tab bar
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: darkTheme.accent.neon,
    background: darkTheme.background.base,
    card: darkTheme.background.surface,
    text: darkTheme.text.primary,
    border: darkTheme.border.default,
    notification: darkTheme.accent.neon,
  },
};

// --- ROOT NAVIGATOR ---
export default function Routes() {
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);

  // Sem esperar a hidratação, o token persistido ainda não existe e o
  // cold start piscava a tela de Login antes de cair na Home
  if (!hasHydrated) {
    return (
      <View
        className="flex-1"
        style={{ backgroundColor: darkTheme.background.base }}
      />
    );
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {token ? (
        <Stack.Navigator
          screenOptions={{ headerShown: false, ...slideRightTransition }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Notícias"
            component={News}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="IA Assist"
            component={AiAssistant}
            options={modalLikeTransition}
          />
          <Stack.Screen
            name="Sobre"
            component={About}
            options={modalLikeTransition}
          />
          <Stack.Screen
            name="Profile"
            component={Profile}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="Settings"
            component={Settings}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="Relatórios"
            component={Reports}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="Favoritos"
            component={Favorites}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="Análise"
            component={Analytics}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="Categorias"
            component={Categories}
            options={ephemeralTransition}
          />
          <Stack.Screen
            name="Revisão"
            component={StatementReview}
            options={modalLikeTransition}
          />
          <Stack.Screen
            name="Conta"
            component={UserInfo}
            options={ephemeralTransition}
          />
        </Stack.Navigator>
      ) : (
        <AuthRoutes />
      )}
    </NavigationContainer>
  );
}
