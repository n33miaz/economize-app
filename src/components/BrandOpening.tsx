import React, { useEffect } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import PotIcon, { PotTone } from "./PotIcon";

/**
 * Abertura do app (EC-148).
 *
 * O pote aparece em destaque enquanto as métricas carregam; quando terminam, a
 * moeda cai, o pote reage ao peso e sobe até o lugar dele no cabeçalho — e só
 * então o conteúdo entra.
 *
 * REGRA DURA: a animação ACOMPANHA o carregamento, ela não é o motivo da
 * espera. Quem manda no fim da sequência é `ready`; se os dados chegam antes,
 * a animação já está no fim e a subida acontece na hora. Ela nunca segura a
 * tela além do próprio movimento.
 *
 * A moeda é uma View redonda, e não um <Circle> do SVG: animar prop de SVG
 * exigiria componente animado próprio para ganhar exatamente o mesmo efeito.
 */

const QUEDA_MS = 520;
const SUBIDA_MS = 620;
/** Deslocamento inicial do pote: ele nasce no meio da tela e sobe até 0. */
const DESLOCAMENTO = 128;

interface BrandOpeningProps {
  /** Enquanto falso, o pote fica pulsando: os dados ainda estão vindo. */
  ready: boolean;
  level?: number;
  tone?: PotTone;
  size?: number;
  /** Chamado quando o pote chega ao lugar — a tela revela o resto. */
  onSettled?: () => void;
}

export default function BrandOpening({
  ready,
  level = 0.6,
  tone = "brand",
  size = 96,
  onSettled,
}: BrandOpeningProps) {
  const t = useTheme();
  const reduzido = useReducedMotion();

  const subida = useSharedValue(reduzido ? 0 : DESLOCAMENTO);
  const respiro = useSharedValue(1);
  const esmaga = useSharedValue(1);
  const moedaY = useSharedValue(-34);
  const moedaOpacidade = useSharedValue(0);

  // Pulso enquanto carrega: sinal de vida, não barra de progresso falsa
  useEffect(() => {
    if (reduzido || ready) return;
    respiro.value = withSequence(
      withTiming(1.05, { duration: 620, easing: Easing.inOut(Easing.quad) }),
      withTiming(1, { duration: 620, easing: Easing.inOut(Easing.quad) }),
    );
  }, [ready, reduzido, respiro]);

  useEffect(() => {
    if (!ready) return;

    if (reduzido) {
      // Sem movimento: o conteúdo aparece direto, sem prender ninguém
      onSettled?.();
      return;
    }

    respiro.value = withTiming(1, { duration: 160 });

    // 1) a moeda cai e some ao entrar no pote
    moedaOpacidade.value = withSequence(
      withTiming(1, { duration: 120 }),
      withDelay(QUEDA_MS - 240, withTiming(0, { duration: 120 })),
    );
    moedaY.value = withTiming(6, {
      duration: QUEDA_MS,
      easing: Easing.bezier(0.5, 0, 0.7, 1),
    });

    // 2) o pote cede ao peso — é o efeito que dá satisfação ao gesto
    esmaga.value = withDelay(
      QUEDA_MS - 60,
      withSequence(
        withTiming(0.9, { duration: 130, easing: Easing.out(Easing.quad) }),
        withTiming(1, {
          duration: 300,
          easing: Easing.elastic(1.6),
        }),
      ),
    );

    // 3) sobe até a posição do cabeçalho e avisa a tela
    subida.value = withDelay(
      QUEDA_MS + 220,
      withTiming(
        0,
        { duration: SUBIDA_MS, easing: Easing.bezier(0.4, 0, 0.2, 1) },
        (fim) => {
          if (fim && onSettled) runOnJS(onSettled)();
        },
      ),
    );
  }, [ready, reduzido, subida, respiro, esmaga, moedaY, moedaOpacidade, onSettled]);

  const potStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: subida.value },
      { scale: respiro.value },
      { scaleY: esmaga.value },
      // Compensa o esmagamento na horizontal: massa se conserva
      { scaleX: 2 - esmaga.value },
    ],
  }));

  const moedaStyle = useAnimatedStyle(() => ({
    opacity: moedaOpacidade.value,
    transform: [{ translateY: subida.value + moedaY.value }],
  }));

  const moedaTamanho = Math.round(size * 0.15);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View
        style={[
          {
            // `none` inline é seguro (só `box-none` exige o compilador — ver
            // utils/pointerEvents.ts); como prop, a web avisa depreciação
            pointerEvents: "none",
            position: "absolute",
            width: moedaTamanho,
            height: moedaTamanho,
            borderRadius: moedaTamanho / 2,
            backgroundColor:
              tone === "danger"
                ? t.semantic.danger
                : tone === "success"
                  ? t.semantic.success
                  : t.accent.neon,
          },
          moedaStyle,
        ]}
      />
      <Animated.View style={potStyle}>
        <PotIcon size={size} level={level} tone={tone} />
      </Animated.View>
    </View>
  );
}
