import React from "react";
import { View } from "react-native";
import {
  BottomTabBar,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { motion } from "../theme/ds";
import { softEasing } from "../theme/motionPresets";

// Mesma altura do indicador das top tabs internas (Moedas/Índices): os dois
// traços accent viram uma linguagem só
const INDICATOR_HEIGHT = 3;

// Wrap da barra padrão só para sobrepor o indicador deslizante. O BottomTabBar
// original segue responsável por layout, insets e — na web — pelo <a href> com
// preventDefault que mantém as abas navegáveis sem recarregar a página.
// O indicador vive FORA do container com `overflow: hidden` da barra, por isso
// encosta na borda superior sem ser cortado pelos cantos arredondados.
export default function TabBarWithIndicator(props: BottomTabBarProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const [barWidth, setBarWidth] = React.useState(0);

  // O BottomTabBar aplica paddingHorizontal = max(inset esquerdo, direito) aos
  // itens (notch/cutout em landscape); sem descontar, o indicador nasceria fora
  // da primeira aba e derivaria nas seguintes
  const sidePad = Math.max(props.insets.left, props.insets.right);
  const tabCount = props.state.routes.length;
  const usableWidth = barWidth - sidePad * 2;
  const itemWidth = tabCount > 0 && usableWidth > 0 ? usableWidth / tabCount : 0;
  const activeIndex = props.state.index;

  // Anima o índice, não o translateX: a primeira medição do onLayout muda a
  // largura sem disparar deslize e o indicador já nasce em cima da aba ativa
  const indexSv = useSharedValue(activeIndex);

  React.useEffect(() => {
    if (reducedMotion) {
      indexSv.value = activeIndex;
      return;
    }
    indexSv.value = withTiming(activeIndex, {
      duration: motion.duration.base,
      easing: softEasing,
    });
  }, [activeIndex, reducedMotion, indexSv]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sidePad + indexSv.value * itemWidth }],
  }));

  return (
    <View
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
    >
      <BottomTabBar {...props} />
      {itemWidth > 0 && (
        <Animated.View
          className="absolute top-0 left-0 rounded-full"
          style={[
            {
              width: itemWidth,
              height: INDICATOR_HEIGHT,
              backgroundColor: t.accent.neon,
              pointerEvents: "none",
            },
            slideStyle,
          ]}
        />
      )}
    </View>
  );
}
