import React from "react";
import { View, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";

interface Props {
  children: React.ReactNode;
  /**
   * `flat` para o card dentro de outro card: sombra sobre sombra não empilha,
   * só borra. `raised` é o padrão da tela.
   */
  variant?: "raised" | "flat";
  /** Respiro interno. `tight` para grade de dois por dois. */
  padding?: "normal" | "tight" | "none";
  /** Entrada animada. Desligue em lista longa: o stagger é da lista. */
  animate?: boolean;
  style?: ViewStyle | ViewStyle[];
}

/**
 * O bloco de conteúdo da casa — EC-221/EC-222.
 *
 * <p><b>Por que uma primitiva.</b> A mesma combinação
 * (`bg-surface` + `border` + `rounded-2xl` + `p-4`) estava escrita à mão em
 * dezenas de lugares. Cada cópia é uma chance de divergir — e divergiam: havia
 * `p-4`, `p-5` e `p-6` em cards irmãos na mesma tela, e raios de 16 e 24
 * lado a lado. O olho não lê "descuido", lê "isto não é a mesma coisa".
 *
 * <p>Com uma primitiva, melhorar a elevação, o raio ou o ritmo de respiro é
 * uma edição, não uma caçada.
 *
 * <p><b>O que ela NÃO faz:</b> não decide cor de conteúdo, não impõe título,
 * não centraliza nada. Card é o retângulo; o que vai dentro é da tela.
 */
export default function Card({
  children,
  variant = "raised",
  padding = "normal",
  animate = false,
  style,
}: Props) {
  const t = useTheme();
  const { cardEntering } = useMotionPresets();

  const respiro =
    padding === "none" ? 0 : padding === "tight" ? spacing[4] : spacing[5];

  const base: ViewStyle = {
    backgroundColor:
      variant === "flat" ? t.background.elevated : t.background.surface,
    borderWidth: variant === "flat" ? 0 : 1,
    borderColor: t.border.subtle,
    borderRadius: radius["2xl"],
    padding: respiro,
  };

  if (!animate) {
    return <View style={[base, style as ViewStyle]}>{children}</View>;
  }
  return (
    <Animated.View entering={cardEntering} style={[base, style as ViewStyle]}>
      {children}
    </Animated.View>
  );
}
