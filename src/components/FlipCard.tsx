import React, { useEffect, useState } from "react";
import { View, ViewStyle } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useReducedMotion,
  withTiming,
} from "react-native-reanimated";

import { softEasing } from "../theme/motionPresets";

/**
 * Um card com verso — EC-225.
 *
 * <p><b>Por que girar, e não abrir uma folha.</b> A pergunta "de onde veio
 * este número?" é sobre <i>aquele</i> número. Uma folha sobe por cima e tira
 * o número da tela justamente quando ele é o assunto; o verso mantém o card no
 * mesmo lugar, do mesmo tamanho, e a resposta chega onde a dúvida nasceu.
 *
 * <p><b>Meia volta, não uma volta inteira.</b> O giro vai de 0 a 180 graus: a
 * frente some na metade do caminho e o verso já entra virado para o leitor.
 * Girar 360 seria mais chamativo e diria a mesma coisa duas vezes.
 *
 * <p><b>Sem movimento, sem giro.</b> Com "reduzir movimento" ligado, a troca é
 * seca — a informação é a mesma, e ela nunca depende da animação para chegar.
 *
 * <p><b>A altura é a do maior lado.</b> Os dois lados ficam montados e o
 * contêiner cresce até caber o mais alto; sem isso o card encolheria no meio
 * do giro e empurraria a tela inteira.
 */

const GIRO_MS = 420;

interface Props {
  front: React.ReactNode;
  back: React.ReactNode;
  /** Controlado por quem chama: é ele que decide o que abre o verso. */
  flipped: boolean;
  style?: ViewStyle;
}

export default function FlipCard({ front, back, flipped, style }: Props) {
  const reduzido = useReducedMotion();
  // Sem Reanimated no caminho quando o sistema pede menos movimento: o valor
  // salta, e o `interpolate` abaixo entrega 0 ou 180 direto
  const progresso = useDerivedValue(
    () =>
      reduzido
        ? (flipped ? 1 : 0)
        : withTiming(flipped ? 1 : 0, { duration: GIRO_MS, easing: softEasing }),
    [flipped, reduzido],
  );

  const frenteStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(progresso.value, [0, 1], [0, 180])}deg` },
    ],
    // A troca acontece na metade do caminho: antes disso a frente ainda é o
    // que o olho vê, depois ela estaria espelhada
    opacity: progresso.value < 0.5 ? 1 : 0,
  }));

  const versoStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 800 },
      { rotateY: `${interpolate(progresso.value, [0, 1], [180, 360])}deg` },
    ],
    opacity: progresso.value < 0.5 ? 0 : 1,
  }));

  return (
    <View style={style}>
      {/* A frente ocupa o fluxo e define a altura; o verso é sobreposto. Com
          os dois absolutos o contêiner teria altura zero */}
      <Animated.View style={frenteStyle}>{front}</Animated.View>
      <Animated.View
        style={[
          { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
          versoStyle,
        ]}
      >
        {back}
      </Animated.View>
    </View>
  );
}

/**
 * O estado do giro, com volta automática.
 *
 * <p>O verso é resposta a uma pergunta, não um modo em que a tela fica. Sem a
 * volta sozinha, o usuário toca num card, rola a tela e mais tarde encontra
 * quatro cards de costas sem lembrar por quê — e aí precisa desfazer um a um.
 */
export function useFlip(voltarEm = 6000) {
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    if (!flipped) return;
    const timer = setTimeout(() => setFlipped(false), voltarEm);
    return () => clearTimeout(timer);
  }, [flipped, voltarEm]);

  return { flipped, toggle: () => setFlipped((v) => !v), reset: () => setFlipped(false) };
}
