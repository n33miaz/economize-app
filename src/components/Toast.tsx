import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useToastStore } from "../store/toastStore";
import { useTheme } from "../theme/ThemeProvider";
import { motion } from "../theme/ds";

export default function Toast() {
  const t = useTheme();
  const { visible, message, type } = useToastStore();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(-150);

  useEffect(() => {
    if (visible) {
      // Damping mais alto: o toast assenta sem quicar (motion intencional)
      translateY.value = withSpring(insets.top + 10, {
        damping: 20,
        stiffness: 160,
      });
    } else {
      translateY.value = withTiming(-150, { duration: motion.duration.base });
    }
  }, [visible, insets.top]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  // Fundo elevated único; o tipo colore apenas o ícone — no dark os tons
  // semânticos puros como fundo estouram e quebram o contraste do texto
  const getToastConfig = () => {
    switch (type) {
      case "error":
        return { color: t.semantic.danger, Icon: CircleAlert };
      case "success":
        return { color: t.semantic.success, Icon: CircleCheck };
      case "warning":
        return { color: t.semantic.warning, Icon: TriangleAlert };
      default:
        return { color: t.semantic.info, Icon: Info };
    }
  };

  const config = getToastConfig();
  const ToastIcon = config.Icon;

  return (
    <View
      className="absolute inset-0 items-center justify-start"
      style={{ zIndex: 9999, elevation: 99 }}
      pointerEvents="box-none"
    >
      <Animated.View
        className="absolute top-0 self-center max-w-[90%]"
        style={animatedStyle}
      >
        <View className="bg-elevated border border-border flex-row items-center px-4 py-3 rounded-full">
          <ToastIcon size={20} color={config.color} />
          <Text className="text-textPrimary font-bold text-sm ml-2 shrink">
            {message}
          </Text>
        </View>
      </Animated.View>
    </View>
  );
}
