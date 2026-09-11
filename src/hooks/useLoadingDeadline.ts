import { useEffect, useState } from "react";

/**
 * O esqueleto tem prazo — EC-216.
 *
 * O defeito foi visto no concorrente e é dos mais frustrantes que existem:
 * duas abas dele (Faturas e Limites) **nunca** terminavam de carregar. Ficavam
 * no esqueleto animado, para sempre, sem erro, sem botão, sem explicação. O
 * usuário não sabe se espera, se sai, se é a internet dele ou o app.
 *
 * Um esqueleto é uma promessa: *"está vindo"*. Passado um tempo, essa promessa
 * vira mentira — e mentira animada é pior que erro, porque erro tem saída.
 *
 * Este hook não cancela nada e não interfere na requisição: ele só responde
 * "já passou do prazo?". Quem decide o que fazer com isso é a tela, que é
 * quem sabe se tem conteúdo velho para manter no lugar.
 */

/**
 * Doze segundos.
 *
 * O cliente HTTP corta em 30 s, então este prazo NÃO é sobre a rede — é sobre
 * a paciência. Doze segundos é bem mais do que qualquer leitura sadia leva
 * (as medidas em campo ficam abaixo de 2 s) e ainda dá folga para o cold start
 * do Render, que é lento e é real. Passado isso, a tela deve parar de prometer.
 */
export const LOADING_DEADLINE_MS = 12_000;

/**
 * @param isLoading  o estado de carga da tela
 * @param deadlineMs prazo; a tela pode encurtar quando o bloco é pequeno
 * @returns true quando ainda está carregando E o prazo já passou
 */
export function useLoadingDeadline(
  isLoading: boolean,
  deadlineMs: number = LOADING_DEADLINE_MS,
): boolean {
  const [estourou, setEstourou] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      // Terminou: some o aviso e o próximo carregamento começa do zero. Sem
      // isto, um retry bem-sucedido deixaria o "está demorando" na tela
      setEstourou(false);
      return;
    }
    setEstourou(false);
    const id = setTimeout(() => setEstourou(true), deadlineMs);
    return () => clearTimeout(id);
  }, [isLoading, deadlineMs]);

  return estourou && isLoading;
}
