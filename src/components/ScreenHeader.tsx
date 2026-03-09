import React from "react";
import { View, Text, TouchableOpacity, StatusBar } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import { colors } from "../theme/colors";

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
  const paddingTop = Constants.statusBarHeight + 20;

  return (
    <View
      className="bg-primaryDark pb-6 px-5 rounded-b-[32px] shadow-lg z-50"
      style={{ paddingTop }}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor={colors.primaryDark}
        translucent
      />

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-4">
          <View className="flex-1">
            <Text
              className="text-2xl font-bold text-white tracking-tight"
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {title}
            </Text>
            {subtitle && (
              <Text
                className="text-sm text-white/80 font-medium mt-1"
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {subtitle}
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center gap-2">
          {rightAction}

          {/* Sobre o App */}
          <TouchableOpacity
            className="w-8 h-10 bg-white/10 rounded-full justify-center items-center active:bg-white/20"
            onPress={() => navigation.navigate("Sobre" as never)}
          >
            <Ionicons name="information" size={20} color="#FFF" />
          </TouchableOpacity>

          {/* Perfil/Conta */}
          <TouchableOpacity
            className="w-14 h-14 bg-white/10 rounded-full justify-center items-center active:bg-white/20"
            onPress={() => {
              navigation.navigate("Sobre" as never);
            }}
          >
            <Ionicons name="person" size={18} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
