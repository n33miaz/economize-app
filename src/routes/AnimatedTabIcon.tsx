import React from "react";
import type { LucideIcon } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { motion } from "../theme/ds";

// Escala máxima do pop de seleção — sutil o bastante para não empurrar o
// rótulo nem estourar a altura da barra
const TAB_ICON_POP_SCALE = 0.08;

/**
 * O estado ativo "enche" o ícone: cross-fade entre a camada de contorno e uma
 * camada accent com o preenchimento do próprio lucide (prop fill), mais um
 * leve pop de escala para dar peso à seleção.
 *
 * Mora em arquivo próprio porque a barra inferior e o trilho lateral do
 * desktop mostram o MESMO trio de destinos: duas cópias do efeito virariam
 * dois dialetos da mesma seleção.
 */
export default function AnimatedTabIcon({
  Icon,
  focused,
  size,
}: {
  Icon: LucideIcon;
  focused: boolean;
  size: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(focused ? 1 : 0);

  React.useEffect(() => {
    // Com movimento reduzido o estado final entra seco, sem fade nem pop
    if (reducedMotion) {
      progress.value = focused ? 1 : 0;
      return;
    }
    progress.value = withTiming(focused ? 1 : 0, {
      duration: motion.duration.base,
    });
  }, [focused, progress, reducedMotion]);

  const activeStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    position: "absolute",
  }));

  const inactiveStyle = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
  }));

  // O pop escala o container inteiro: as duas camadas crescem juntas e o
  // cross-fade não desalinha no meio da transição
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * TAB_ICON_POP_SCALE }],
  }));

  return (
    <Animated.View className="justify-center items-center" style={popStyle}>
      <Animated.View style={inactiveStyle}>
        <Icon size={size} color={t.text.tertiary} />
      </Animated.View>
      <Animated.View style={activeStyle}>
        <Icon size={size} color={t.accent.neon} fill={t.accent.neon} />
      </Animated.View>
    </Animated.View>
  );
}
