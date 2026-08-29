import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../utils/haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withRepeat,
  withTiming,
  Easing,
  interpolate,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import BrandGradient from "./BrandGradient";

interface AssistantFABProps {
  label?: string;
  bottomOffset?: number;
}

/**
 * Altura do botão (ícone 18 + 12 de padding em cima e embaixo + as duas
 * bordas de 2 do halo). Exportada para as listas reservarem rodapé pelo
 * tamanho real do que flutua sobre elas, em vez de chutar um `pb-32`.
 */
export const ASSISTANT_FAB_HEIGHT = 52;

const AnimatedBrandGradient = Animated.createAnimatedComponent(BrandGradient);

export default function AssistantFAB({
  label = "Fale com o Nino",
  bottomOffset,
}: AssistantFABProps) {
  const t = useTheme();
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
      style={{
        position: "absolute",
        right: spacing[5],
        bottom: bottomOffset ?? insets.bottom + spacing[5],
        // No estilo, não como prop: `props.pointerEvents` está depreciado e
        // gritava no console da web a cada carga
        pointerEvents: "box-none",
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
        <AnimatedBrandGradient
          colors={[
            t.accent.neon,
            t.semantic.info,
            t.accent.neon,
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
              backgroundColor: t.background.elevated,
              borderRadius: radius.full,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              gap: spacing[2],
            }}
          >
            <Sparkles size={18} color={t.accent.neon} />
            <Text
              style={{
                color: t.text.primary,
                fontWeight: "700",
                fontSize: 14,
              }}
            >
              {label}
            </Text>
          </View>
        </AnimatedBrandGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}
