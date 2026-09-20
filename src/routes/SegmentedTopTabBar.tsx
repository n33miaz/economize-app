import type { MaterialTopTabBarProps } from "@react-navigation/material-top-tabs";
import React from "react";
import { Pressable, ScrollView, Text } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTabBarStore } from "../store/tabBarStore";
import { motion, radius, spacing } from "../theme/ds";
import { selectionEasing } from "../theme/motionPresets";
import { useTheme } from "../theme/ThemeProvider";

/** Altura da pílula inteira, com as duas bordas. Escolha 7: 38 px. */
export const SEGMENTADO_ALTURA = 38;

/** Respiro interno entre a borda da pílula e o segmento. */
const RESPIRO_INTERNO = 3;

/** Altura do segmento: 38 menos os dois respiros. */
const SEGMENTO_ALTURA = SEGMENTADO_ALTURA - RESPIRO_INTERNO * 2;

/** Vão entre dois segmentos. */
const VAO = 2;

/** Geometria medida de um segmento. */
interface Medida {
  x: number;
  largura: number;
}

/**
 * As faixas de interpolação da marca deslizante, ou `null` enquanto faltar
 * medida.
 *
 * <p><b>Por que uma função pura, fora do componente.</b> A decisão que importa
 * aqui não é o movimento, é o RECORTE: *ainda não sei onde os segmentos estão,
 * então não desenho a marca em lugar nenhum*. Dentro de um `useAnimatedStyle`
 * isso só seria observável na thread de UI, que o ambiente de teste não
 * executa — e uma marca nascendo no lugar errado é exatamente o tipo de
 * defeito que ninguém vê num teste e todo mundo vê no aparelho.
 *
 * <p>Devolve `null` também quando a lista veio furada: o `onLayout` chega um
 * segmento por vez, e no quadro do meio o array tem buracos.
 */
export function faixasDaMarca(
  medidas: (Medida | undefined)[],
  totalDeAbas: number,
): { entrada: number[]; x: number[]; largura: number[] } | null {
  if (totalDeAbas === 0) return null;
  if (medidas.length !== totalDeAbas) return null;
  if (medidas.some((m) => m === undefined)) return null;
  const completas = medidas as Medida[];
  return {
    entrada: completas.map((_, i) => i),
    x: completas.map((m) => m.x),
    largura: completas.map((m) => m.largura),
  };
}

/**
 * O CONTROLE SEGMENTADO das abas de cima.
 *
 * <p>Escolha 7 do dono em 16/09/2026: <i>"as abas viram um controle segmentado
 * em pílula, dentro do header, junto ao título. Ocupa 38 px, some ao rolar
 * junto com o header e nunca corta rótulo — rola na horizontal se
 * precisar"</i>.
 *
 * <p><b>O que havia antes.</b> Quatro rótulos em maiúsculas com um traço
 * deslizante de 3 px, ocupando 46 px permanentes. No alvo declarado — Safari de
 * iPhone 12, <b>664 px úteis</b> — eram 7% da tela gastos numa régua, logo
 * abaixo de um header que já dizia "Finanças": dois níveis visuais para uma
 * informação. E a 390 px "Investimentos" não cabia — o rótulo quebrava em duas
 * linhas, empurrava o indicador e desalinhava a régua inteira por causa de uma
 * palavra. Foi por isso que a fonte tinha caído para 11 px.
 *
 * <p><b>Por que nada corta aqui.</b> Cada segmento tem `flexGrow: 1` com
 * `flexShrink: 0`: ele CRESCE para ocupar a sobra quando os rótulos cabem, e
 * mantém a largura natural quando não cabem — caso em que a `ScrollView`
 * assume e a pessoa arrasta. Sem medir nada e sem reflow depois do primeiro
 * quadro. Com os quatro rótulos de Finanças a conta dá ~304 px contra os 350
 * disponíveis no iPhone: cabe, e o crescimento preenche o resto.
 *
 * <p><b>A marca deslizante.</b> Mesma matemática da ilha de baixo (ver
 * `TabBarWithIndicator`): anima o ÍNDICE, não o `translateX`, e interpola
 * sobre as posições medidas. Como aqui os segmentos têm larguras diferentes, o
 * `outputRange` sai do `onLayout` de cada um — e enquanto a medida não chega a
 * marca fica invisível, em vez de nascer no lugar errado.
 */
