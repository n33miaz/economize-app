import { useWebKeyboardInset } from "./useWebKeyboardInset";

/**
 * A versão do navegador: o teclado está aberto quando a janela visual
 * encolheu, que é a única pista que a web dá.
 *
 * <p>No desktop o recuo é sempre zero e isto devolve `false` — não há
 * teclado virtual para fechar, e o toque no fundo continua fechando a folha
 * direto, como sempre fez.
 */
export function useKeyboardVisible(): boolean {
  return useWebKeyboardInset() > 0;
}
