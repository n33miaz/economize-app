import React, { useCallback, useEffect, useRef } from "react";
import { View, ViewStyle, StyleProp } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";

import { motion } from "../theme/ds";
import { softEasing } from "../theme/motionPresets";
import { CONTENT_MAX_WIDTH, useBreakpoint } from "../hooks/useBreakpoint";

interface PageContainerProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  /**
   * Refaz um fade curto quando a tela volta ao foco — usado nas abas
   * superiores (Carteira/Extrato, Moedas/Índices), que ficam montadas e
   * por isso não repetem a animação de entrada sozinhas.
   */
  refadeOnFocus?: boolean;
}

export default function PageContainer({
  children,
  style,
  refadeOnFocus = false,
}: PageContainerProps) {
  // Todas as telas passam por aqui: é o ponto certo para segurar a largura no
  // desktop de uma vez, em vez de repetir maxWidth em 19 arquivos
  const { isDesktop } = useBreakpoint();
  // Com movimento reduzido a tela nasce pronta: sem fade nem deslocamento
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(reducedMotion ? 1 : 0);
  const translateY = useSharedValue(reducedMotion ? 0 : 12);
  const hasFocusedOnce = useRef(false);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withTiming(1, {
      duration: motion.duration.base,
      easing: softEasing,
    });
    translateY.value = withTiming(0, {
      duration: motion.duration.base,
      easing: softEasing,
    });
    // roda uma única vez, na montagem
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!refadeOnFocus) return;
      // o primeiro foco coincide com a montagem, que já animou acima
      if (!hasFocusedOnce.current) {
        hasFocusedOnce.current = true;
        return;
      }
      if (reducedMotion) return;
      opacity.value = 0.4;
      opacity.value = withTiming(1, {
        duration: motion.duration.fast,
        easing: softEasing,
      });
    }, [refadeOnFocus, reducedMotion, opacity]),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    // Corpo da tela é sempre o base do tema; cards em surface criam o contraste
    <View className="flex-1 bg-background overflow-hidden">
      <Animated.View
        className="flex-1 bg-background"
        style={[
          // No desktop o miolo vira uma coluna centralizada com teto de
          // largura; no celular o valor é nulo e nada muda
          isDesktop && {
            width: "100%",
            maxWidth: CONTENT_MAX_WIDTH,
            alignSelf: "center",
          },
          style,
          animatedStyle,
        ]}
      >
        {children}
      </Animated.View>
    </View>
  );
}
