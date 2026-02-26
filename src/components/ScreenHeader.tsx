import React from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, DrawerActions } from "@react-navigation/native";
import Constants from "expo-constants";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightAction?: React.ReactNode;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightAction,
}: ScreenHeaderProps) {
  const navigation = useNavigation();
  const paddingTop = Constants.statusBarHeight + 10;

  return (
    <View
      className="bg-primaryDark pb-5 px-5 rounded-b-3xl shadow-lg z-50"
      style={{ paddingTop }}
    >
      <StatusBar barStyle="light-content" backgroundColor="#053D99" />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            className="w-10 h-10 bg-white/15 rounded-xl justify-center items-center mr-3 active:bg-white/25"
            onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
          >
            <Ionicons name="menu" size={24} color="#FFF" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="text-xl font-bold text-white">{title}</Text>
            {subtitle && (
              <Text className="text-xs text-white/80 font-regular mt-0.5">
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        {rightAction && <View className="ml-2">{rightAction}</View>}
      </View>
    </View>
  );
}