export default function SegmentedTopTabBar({
  state,
  descriptors,
  navigation,
}: MaterialTopTabBarProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const escondida = useTabBarStore((s) => s.escondida);

  // Geometria medida de cada segmento. Estado de React e não shared value: o
  // `outputRange` de uma interpolação é lido no render, não na thread de UI
  const [medidas, setMedidas] = React.useState<(Medida | undefined)[]>([]);

  const indiceAtivo = state.index;
  const indiceSv = useSharedValue(indiceAtivo);
  const jaMontou = React.useRef(false);

  React.useEffect(() => {
    if (reducedMotion || !jaMontou.current) {
      // Primeira montagem não é trajeto: a marca já nasce sobre a aba ativa.
      // Mesmo princípio da ilha de baixo
      jaMontou.current = true;
      indiceSv.value = indiceAtivo;
      return;
    }
    indiceSv.value = withTiming(indiceAtivo, {
      duration: motion.duration.fast,
      easing: selectionEasing,
    });
  }, [indiceAtivo, reducedMotion, indiceSv]);

  // Esconder junto com o header. ALTURA e opacidade, e não o translate da
  // ilha: aqui o ponto é devolver os 38 px para a lista, e uma pílula que sobe
  // mas continua reservando a altura não teria escondido nada
  const oculta = useSharedValue(0);
  const jaMontouOculta = React.useRef(false);
  React.useEffect(() => {
    const alvo = escondida ? 1 : 0;
    if (!jaMontouOculta.current) {
      jaMontouOculta.current = true;
      oculta.value = alvo;
      return;
    }
    oculta.value = reducedMotion
      ? alvo
      : withTiming(alvo, {
          duration: motion.duration.fast,
          easing: selectionEasing,
        });
  }, [escondida, reducedMotion, oculta]);

  const estiloColapso = useAnimatedStyle(() => ({
    height: interpolate(oculta.value, [0, 1], [SEGMENTADO_ALTURA, 0]),
    opacity: interpolate(oculta.value, [0, 1], [1, 0]),
    marginBottom: interpolate(oculta.value, [0, 1], [spacing[2], 0]),
  }));

  const faixas = faixasDaMarca(medidas, state.routes.length);

  const estiloMarca = useAnimatedStyle(() => {
    if (!faixas) return { opacity: 0 };
    // Uma aba só: `interpolate` com inputRange de um ponto devolve NaN, e não
    // existe trajeto para interpolar
    if (faixas.entrada.length === 1) {
      return {
        opacity: 1,
        transform: [{ translateX: faixas.x[0] }],
        width: faixas.largura[0],
      };
    }
    return {
      opacity: 1,
      transform: [
        { translateX: interpolate(indiceSv.value, faixas.entrada, faixas.x) },
      ],
      width: interpolate(indiceSv.value, faixas.entrada, faixas.largura),
    };
  }, [faixas]);

  return (
    <Animated.View style={[{ overflow: "hidden" }, estiloColapso]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // `flexGrow` no conteúdo é a outra metade do "cresce se cabe, rola se
        // não cabe": sem ele o conteúdo para na largura natural e a pílula
        // fica com uma sobra vazia à direita
        contentContainerStyle={{ flexGrow: 1, gap: VAO }}
        style={{
          height: SEGMENTADO_ALTURA,
          marginHorizontal: spacing[5],
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: t.border.subtle,
          backgroundColor: t.background.elevated,
          padding: RESPIRO_INTERNO,
        }}
      >
        {/* A marca vem ANTES dos segmentos: ordem de irmãos é o que a põe
            atrás dos rótulos, do mesmo jeito que na ilha de baixo */}
        <Animated.View
          style={[
            {
              position: "absolute",
              top: 0,
              height: SEGMENTO_ALTURA,
              borderRadius: radius.full,
              backgroundColor: t.accent.neon,
            },
            estiloMarca,
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const rotulo = options.title ?? route.name;
          const ativo = state.index === index;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={rotulo}
              onPress={() => {
                // `tabPress` cancelável é o contrato do navigator: uma tela
                // pode barrar a saída (formulário sujo), e pular o evento
                // tiraria esse direito dela
                const evento = navigation.emit({
                  type: "tabPress",
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!ativo && !evento.defaultPrevented) {
                  navigation.navigate(route.name);
                }
              }}
              onLayout={(e) => {
                const { x, width } = e.nativeEvent.layout;
                setMedidas((atuais) => {
                  if (
                    atuais[index]?.x === x &&
                    atuais[index]?.largura === width
                  ) {
                    return atuais;
                  }
                  const proximas = [...atuais];
                  proximas[index] = { x, largura: width };
                  return proximas;
                });
              }}
              style={{
                flexGrow: 1,
                // O que impede o corte: sem isto o flex encolhe o segmento
                // para caber e o rótulo perde letras
                flexShrink: 0,
                height: SEGMENTO_ALTURA,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: spacing[3],
                borderRadius: radius.full,
              }}
            >
              <Text
                // 13 e não os 11 de antes: o rótulo deixou de disputar largura
                // com uma régua que ia de ponta a ponta
                style={{
                  fontFamily: "Roboto_700Bold",
                  fontSize: 13,
                  color: ativo ? t.text.inverse : t.text.secondary,
                }}
              >
                {rotulo}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Animated.View>
  );
}
