import React, { useCallback, useEffect, useState } from "react";
import {
  DimensionValue,
  LayoutChangeEvent,
  View,
  type ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import BrandGradient from "./BrandGradient";
import Card from "./Card";
import { radius, spacing } from "../theme/ds";
import { useTheme } from "../theme/ThemeProvider";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number | DimensionValue;
  borderRadius?: number;
  className?: string;
}

// Spec do protótipo de identidade: varredura de 1,2 s, linear, em loop. É o
// ÚNICO relógio deste arquivo — os compostos abaixo e os pontos do assistente
// batem no mesmo ritmo, para nada na tela pulsar em contratempo
const SWEEP_DURATION_MS = 1200;

// Compõe o alfa a partir do token hexa do accent. Os extremos do gradiente
// precisam ser "o accent com alfa 0": a keyword "transparent" interpola a
// partir de rgba(0,0,0,0) e escurecia as bordas da faixa no iOS.
function accentWithAlpha(hexToken: string, alpha: number) {
  const r = parseInt(hexToken.slice(1, 3), 16);
  const g = parseInt(hexToken.slice(3, 5), 16);
  const b = parseInt(hexToken.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function Skeleton({
  width = "100%",
  height = 20,
  // Piso de raio dos contêineres visíveis (12): o skeleton imita o conteúdo
  borderRadius = radius.lg,
  className = "",
}: SkeletonProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  // O RN não anima translateX percentual: a largura real vem do onLayout e a
  // faixa varre de -largura (fora, à esquerda) até +largura (fora, à direita)
  const [trackWidth, setTrackWidth] = useState(0);

  const progress = useSharedValue(0);
  const pulse = useSharedValue(0.3);

  useEffect(() => {
    if (reducedMotion) {
      // Sem varredura espacial: o pulso de opacidade ainda diz "carregando"
      pulse.value = withRepeat(
        withSequence(
          withTiming(0.7, { duration: 800 }),
          withTiming(0.3, { duration: 800 }),
        ),
        -1,
        true,
      );
    } else {
      progress.value = withRepeat(
        withTiming(1, { duration: SWEEP_DURATION_MS, easing: Easing.linear }),
        -1,
        false,
      );
    }
    return () => {
      cancelAnimation(progress);
      cancelAnimation(pulse);
    };
  }, [reducedMotion, progress, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulse.value,
  }));

  const sweepStyle = useAnimatedStyle(
    () => ({
      transform: [
        { translateX: -trackWidth + progress.value * trackWidth * 2 },
      ],
    }),
    [trackWidth],
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const edge = accentWithAlpha(t.accent.neon, 0);

  return (
    <Animated.View
      // O ActivityIndicator anunciava progresso a leitores de tela; o skeleton
      // precisa repor esse anúncio
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando"
      className={`bg-border ${className}`}
      style={[
        { width, height, borderRadius, overflow: "hidden" },
        reducedMotion ? pulseStyle : null,
      ]}
      onLayout={handleLayout}
    >
      {!reducedMotion && trackWidth > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              width: trackWidth,
              // No estilo: `props.pointerEvents` está depreciado
              pointerEvents: "none",
            },
            sweepStyle,
          ]}
        >
          <BrandGradient
            colors={[edge, t.accent.neonMuted, edge]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={{ flex: 1 }}
          />
        </Animated.View>
      )}
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Compostos: a forma do conteúdo, e não um bloco de altura única
// ---------------------------------------------------------------------------

/**
 * Por que compostos, e por que NESTE arquivo.
 *
 * <p>Treze telas desenhavam o primeiro carregamento como um retângulo só
 * (`<Skeleton height={120} />`), com raio literal e sem parentesco com o card
 * que viria depois: o conteúdo chegava e a tela "trocava de forma", em vez de
 * se preencher. O olho lê isso como duas telas, não como uma carregando.
 *
 * <p>Os compostos copiam a geometria que Home, Carteira e Investimentos já
 * desenhavam à mão (título 120×14, valor 70%×34, linhas de texto) — uma
 * edição aqui ajusta todas as telas. E ficam no mesmo arquivo do `Skeleton`
 * para compartilhar o relógio: o teste de movimento exige uma única constante
 * de período, e é isso que impede um composto de nascer com ritmo próprio.
 */

interface SkeletonCardProps {
  /** Linhas de texto abaixo do valor; alternam 100% e 60% de largura. */
  lines?: number;
  /** Linha de título (120×14) e valor (70%×34): a forma do card numérico. */
  header?: boolean;
  style?: ViewStyle;
}

export function SkeletonCard({
  lines = 2,
  header = true,
  style,
}: SkeletonCardProps) {
  return (
    <Card style={style}>
      {header ? (
        <>
          <Skeleton width={120} height={14} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="70%" height={34} />
        </>
      ) : null}
      {Array.from({ length: lines }, (_, index) => (
        <View
          key={index}
          style={{
            // A primeira linha respira mais depois do valor; entre linhas o
            // passo é o de um parágrafo
            marginTop:
              index === 0 ? (header ? spacing[4] : 0) : spacing[2],
          }}
        >
          <Skeleton width={index % 2 === 0 ? "100%" : "60%"} height={12} />
        </View>
      ))}
    </Card>
  );
}

// Disco da linha de lista (ícone de categoria, bandeira de moeda, avatar)
const ROW_DISC_SIZE = 40;

/** Linha de lista: disco à esquerda, título e legenda à direita. */
export function SkeletonRow({ style }: { style?: ViewStyle }) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", gap: spacing[3] },
        style,
      ]}
    >
      <Skeleton
        width={ROW_DISC_SIZE}
        height={ROW_DISC_SIZE}
        borderRadius={radius.full}
      />
      <View style={{ flex: 1 }}>
        <Skeleton width="60%" height={14} />
        <View style={{ height: spacing[2] }} />
        <Skeleton width="30%" height={12} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Pontos de digitação — o assistente "pensando"
