import React, { forwardRef } from "react";
import type { StyleProp, View, ViewStyle } from "react-native";
import LinearGradient from "react-native-linear-gradient";

export interface BrandGradientProps {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

// Ponto único de gradiente do app. `react-native-linear-gradient` não tem
// implementação web, e o react-native-web também não expõe `backgroundImage`
// no StyleSheet — por isso existe o par BrandGradient.web.tsx.
// forwardRef porque o AssistantFAB embrulha isto em createAnimatedComponent.
const BrandGradient = forwardRef<View, BrandGradientProps>(function BrandGradient(
  { colors, start, end, style, children },
  ref,
) {
  return (
    <LinearGradient
      // A lib exige array mutável; os temas são `as const`
      colors={[...colors]}
      start={start}
      end={end}
      style={style}
      ref={ref as never}
    >
      {children}
    </LinearGradient>
  );
});

export default BrandGradient;
