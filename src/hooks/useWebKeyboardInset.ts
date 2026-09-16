/**
 * Altura do teclado virtual no NAVEGADOR — versão nativa, que devolve zero.
 *
 * <p>No Android e no iOS quem afasta o conteúdo do teclado é o
 * `KeyboardAvoidingView`; este hook não tem o que fazer lá. A versão que mede
 * de verdade é a irmã `.web.ts`, escolhida pelo Metro quando o alvo é a web —
 * no navegador o `KeyboardAvoidingView` é um no-op e o campo em foco ficava
 * atrás do teclado.
 *
 * <p>Nome único de arquivo por plataforma, e não um `Platform.OS === "web"`
 * dentro de um hook só: a versão nativa não pode nem enxergar `window`, e a
 * web não pode importar nada do teclado nativo.
 */
export function useWebKeyboardInset(): number {
  return 0;
}
