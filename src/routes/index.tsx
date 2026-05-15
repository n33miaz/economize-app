import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";

import { colors } from "../theme/colors";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";

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
            backgroundColor: "white",
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
            backgroundColor: "white",
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

function AnimatedTabIcon({ activeName, inactiveName, focused, size }: any) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 300 });
  }, [focused]);

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
        <Ionicons name={inactiveName} size={size} color={colors.inactive} />
      </Animated.View>
      <Animated.View style={activeStyle}>
        <Ionicons name={activeName} size={size} color={colors.primary} />
      </Animated.View>
    </View>
  );
}

function HomeTabIcon({ focused, size }: any) {
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    progress.value = withTiming(focused ? 1 : 0, { duration: 500 });
  }, [focused]);

  const bgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(0, 174, 239, ${progress.value * 0.1})`,
  }));

  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    position: "absolute",
  }));

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 2 - progress.value,
  }));

  return (
    <Animated.View
      className="w-12 h-12 rounded-full justify-center items-center"
      style={bgStyle}
    >
      <Animated.View style={inactiveStyle}>
        <Ionicons name="home-outline" size={size} color={colors.inactive} />
      </Animated.View>
      <Animated.View style={activeStyle}>
        <Ionicons name="home" size={size} color={colors.primary} />
      </Animated.View>
    </Animated.View>
  );
}

// --- NAVEGAÇÃO PRINCIPAL (BOTTOM TABS) ---
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <BottomTab.Navigator
      initialRouteName="Principal"
      screenOptions={{
        animation: "fade",
        tabBarButton: (props) => (
          <TouchableOpacity {...(props as any)} activeOpacity={1} />
        ),
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: "white",
          height: 70 + (Platform.OS === "ios" ? insets.bottom : 0),
          paddingBottom: Platform.OS === "ios" ? insets.bottom : 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 10,
          shadowColor: "#000",
          shadowOpacity: 0.05,
          shadowRadius: 10,
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
              activeName="stats-chart"
              inactiveName="stats-chart-outline"
              focused={focused}
              size={24}
            />
          ),
        }}
      />
      <BottomTab.Screen
        name="Principal"
        component={Home}
        options={{
          tabBarIcon: ({ focused }) => (
            <HomeTabIcon focused={focused} size={26} />
          ),
        }}
      />
      <BottomTab.Screen
        name="Finanças"
        component={FinanceTabs}
        options={{
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              activeName="wallet"
              inactiveName="wallet-outline"
              focused={focused}
              size={24}
            />
          ),
        }}
      />
    </BottomTab.Navigator>
  );
}

// --- ROTAS DE AUTENTICAÇÃO ---
function AuthRoutes() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, animation: "fade" }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
    </Stack.Navigator>
  );
}

// --- ROOT NAVIGATOR ---
export default function Routes() {
  const token = useAuthStore((state) => state.token);

  return (
    <NavigationContainer>
      {token ? (
        <Stack.Navigator
          screenOptions={{ headerShown: false, animation: "slide_from_right" }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="Notícias" component={News} />
          <Stack.Screen name="IA Assist" component={AiAssistant} />
          <Stack.Screen
            name="Sobre"
            component={About}
            options={{ presentation: "modal", animation: "slide_from_bottom" }}
          />
        </Stack.Navigator>
      ) : (
        <AuthRoutes />
      )}
    </NavigationContainer>
  );
}
