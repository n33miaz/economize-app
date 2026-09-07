import React from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import type { TabGlyph } from "../components/icons/TabGlyphs";
import { useTheme } from "../theme/ThemeProvider";
import { motion } from "../theme/ds";
import { selectionEasing } from "../theme/motionPresets";

// Pico do micro-pop de seleção (1 → 1.06 → 1): sutil o bastante para não
// empurrar o rótulo nem estourar a altura da barra
const TAB_ICON_POP_SCALE = 1.06;

/**
 * O estado ativo ENCHE o ícone como um líquido: a silhueta cheia do glifo sobe
 * da base por cima do contorno, com um micro-pop de escala e o contorno
 * esquentando para a cor do accent enquanto o nível sobe.
 *
 * São duas janelas complementares com `overflow: hidden`, uma para o contorno
 * (do topo até o nível) e outra para o cheio (do nível até a base), movidas só
 * por `translateY` — o conteúdo de cada uma é contra-deslocado para o glifo
 * ficar parado enquanto a janela passa. Complementares, e não cheio POR CIMA
 * do contorno, porque os recortes da variante cheia (o bolso, a porta) são
 * vazados: se o contorno continuasse embaixo, o detalhe dele apareceria
 * dentro do recorte. Transform em vez de altura animada porque altura é
 * layout — passa pelo Yoga a cada quadro — e transform não.
 *
 * Mora em arquivo próprio porque a barra inferior e o trilho lateral do
 * desktop mostram o MESMO trio de destinos: duas cópias do efeito virariam
 * dois dialetos da mesma seleção.
 */
export default function AnimatedTabIcon({
  Glyph,
  focused,
  size,
}: {
  Glyph: TabGlyph;
  focused: boolean;
  size: number;
}) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  // 0 = vazio (só contorno), 1 = cheio. Nasce no estado final para a aba
  // inicial não encher na montagem
  const progress = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);
  // O pop marca uma ESCOLHA, não uma aparição: na montagem a aba ativa já
  // nasce cheia e parada
  const hasMounted = React.useRef(false);

  React.useEffect(() => {
    const isMount = !hasMounted.current;
    hasMounted.current = true;
    // Com movimento reduzido o estado final entra seco, sem líquido nem pop
    if (reducedMotion) {
      progress.value = focused ? 1 : 0;
      pop.value = 1;
      return;
    }
    progress.value = withTiming(focused ? 1 : 0, {
      duration: motion.duration.base,
      easing: selectionEasing,
    });
    if (focused && !isMount) {
      const half = motion.duration.base / 2;
      pop.value = withSequence(
        withTiming(TAB_ICON_POP_SCALE, { duration: half, easing: selectionEasing }),
        withTiming(1, { duration: half, easing: selectionEasing }),
      );
    }
  }, [focused, pop, progress, reducedMotion]);

  // Janelas e conteúdos só fecham sobre `size`, fixo por instância: nenhum
  // worklet é recriado a cada render
  const outlineWindowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -progress.value * size }],
  }));
  const outlineContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: progress.value * size }],
  }));
  const fillWindowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * size }],
  }));
  const fillContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -(1 - progress.value) * size }],
  }));
  // O contorno esquenta junto com o nível: cross-fade entre a camada fria
  // (terciário) e a camada accent, para vaso e líquido serem a mesma matéria
  // quando o líquido chega
  const warmStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));
  // O pop escala a caixa inteira: janelas e glifos crescem juntos e nada
  // desalinha no meio da transição
  const popStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }],
  }));

  return (
    <Animated.View
      style={[
        // `pointerEvents` no estilo (a prop está depreciada): as camadas
        // absolutas não podem engolir o toque, que é do botão da aba
        { width: size, height: size, overflow: "hidden", pointerEvents: "none" },
        popStyle,
      ]}
    >
      <Animated.View style={[styles.window, outlineWindowStyle]}>
        <Animated.View style={[styles.content, outlineContentStyle]}>
          <Glyph size={size} color={t.text.tertiary} />
          <Animated.View style={[styles.content, warmStyle]}>
            <Glyph size={size} color={t.accent.neon} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      <Animated.View style={[styles.window, fillWindowStyle]}>
        <Animated.View style={[styles.content, fillContentStyle]}>
          <Glyph size={size} color={t.accent.neon} filled />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Janela recorta o que passa por ela; conteúdo só posiciona, sem recortar
  window: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  content: StyleSheet.absoluteFillObject,
});
