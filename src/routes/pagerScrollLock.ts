import { Platform, type ViewStyle } from "react-native";
import {
  SceneStyleInterpolators,
  type BottomTabNavigationOptions,
} from "@react-navigation/bottom-tabs";

// A biblioteca não exporta o tipo do interpolador; ele sai da própria opção
type BottomTabSceneStyleInterpolator = NonNullable<
  BottomTabNavigationOptions["sceneStyleInterpolator"]
>;

/**
 * Estilo do contêiner das abas de cima que impede o navegador de rolá-lo.
 *
 * <p><b>O defeito (web).</b> O `TabView` do react-native-tab-view 4.2 envolve
 * as abas num `View` com `overflow: hidden` (`styles.pager` em
 * `react-native-tab-view/src/TabView.tsx`). Lá dentro, o paginador da web
 * (`PanResponderAdapter.tsx`) estende uma folha com a largura de TODAS as abas
 * lado a lado e escolhe a visível só por `translateX`. Em CSS, `hidden` recorta
 * mas continua sendo contêiner de rolagem: um `scrollIntoView` (automação) ou o
 * foco de teclado num elemento de uma aba fora da tela mexe no `scrollLeft`
 * desse `View`, o `translateX` não sabe disso, e a tela fica com meia aba de
 * cada lado e a régua apontando para outra.
 *
 * <p><b>Por que `clip`.</b> `overflow: clip` recorta igual, mas não cria
 * contêiner de rolagem: não existe `scrollLeft` para o navegador deslocar.
 * Entra pela prop `style` do navegador, que a biblioteca repassa até esse
 * `View` — sem ref no DOM, sem ouvir `scroll`, sem CSS global. A troca de aba
 * por toque e por gesto é toda por `transform` e não muda.
 *
 * <p>Só na web: no Android e no iOS o paginador é nativo e não tem esse
 * problema, então lá a função devolve `undefined` e nada muda. Navegador sem
 * `clip` (Safari antes do 16) também fica com `undefined`: o react-native-web
 * gera classes atômicas, e um `clip` desconhecido substituiria o `hidden` da
 * biblioteca por `visible` — as outras abas vazariam para a tela.
 */
export function pagerScrollLockStyle(
  os: string = Platform.OS,
  supportsClip: boolean = browserSupportsOverflowClip(),
): ViewStyle | undefined {
  if (os !== "web" || !supportsClip) return undefined;
  // `ViewStyle["overflow"]` do React Native não conhece "clip", mas o
  // react-native-web repassa o valor ao CSS como veio
  return { overflow: "clip" } as unknown as ViewStyle;
}

/**
 * O "shift" da barra de baixo sem a sobra de 50 px que o navegador rola.
 *
 * <p><b>O segundo contêiner rolável (web).</b> Com o `clip` acima, quem passou
 * a ceder ao `scrollIntoView` foi o contêiner das telas da barra de baixo
 * (`styles.screens`, `overflow: hidden`, em
 * `@react-navigation/bottom-tabs/src/views/BottomTabView.tsx`). O `forShift`
 * da biblioteca deixa cada aba já visitada e fora de foco PARADA em
 * `translateX(±50px)` com opacidade 0 — na web ela não some com
 * `display: none` —, e a Início a +50 px dá ao contêiner 50 px de conteúdo à
 * direita para rolar. Medido no roteiro e2e: largura 390, conteúdo 440.
 *
 * <p>Aqui o deslize é o mesmo durante a troca, mas em repouso (progresso ±1,
 * quando a tela já está invisível) ela volta a 0 px: não sobra nada para
 * rolar. O salto de 49,5 para 0 acontece com opacidade ≤ 1%, ninguém vê. É a
 * opção `sceneStyleInterpolator` do próprio navegador; o contêiner não expõe
 * prop de estilo. Fora da web devolve o `forShift` original, intacto.
 */
export function restingShiftInterpolator(
  os: string = Platform.OS,
): BottomTabSceneStyleInterpolator {
  if (os !== "web") return SceneStyleInterpolators.forShift;
  return ({ current }) => ({
    sceneStyle: {
      opacity: current.progress.interpolate({
        inputRange: [-1, 0, 1],
        outputRange: [0, 1, 0],
      }),
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [-1, -0.99, 0, 0.99, 1],
            outputRange: [0, -49.5, 0, 49.5, 0],
            extrapolate: "clamp",
          }),
        },
      ],
    },
  });
}

function browserSupportsOverflowClip(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("overflow", "clip")
  );
}
