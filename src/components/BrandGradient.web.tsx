import React, { forwardRef } from "react";
import { View } from "react-native";

import type { BrandGradientProps } from "./BrandGradient";

// O react-native-web não tem `backgroundImage` no StyleSheet (conferido no
// dist da 0.19): não existe gradiente CSS acessível pela API de estilo do RN.
// A degradação é assumida — a primeira cor do array é sempre o accent da marca,
// então o anel do FAB continua dourado, só que chapado. Geometria, sombra e
// rotação seguem idênticas, porque vêm do `style` de fora.
const BrandGradient = forwardRef<View, BrandGradientProps>(function BrandGradient(
  { colors, style, children },
  ref,
) {
  return (
    <View ref={ref} style={[{ backgroundColor: colors[0] }, style]}>
      {children}
    </View>
  );
});

export default BrandGradient;
