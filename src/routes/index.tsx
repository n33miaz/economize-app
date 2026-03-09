import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { Platform, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

// --- NAVEGAÇÃO PRINCIPAL (BOTTOM TABS) ---
function MainTabs() {
  const insets = useSafeAreaInsets();

  return (
    <BottomTab.Navigator
      initialRouteName="Principal"
      screenOptions={{
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
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "stats-chart" : "stats-chart-outline"}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <BottomTab.Screen
        name="Principal"
        component={Home}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <View
              className={`w-12 h-12 rounded-full justify-center items-center ${focused ? "bg-primary/10" : ""}`}
            >
              <Ionicons
                name={focused ? "home" : "home-outline"}
                size={26}
                color={color}
              />
            </View>
          ),
        }}
      />
      <BottomTab.Screen
        name="Finanças"
        component={FinanceTabs}
        options={{
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "wallet" : "wallet-outline"}
              size={24}
              color={color}
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
