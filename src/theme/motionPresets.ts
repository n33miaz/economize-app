import { useCallback, useMemo } from "react";
import { Platform } from "react-native";
import {
  Easing,
  FadeIn,
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
export const softEasingFn = Easing.bezierFn(...motion.easing.soft);

const isWeb = Platform.OS === "web";

/**
 * Easing das animações de ENTRADA/SAÍDA (builders `FadeIn*`, `FadeOut*`).
 *
 * Na web o Reanimated 3.16 só traduz para CSS as easings NOMEADAS (linear,
 * ease, quad, cubic, sin, circle, exp): qualquer bezier avulsa dispara
 * "Selected easing is not currently supported on web" a cada elemento
 * animado — eram 1.674 avisos numa volta pelo app — e cai no linear de
 * qualquer jeito. Nativo continua na curva `soft` do ds.
 */
export const enteringEasing = isWeb ? Easing.ease : softEasingFn;

/**
 * Deslocamento inicial sutil (12 px em vez dos 25 do preset) — SÓ no nativo.
 *
 * Na web, `.withInitialValues()` gera um keyframe com nome próprio e, quando
 * ele termina, a rotina de limpeza do gerenciador web aplica
 * `position: absolute` no elemento (é o tratamento pensado para o "dummy" da
 * animação de saída, aplicado por engano à entrada). Resultado medido em
 * 390 px: TODOS os blocos da Home viravam absolutos meio segundo depois de
 * montar, o container encolhia para 56 px e a tela inteira se sobrepunha em
 * um único quadrante — com `TypeError: reading 'top'` a cada bloco cujo
 * snapshot não existia. Na web o preset é o FadeInDown puro.
 */
// (a forma por plataforma vive em buildEnteringPresets, abaixo)

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
 * Fábrica pura dos presets de entrada — separada do hook para ser testável
 * sem montar navegação nem Reanimated de verdade. `web` decide a forma (ver
 * `enteringEasing`/`withSubtleOffset`); `reducedMotion` devolve `undefined`
 * em tudo e o elemento simplesmente aparece, sem deslocamento nem fade.
 */
export function buildEnteringPresets(web: boolean, reducedMotion: boolean) {
  const easing = web ? Easing.ease : softEasingFn;
  const offset = <T extends { withInitialValues: (v: object) => T }>(a: T): T =>
    web ? a : a.withInitialValues({ transform: [{ translateY: 12 }] });

  // Entrada de card: fade + deslocamento curto para cima (nada de saltos)
  const cardEntering = reducedMotion
    ? undefined
    : offset(FadeInDown.duration(motion.duration.base).easing(easing));

  // Item de lista: o mesmo movimento do card com atraso incremental sutil
  const listItemEntering = (index: number) => {
    if (reducedMotion) return undefined;
    return offset(
      FadeInDown.duration(motion.duration.base)
        .easing(easing)
        .delay(Math.min(index, STAGGER_MAX_INDEX) * STAGGER_STEP_MS),
    );
  };

  // FAB: escala + fade — marca presença sem roubar o foco do conteúdo.
  // Animação de função só existe no nativo: na web o gerenciador não a
  // reconhece ("Couldn't load entering/exiting animation") e o FAB aparece
  // seco. Um fade nomeado dá a mesma presença discreta.
  let fabEntering: EntryExitAnimationFunction | ReturnType<typeof FadeIn.duration> | undefined;
  if (reducedMotion) {
    fabEntering = undefined;
  } else if (web) {
    fabEntering = FadeIn.duration(motion.duration.base).easing(Easing.ease);
  } else {
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
    fabEntering = enter;
  }

  return { cardEntering, listItemEntering, fabEntering };
}

/**
 * Presets de entrada por categoria de elemento. Todos respeitam a preferência
 * de movimento reduzido do sistema: nesse caso devolvem `undefined` e o
 * elemento simplesmente aparece, sem deslocamento nem fade.
 */
export function useMotionPresets() {
  const reducedMotion = useReducedMotion();
  const presets = useMemo(
    () => buildEnteringPresets(isWeb, reducedMotion),
    [reducedMotion],
  );
  return { reducedMotion, ...presets };
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
