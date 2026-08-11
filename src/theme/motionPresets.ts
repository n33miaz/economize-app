import { useCallback, useMemo } from "react";
import {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { EntryExitAnimationFunction } from "react-native-reanimated";

import { motion } from "./ds";

// Duas formas da mesma curva `soft` do ds: a factory alimenta withTiming e a
// função-worklet alimenta os builders de entrada (que exigem EasingFunction)
export const softEasing = Easing.bezier(...motion.easing.soft);
const softEasingFn = Easing.bezierFn(...motion.easing.soft);

// Stagger de lista: incremento curto com teto no 6º item — a entrada orienta
// o olho no que está visível sem atrasar o resto de listas longas
const STAGGER_STEP_MS = 50;
const STAGGER_MAX_INDEX = 5;

// Escala única de feedback de toque (§2.6: toque responde em duration.instant)
export const PRESS_SCALE = 0.97;

// Spring de sheet com damping alto: sobe firme e assenta sem quicar
export const sheetSpring = {
  damping: 26,
  stiffness: 240,
  mass: 1,
} as const;

/**
 * Presets de entrada por categoria de elemento. Todos respeitam a preferência
 * de movimento reduzido do sistema: nesse caso devolvem `undefined` e o
 * elemento simplesmente aparece, sem deslocamento nem fade.
 */
export function useMotionPresets() {
  const reducedMotion = useReducedMotion();

  // Entrada de card: fade + deslocamento curto para cima (nada de saltos)
  const cardEntering = useMemo(() => {
    if (reducedMotion) return undefined;
    return FadeInDown.duration(motion.duration.base)
      .easing(softEasingFn)
      .withInitialValues({ transform: [{ translateY: 12 }] });
  }, [reducedMotion]);

  // Item de lista: o mesmo movimento do card com atraso incremental sutil
  const listItemEntering = useCallback(
    (index: number) => {
      if (reducedMotion) return undefined;
      return FadeInDown.duration(motion.duration.base)
        .easing(softEasingFn)
        .delay(Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS)
        .withInitialValues({ transform: [{ translateY: 12 }] });
    },
    [reducedMotion],
  );

  // FAB: escala + fade — marca presença sem roubar o foco do conteúdo
  const fabEntering = useMemo(() => {
    if (reducedMotion) return undefined;
    const enter: EntryExitAnimationFunction = () => {
      "worklet";
      return {
        initialValues: { opacity: 0, transform: [{ scale: 0.85 }] },
        animations: {
          opacity: withTiming(1, {
            duration: motion.duration.base,
            easing: softEasing,
          }),
          transform: [
            {
              scale: withTiming(1, {
                duration: motion.duration.base,
                easing: softEasing,
              }),
            },
          ],
        },
      };
    };
    return enter;
  }, [reducedMotion]);

  return { reducedMotion, cardEntering, listItemEntering, fabEntering };
}

/**
 * Feedback de toque padronizado: escala 0.97 em duration.instant. O estilo
 * vai no Animated.View externo e os handlers no Touchable interno.
 */
export function usePressScale() {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const onPressIn = useCallback(() => {
    if (reducedMotion) return;
    scale.value = withTiming(PRESS_SCALE, {
      duration: motion.duration.instant,
      easing: softEasing,
    });
  }, [reducedMotion, scale]);

  const onPressOut = useCallback(() => {
    scale.value = withTiming(1, {
      duration: motion.duration.instant,
      easing: softEasing,
    });
  }, [scale]);

  return { pressStyle, onPressIn, onPressOut };
}
