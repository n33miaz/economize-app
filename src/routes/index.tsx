import React, { useState } from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItemList,
  DrawerContentComponentProps,
} from "@react-navigation/drawer";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import { NavigationContainer } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { View, Text, TouchableOpacity, Platform, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";

import { useAuthStore } from "../store/authStore";
import Login from "../screens/auth/Login";
import Register from "../screens/auth/Register";
import Home from "../screens/Home";
import Currencies from "../screens/Currencies";
import Indexes from "../screens/Indexes";
import News from "../screens/News";
import About from "../screens/About";
import Favorites from "../screens/Favorites";
import Wallet from "../screens/Wallet";

import ScreenHeader from "../components/ScreenHeader";

const Tab = createMaterialTopTabNavigator();
const Drawer = createDrawerNavigator();

function MainTabScreen() {
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState("Dashboard");

  let headerTitle = "Olá, Investidor";
  let headerSubtitle = "Resumo do Mercado";

  switch (activeTab) {
    case "Moedas":
      headerTitle = "Cotações";
      headerSubtitle = "Moedas Globais";
      break;
    case "Dashboard":
      headerTitle = "Olá, Investidor";
      headerSubtitle = "Resumo do Mercado";
      break;
    case "Índices":
      headerTitle = "Indicadores";
      headerSubtitle = "Bolsas e Taxas";
      break;
  }

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={headerTitle} subtitle={headerSubtitle} />

      <Tab.Navigator
        initialRouteName="Dashboard"
        tabBarPosition="bottom"
        screenOptions={{
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.inactive,
          tabBarPressColor: "transparent",
          tabBarIndicatorStyle: {
            backgroundColor: colors.primary,
            height: 3,
            borderTopLeftRadius: 3,
            borderTopRightRadius: 3,
            top: 0,
          },
          tabBarStyle: {
            backgroundColor: "white",
            height: 70 + (Platform.OS === "ios" ? insets.bottom : 0),
            paddingBottom: Platform.OS === "ios" ? insets.bottom : 10,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            elevation: 8,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.05,
            shadowRadius: 4,
          },
          tabBarLabelStyle: {
            fontFamily: "Roboto_700Bold",
            fontSize: 11,
            textTransform: "capitalize",
            marginTop: 2,
          },
          tabBarItemStyle: {
            marginBottom: -2,
          },
          swipeEnabled: true,
          animationEnabled: true,
        }}
      >
        <Tab.Screen
          name="Moedas"
          component={Currencies}
          listeners={{ focus: () => setActiveTab("Moedas") }}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "cash" : "cash-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Dashboard"
          component={Home}
          listeners={{ focus: () => setActiveTab("Dashboard") }}
          options={{
            tabBarLabel: "Início",
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "grid" : "grid-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />
        <Tab.Screen
          name="Índices"
          component={Indexes}
          listeners={{ focus: () => setActiveTab("Índices") }}
          options={{
            tabBarIcon: ({ focused, color }) => (
              <Ionicons
                name={focused ? "stats-chart" : "stats-chart-outline"}
                size={26}
                color={color}
              />
            ),
          }}
        />
      </Tab.Navigator>
    </View>
  );
}

function CustomDrawerContent(props: DrawerContentComponentProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="flex-1 bg-white" style={{ paddingTop: insets.top }}>
      <TouchableOpacity
        className="p-6 border-b border-gray-200 flex-row items-center bg-gray-50"
        onPress={() => props.navigation.navigate("Sobre")}
        activeOpacity={0.7}
      >
        <Image
          source={require("../../assets/logo.png")}
          className="w-12 h-12 rounded-xl mr-4 bg-gray-200"
          resizeMode="contain"
        />
        <View>
          <Text className="text-lg font-bold text-primary-dark">
            Painel Econômico
          </Text>
          <Text className="text-xs text-gray-500 font-regular">
            Soluções Inteligentes
          </Text>
        </View>
      </TouchableOpacity>

      <DrawerContentScrollView {...props} contentContainerClassName="pt-2.5">
        <DrawerItemList {...props} />
      </DrawerContentScrollView>

      <View
        className="px-5 border-t border-gray-200 pt-4 bg-gray-50"
        style={{ paddingBottom: 20 + insets.bottom }}
      >
        <TouchableOpacity
          className="flex-row items-center py-2.5"
          onPress={() => props.navigation.navigate("Sobre")}
        >
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={colors.textSecondary}
          />
          <Text className="ml-3 text-sm font-bold text-textSecondary">
            Sobre o App
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function DrawerNavigator() {
  return (
    <Drawer.Navigator
      initialRouteName="Início"
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: "front",
        swipeEnabled: true,
        swipeEdgeWidth: 100,
        drawerActiveBackgroundColor: "rgba(0, 173, 239, 0.08)",
        drawerActiveTintColor: colors.primaryDark,
        drawerInactiveTintColor: colors.textSecondary,
        drawerLabelStyle: {
          fontFamily: "Roboto_700Bold",
          marginLeft: 0,
        },
        drawerItemStyle: {
          borderRadius: 8,
          marginHorizontal: 10,
          marginVertical: 4,
        },
        drawerStyle: {
          width: "78%",
          backgroundColor: "#FFF",
        },
        overlayColor: "rgba(5, 61, 153, 0.4)",
      }}
    >
      <Drawer.Screen
        name="Início"
        component={MainTabScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="home-outline" size={22} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Carteira"
        component={Wallet}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="wallet-outline" size={22} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Notícias"
        component={News}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="newspaper-outline" size={22} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Favoritos"
        component={Favorites}
        options={{
          drawerIcon: ({ color }) => (
            <Ionicons name="star-outline" size={22} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Sobre"
        component={About}
        options={{
          drawerItemStyle: { display: "none" },
        }}
      />
    </Drawer.Navigator>
  );
}

const Stack = createNativeStackNavigator();

function AuthRoutes() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={Login} />
      <Stack.Screen name="Register" component={Register} />
    </Stack.Navigator>
  );
}

export default function Routes() {
  const token = useAuthStore((state) => state.token);

  return (
    <NavigationContainer>
      {token ? <DrawerNavigator /> : <AuthRoutes />}
    </NavigationContainer>
  );
}
