import { Platform, type ViewStyle } from "react-native";

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

function browserSupportsOverflowClip(): boolean {
  return (
    typeof CSS !== "undefined" &&
    typeof CSS.supports === "function" &&
    CSS.supports("overflow", "clip")
  );
}
