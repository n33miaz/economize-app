import { BottomTabBar, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React from "react";
import { View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { motion, radius } from "../theme/ds";
import { selectionEasing } from "../theme/motionPresets";
import { useTabBarStore } from "../store/tabBarStore";
import { ILHA_ALTURA, ILHA_LATERAL, ILHA_RESPIRO } from "./tabBarHeight";

// Quanto a pílula estica no meio do trajeto (10%) antes de voltar ao tamanho:
// é o "estica-e-volta" de um deslize com peso, sem mola nem quique
const INDICATOR_STRETCH = 0.1;

/** Respiro entre a pílula e a borda da ilha. */
const PILULA_MARGEM = 6;

/**
 * A ILHA FLUTUANTE.
 *
 * <p>Escolha do dono em 16/09/2026, no comparador antes-e-depois: a faixa de 84
 * px encostada no rodapé virou um bloco arredondado de 64 px, afastado das três
 * bordas, com o conteúdo passando por baixo — e que <b>se esconde quando a
 * pessoa rola para baixo</b>.
 *
 * <p><b>O que mudou na marcação da seleção.</b> Antes era um traço de 3 px no
 * topo da barra, desenhado por cima do `BottomTabBar` porque o container dele
 * tem `overflow: hidden` e cortaria o traço nos cantos. Numa ilha, traço no topo
 * não faz sentido: ele apontaria para a borda de um bloco que flutua. A marca
 * virou uma <b>pílula dourada atrás do item ativo</b>, desenhada ANTES do
 * `BottomTabBar` — ordem de irmãos é o que a põe atrás dos ícones, e é por isso
 * que o fundo da ilha mora aqui, nesta `Animated.View`, e não no `tabBarStyle`:
 * fundo opaco na barra interna cobriria a pílula.
 *
 * <p>A matemática do deslize é a mesma de antes, e continua animando o ÍNDICE e
 * não o `translateX`: a primeira medição do `onLayout` muda a largura sem
 * disparar deslize, e a marca já nasce sobre a aba ativa.
 */
export default function TabBarWithIndicator(props: BottomTabBarProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const [barWidth, setBarWidth] = React.useState(0);
  const escondida = useTabBarStore((s) => s.escondida);

  const sidePad = Math.max(props.insets.left, props.insets.right);
  const tabCount = props.state.routes.length;
  const usableWidth = barWidth - sidePad * 2;
  const itemWidth = tabCount > 0 && usableWidth > 0 ? usableWidth / tabCount : 0;
  const activeIndex = props.state.index;

  const indexSv = useSharedValue(activeIndex);
  const stretch = useSharedValue(1);

  React.useEffect(() => {
    if (reducedMotion) {
      indexSv.value = activeIndex;
      stretch.value = 1;
      return;
    }
    if (indexSv.value === activeIndex) return;
    indexSv.value = withTiming(activeIndex, {
      duration: motion.duration.base,
      easing: selectionEasing,
    });
    const half = motion.duration.base / 2;
    stretch.value = withSequence(
      withTiming(1 + INDICATOR_STRETCH, { duration: half, easing: selectionEasing }),
      withTiming(1, { duration: half, easing: selectionEasing }),
    );
  }, [activeIndex, reducedMotion, indexSv, stretch]);

  // Esconder: desce a ilha inteira e apaga. Só translate e opacity — as duas
  // são compostas pela GPU, e é o par que a web aguenta sem o problema de
  // `position` que já colapsou tela aqui.
  const oculta = useSharedValue(0);
  const jaMontou = React.useRef(false);
  React.useEffect(() => {
    const alvo = escondida ? 1 : 0;
    // Na montagem a ilha apenas ESTÁ onde tem de estar. Animar aqui faria a
    // barra deslizar para dentro toda vez que a aba monta — e, pior, gastaria
    // um `withTiming` que nada na tela pediu. Mesmo princípio do indicador
    // logo acima: primeira medição não é trajeto.
    if (!jaMontou.current) {
      jaMontou.current = true;
      oculta.value = alvo;
      return;
    }
    oculta.value = reducedMotion
      ? alvo
      : withTiming(alvo, {
          duration: motion.duration.base,
          easing: selectionEasing,
        });
  }, [escondida, reducedMotion, oculta]);

  const estiloIlha = useAnimatedStyle(() => ({
    // o deslocamento passa da própria altura: some junto com a sombra
    transform: [
      {
        translateY: interpolate(
          oculta.value,
          [0, 1],
          [0, ILHA_ALTURA + ILHA_RESPIRO + 16],
        ),
      },
    ],
    opacity: interpolate(oculta.value, [0, 1], [1, 0]),
  }));

  const slideStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: sidePad + indexSv.value * itemWidth + PILULA_MARGEM / 2 },
      { scaleX: stretch.value },
    ],
  }));

  return (
    <Animated.View
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={[
        {
          position: "absolute",
          left: ILHA_LATERAL,
          right: ILHA_LATERAL,
          bottom: (props.insets.bottom || 0) + ILHA_RESPIRO,
          height: ILHA_ALTURA,
          borderRadius: radius["2xl"],
          backgroundColor: t.background.elevated,
          borderWidth: 1,
          borderColor: t.border.subtle,
          overflow: "hidden",
          // No dark a sombra quase não aparece, mas sobre uma LISTA CLARA ela é
          // o que separa a ilha do conteúdo que passa por baixo
          shadowColor: "#000",
          shadowOpacity: 0.34,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 12,
        },
        estiloIlha,
      ]}
    >
      {itemWidth > 0 && (
        <Animated.View
          style={[
            {
              position: "absolute",
              top: PILULA_MARGEM,
              left: 0,
              width: itemWidth - PILULA_MARGEM,
              height: ILHA_ALTURA - PILULA_MARGEM * 2,
              borderRadius: radius.xl,
              backgroundColor: t.accent.neonMuted,
              pointerEvents: "none",
            },
            slideStyle,
          ]}
        />
      )}
      <View style={{ flex: 1 }}>
        <BottomTabBar {...props} />
      </View>
    </Animated.View>
  );
}
