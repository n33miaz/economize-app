import type { Indicator } from "../services/api";

/** O mínimo de um aporte da carteira para saber quanto ele vale. */
interface Aporte {
  assetCode: string;
  quantity: number;
  priceAtTransaction: number;
}

export interface ValorDoAporte {
  /** Quanto o aporte vale agora (ou o custo, quando não há cotação). */
  valor: number;
  /** Quanto foi pago: quantidade × preço da compra. */
  custo: number;
  /**
   * `true` quando não há cotação e o valor é o próprio custo. A tela diz
   * "sem cotação" em vez de mostrar lucro ou prejuízo que ninguém mediu.
   */
  estimado: boolean;
}

/**
 * O valor atual de um aporte, a MESMA conta para a Carteira e para a Home.
 *
 * Antes cada tela tinha a sua: a Carteira valia o ativo sem cotação a 0 (saldo
 * R$ 0,00 e o valor inteiro em vermelho como prejuízo) e a Home valia o preço
 * pago. Duas telas, dois patrimônios para o mesmo dinheiro.
 *
 * Sem cotação, vale o custo: é o último preço que se conhece do ativo, e
 * zero afirmaria uma perda total que não aconteceu. `buy` nulo, NaN ou ≤ 0
 * conta como sem cotação — a API manda `null` onde o tipo promete número.
 */
export function valorDoAporte(
  aporte: Aporte,
  indicadores: readonly Pick<Indicator, "code" | "buy">[],
): ValorDoAporte {
  const custo = aporte.quantity * aporte.priceAtTransaction;
  const cotacao = indicadores.find((i) => i.code === aporte.assetCode)?.buy;
  if (typeof cotacao !== "number" || !Number.isFinite(cotacao) || cotacao <= 0) {
    return { valor: custo, custo, estimado: true };
  }
  return { valor: aporte.quantity * cotacao, custo, estimado: false };
}
