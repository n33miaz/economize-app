import React, { useCallback, useEffect, useState } from "react";
import { DimensionValue, LayoutChangeEvent } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import BrandGradient from "./BrandGradient";
import { radius } from "../theme/ds";
import { useTheme } from "../theme/ThemeProvider";

interface SkeletonProps {
  width?: DimensionValue;
  height?: number | DimensionValue;
  borderRadius?: number;
  className?: string;
}

// Spec do protótipo de identidade: varredura de 1.2s, linear, em loop
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
