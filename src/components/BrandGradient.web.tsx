import React, { forwardRef } from "react";
import { View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import type { BrandGradientProps } from "./BrandGradient";

// Na web o gradiente vem do `expo-linear-gradient`, que tem implementação para
// navegador — o `react-native-linear-gradient` não tem, e importar ele aqui
// derrubava o bundle inteiro antes do React montar.
const BrandGradient = forwardRef<View, BrandGradientProps>(function BrandGradient(
  { colors, start, end, style, children },
  ref,
) {
  return (
    <LinearGradient
      // a lib exige tupla mutável; os temas são `as const`
      colors={[...colors] as [string, string, ...string[]]}
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