// ---------------------------------------------------------------------------

const TYPING_DOT_SIZE = 8;
// Atraso entre um ponto e o seguinte: é o que transforma três pulsos iguais
// numa onda que corre da esquerda para a direita
const TYPING_STAGGER_MS = 160;
const TYPING_DOTS = [0, 1, 2] as const;

function TypingDot({ index }: { index: number }) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withDelay(
      index * TYPING_STAGGER_MS,
      withRepeat(
        withTiming(1, { duration: SWEEP_DURATION_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => cancelAnimation(progress);
  }, [reducedMotion, index, progress]);

  // Onda triangular: acende na primeira metade da volta, apaga na segunda
  const waveStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.3, 1, 0.3]),
  }));

  return (
    <Animated.View
      style={[
        {
          width: TYPING_DOT_SIZE,
          height: TYPING_DOT_SIZE,
          borderRadius: radius.full,
          backgroundColor: t.accent.neon,
        },
        // Com movimento reduzido os três pontos param em opacidades crescentes:
        // uma reticência desenhada, que ainda diz "está vindo" sem se mexer
        reducedMotion ? { opacity: 0.3 + index * 0.3 } : waveStyle,
      ]}
    />
  );
}

/**
 * Três pontos de 8 px que acendem em onda, no mesmo relógio da varredura do
 * skeleton. Substitui o `ActivityIndicator` na bolha "pensando" do assistente:
 * o spinner é a linguagem do sistema, os pontos são a da conversa.
 */
export function TypingDots({ label = "Pensando" }: { label?: string }) {
  return (
    <View
      // Um anúncio só para os três pontos: cada um deles separado seria
      // "carregando, carregando, carregando" no leitor de tela
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: spacing[1] }}
    >
      {TYPING_DOTS.map((index) => (
        <TypingDot key={index} index={index} />
      ))}
    </View>
  );
}
