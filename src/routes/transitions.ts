import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";

/**
 * Escala de duração das transições de pilha (ms). Três degraus, por quanto a
 * tela percorre:
 *
 * - `fade` (240): a tela não se desloca, só troca de opacidade — é o caso das
 *   telas de auth, onde não há "de onde" para deslizar.
 * - `slide` (250): percorre a largura da tela, entrando pela direita. Vale
 *   para o padrão da pilha E para as telas efêmeras: antes eram 260 e 240
 *   para o MESMO movimento, e a diferença só se notava como inconsistência.
 * - `modal` (280): percorre a altura, que é maior, e chega como folha.
 *
 * A saída usa a mesma duração da entrada: o native-stack expõe um único
 * `animationDuration` (e só o iOS o honra — no Android a duração é do
 * sistema). Uma saída mais curta, de ~200 ms, exigiria o stack em JS com
 * `transitionSpec` próprio para open/close, o que não vale a troca de
 * navegador só por isso.
 */
export const STACK_DURATION_MS = {
  fade: 240,
  slide: 250,
  modal: 280,
} as const;

// Telas de auth: sem sessão não há hierarquia para deslizar, então só o fade
export const fadeTransition: NativeStackNavigationOptions = {
  animation: "fade",
  animationDuration: STACK_DURATION_MS.fade,
};

// Padrão da pilha autenticada
export const slideRightTransition: NativeStackNavigationOptions = {
  animation: "slide_from_right",
  animationDuration: STACK_DURATION_MS.slide,
};

export const modalLikeTransition: NativeStackNavigationOptions = {
  animation: "slide_from_bottom",
  animationDuration: STACK_DURATION_MS.modal,
  presentation: "modal",
  gestureEnabled: true,
};

// Padrão único das telas efêmeras abertas da Home (Profile, Opções avançadas,
// Relatórios, Notícias, Análise): slide_from_right aqui + fade do conteúdo
// no PageContainer. About e Assistente permanecem com o modalLike acima.
export const ephemeralTransition: NativeStackNavigationOptions = {
  animation: "slide_from_right",
  animationDuration: STACK_DURATION_MS.slide,
  presentation: "card",
};
