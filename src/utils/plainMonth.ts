import { formatBRL } from "./money";

import type { CategorySlice } from "../services/api";

/**
 * O mês dito em uma frase (EC-142, visão simples).
 *
 * <p>A visão simples não é a avançada com menos coisas: é a MESMA verdade dita
 * em português. "Saldo do mês: R$ 340,00" exige que o leitor saiba o que é
 * saldo; "Sobrou R$ 340,00 este mês" não exige nada.
 *
 * <p>Nada aqui arredonda nem suaviza. Quando o mês fecha no vermelho, a frase
 * diz isso — poupar o usuário do número seria decidir por ele que ele não
 * aguenta a informação que veio buscar.
 */
export function plainVerdict(net: number, isWindowMode: boolean): string {
  const periodo = isWindowMode ? "neste ciclo" : "este mês";
  if (net > 0) return `Sobrou ${formatBRL(net)} ${periodo}.`;
  if (net < 0) {
    // "Faltou" e não "saldo negativo": o que aconteceu é que o dinheiro
    // acabou antes, e é assim que a pessoa conta o que viveu
    return `Faltaram ${formatBRL(Math.abs(net))} ${periodo}: você gastou mais do que recebeu.`;
  }
  return `Você gastou exatamente o que recebeu ${periodo}.`;
}

/**
 * A categoria que mais pesou, dita sem porcentagem.
 *
 * <p>O share em porcentagem é a leitura avançada. Aqui vale o nome e o valor,
 * que é o que responde "no que foi meu dinheiro".
 */
export function plainHeaviest(slices: CategorySlice[]): string | null {
  const maior = slices.reduce<CategorySlice | null>(
    (atual, slice) =>
      atual === null || slice.expenseTotal > atual.expenseTotal ? slice : atual,
    null,
  );
  if (maior === null || maior.expenseTotal <= 0) return null;
  // "O que mais pesou foi Sem categoria" não é frase. Antes da revisão a maior
  // fatia costuma ser exatamente essa, então o caso não é raro: é o primeiro
  // mês de todo mundo
  if (maior.categoryId === null) {
    return `${formatBRL(maior.expenseTotal)} das saídas ainda estão sem categoria.`;
  }
  return `O que mais pesou foi ${maior.name}, com ${formatBRL(maior.expenseTotal)}.`;
}
