import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Sparkles } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import LinearGradient from "react-native-linear-gradient";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

import { darkTheme } from "../theme/colors";
import { radius, shadow, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";

interface AssistantFABProps {
  label?: string;
  bottomOffset?: number;
}

const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

export default function AssistantFAB({
  label = "Fale com o Nino",
  bottomOffset,
}: AssistantFABProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const { fabEntering } = useMotionPresets();
  const progress = useSharedValue(0);

  useEffect(() => {
    // Halo girando é puramente decorativo: com movimento reduzido, fica parado
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
  }, [progress, reducedMotion]);

  const gradientStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${interpolate(progress.value, [0, 1], [0, 360])}deg` },
    ],
  }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("IA Assist" as never);
  };

  return (
    <Animated.View
      entering={fabEntering}
      pointerEvents="box-none"
      style={{
        position: "absolute",
        right: spacing[5],
        bottom: bottomOffset ?? insets.bottom + spacing[5],
      }}
    >
      <TouchableOpacity
        accessibilityLabel={label}
        activeOpacity={0.85}
        onPress={handlePress}
        style={[
          {
            borderRadius: radius.full,
            overflow: "hidden",
            padding: 2,
          },
          shadow.glow,
        ]}
      >
        <AnimatedLinearGradient
          colors={[
            darkTheme.accent.neon,
            darkTheme.semantic.info,
            darkTheme.accent.neon,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            {
              borderRadius: radius.full,
              padding: 2,
            },
            gradientStyle,
          ]}
        >
          <View
            style={{
              backgroundColor: darkTheme.background.elevated,
              borderRadius: radius.full,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              gap: spacing[2],
            }}
          >
            <Sparkles size={18} color={darkTheme.accent.neon} />
            <Text
              style={{
                color: darkTheme.text.primary,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {label}
            </Text>
          </View>
        </AnimatedLinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
