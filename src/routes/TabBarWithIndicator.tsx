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
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { motion } from "../theme/ds";
import { selectionEasing } from "../theme/motionPresets";

// Mesma altura do indicador das top tabs internas (Moedas/Índices): os dois
// traços accent viram uma linguagem só
const INDICATOR_HEIGHT = 3;
// Quanto o traço estica no meio do trajeto (10%) antes de voltar ao tamanho:
// é o "estica-e-volta" de um deslize com peso, sem mola nem quique
const INDICATOR_STRETCH = 0.1;

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
  const stretch = useSharedValue(1);

  React.useEffect(() => {
    if (reducedMotion) {
      indexSv.value = activeIndex;
      stretch.value = 1;
      return;
    }
    // Montagem (o traço já nasce em cima da aba ativa): sem trajeto não há o
    // que esticar
    if (indexSv.value === activeIndex) return;
    indexSv.value = withTiming(activeIndex, {
      duration: motion.duration.base,
      easing: selectionEasing,
    });
    // Estica na ida e volta ao tamanho na chegada, cada metade com a mesma
    // curva do deslize — withSequence de dois withTiming, nunca spring: o
    // traço não pode quicar sobre a aba
    const half = motion.duration.base / 2;
    stretch.value = withSequence(
      withTiming(1 + INDICATOR_STRETCH, { duration: half, easing: selectionEasing }),
      withTiming(1, { duration: half, easing: selectionEasing }),
    );
  }, [activeIndex, reducedMotion, indexSv, stretch]);

  // Escala depois do deslocamento: o traço estica em volta do próprio centro,
  // já na posição do trajeto
  const slideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sidePad + indexSv.value * itemWidth },
      { scaleX: stretch.value },
    ],
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
