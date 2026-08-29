import React, { useCallback, useEffect, useState } from "react";
import {
  NativeSyntheticEvent,
  TextInput,
  TextInputFocusEventData,
  TextInputProps,
  TouchableOpacity,
} from "react-native";
import Eye from "lucide-react-native/dist/esm/icons/eye";
import EyeOff from "lucide-react-native/dist/esm/icons/eye-off";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";

// `placeholder` fica fora da API: na variante inset o rótulo descansa no
// centro do campo, exatamente onde o placeholder apareceria
interface FloatingLabelInputProps extends Omit<TextInputProps, "placeholder"> {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
}

// Curva e duração portadas do float-label do lumilivre-web (ease-out do CSS)
const FLOAT_DURATION_MS = 200;
const floatEasing = Easing.bezier(0, 0, 0.58, 1);

// Geometria do flutuar: campo de 56px (h-14) e rótulo com linha de 24px
// (text-base) assentado em top-4, ou seja, centrado. Com origem 'left center'
// o scale 0.75 encolhe a linha para 18px sem sair do eixo X, e o -11 leva o
// centro de 28 para 17 — o rótulo pequeno para a 8px do topo. Só transform e
// cor animam: top/fontSize disparariam relayout a cada frame.
const LABEL_FLOAT_TRANSLATE_Y = -11;
const LABEL_FLOAT_SCALE = 0.75;

export default function FloatingLabelInput({
  label,
  value,
  onChangeText,
  error,
  secureTextEntry,
  onFocus,
  onBlur,
  ...rest
}: FloatingLabelInputProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const hasContent = value.length > 0;
  const isFloated = isFocused || hasContent;
  const hasError = Boolean(error);

  const floatProgress = useSharedValue(isFloated ? 1 : 0);
  const focusProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    const config = {
      duration: reducedMotion ? 0 : FLOAT_DURATION_MS,
      easing: floatEasing,
    };
    floatProgress.value = withTiming(isFloated ? 1 : 0, config);
    focusProgress.value = withTiming(isFocused ? 1 : 0, config);
  }, [isFloated, isFocused, reducedMotion, floatProgress, focusProgress]);

  // Erro pinta borda e rótulo direto, sem passar pela interpolação de foco:
  // feedback imediato, e a posição do rótulo segue só o par foco/conteúdo
  const fieldAnimatedStyle = useAnimatedStyle(() => ({
    borderColor: hasError
      ? t.semantic.danger
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [t.border.default, t.accent.neon],
        ),
  }));

  const labelAnimatedStyle = useAnimatedStyle(() => ({
    color: hasError
      ? t.semantic.danger
      : interpolateColor(
          focusProgress.value,
          [0, 1],
          [t.text.tertiary, t.accent.neon],
        ),
    transform: [
      {
        translateY: interpolate(
          floatProgress.value,
          [0, 1],
          [0, LABEL_FLOAT_TRANSLATE_Y],
        ),
      },
      {
        scale: interpolate(floatProgress.value, [0, 1], [1, LABEL_FLOAT_SCALE]),
      },
    ],
  }));

  const handleFocus = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    [onFocus],
  );

  const handleBlur = useCallback(
    (e: NativeSyntheticEvent<TextInputFocusEventData>) => {
      setIsFocused(false);
      onBlur?.(e);
    },
    [onBlur],
  );

  return (
    <Animated.View
      className="h-14 flex-row bg-elevated border rounded-xl"
      style={fieldAnimatedStyle}
    >
      {/* O input preenche o campo inteiro, então tocar em qualquer ponto já
          foca; o pt-6 reserva o topo para o rótulo flutuado */}
      <TextInput
        className={`flex-1 pl-4 pt-6 pb-2 text-base text-textPrimary ${
          secureTextEntry ? "pr-12" : "pr-4"
        }`}
        value={value}
        onChangeText={onChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        secureTextEntry={secureTextEntry && !showPassword}
        {...rest}
        accessibilityLabel={label}
      />

      <Animated.Text
        // transformOrigin inline porque o NativeWind não converte a classe
        // `origin-*`; sem a origem à esquerda o scale afundaria o rótulo
        // rumo ao centro
        className="absolute left-4 top-4 text-base pointer-events-none"
        numberOfLines={1}
        style={[{ transformOrigin: "left center" }, labelAnimatedStyle]}
      >
        {label}
      </Animated.Text>

      {secureTextEntry && hasContent && (
        <TouchableOpacity
          className="absolute right-0 top-0 bottom-0 justify-center px-4"
          onPress={() => setShowPassword((prev) => !prev)}
          accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
          accessibilityRole="button"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          {showPassword ? (
            <EyeOff size={20} color={t.text.secondary} />
          ) : (
            <Eye size={20} color={t.text.secondary} />
          )}
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}
