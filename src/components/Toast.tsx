import React, { useEffect } from "react";
import { View, Text, Platform } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useToastStore } from "../store/toastStore";

export default function Toast() {
  const { visible, message, type } = useToastStore();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(insets.top + 10, {
        damping: 15,
        stiffness: 90,
      });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(-100, { duration: 300 });
      opacity.value = withTiming(0, { duration: 300 });
    }
  }, [visible, insets.top]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const getToastConfig = () => {
    switch (type) {
      case "error":
        return { color: "bg-red-500", icon: "alert-circle" };
      case "success":
        return { color: "bg-green-500", icon: "checkmark-circle" };
      case "warning":
        return { color: "bg-amber-500", icon: "warning" };
      default:
        return { color: "bg-slate-800", icon: "information-circle" };
    }
  };

  const config = getToastConfig();

  return (
    <Animated.View
      className="absolute left-5 right-5 z-[999]"
      style={animatedStyle}
      pointerEvents="none"
    >
      <View
        className={`${config.color} flex-row items-center p-4 rounded-2xl shadow-lg shadow-black/20`}
      >
        <Ionicons name={config.icon as any} size={24} color="#FFF" />
        <Text className="text-white font-bold text-sm ml-3 flex-1 leading-5">
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}
