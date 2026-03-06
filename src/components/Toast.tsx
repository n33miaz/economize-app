import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
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

  const translateY = useSharedValue(-150);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(insets.top + 10, {
        damping: 15,
        stiffness: 120,
      });
    } else {
      translateY.value = withTiming(-150, { duration: 300 });
    }
  }, [visible, insets.top]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const getToastConfig = () => {
    switch (type) {
      case "error":
        return { bg: "bg-red-500", icon: "alert-circle" };
      case "success":
        return { bg: "bg-green-500", icon: "checkmark-circle" };
      case "warning":
        return { bg: "bg-amber-500", icon: "warning" };
      default:
        return { bg: "bg-slate-800", icon: "information-circle" };
    }
  };

  const config = getToastConfig();

  return (
    <View style={styles.absoluteContainer} pointerEvents="box-none">
      <Animated.View style={[styles.toastWrapper, animatedStyle]}>
        <View
          className={`${config.bg} flex-row items-center px-4 py-3 rounded-full shadow-lg`}
        >
          <Ionicons name={config.icon as any} size={20} color="#FFF" />
          <Text className="text-white font-bold text-sm ml-2 shrink">
            {message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  absoluteContainer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 99,
    alignItems: "center",
    justifyContent: "flex-start",
  },
  toastWrapper: {
    position: "absolute",
    top: 0,
    alignSelf: "center",
    maxWidth: "90%",
  },
});
