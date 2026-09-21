import type { ForecastItem } from "../services/api";

/**
 * Medido ou informado — EC-206.
 *
 * <p><b>Por que esta distinção é a coisa mais importante de uma previsão.</b>
 * Uma previsão junta dois tipos de número que parecem iguais na tela e não
 * são: o que o app <i>mediu</i> no extrato (o aluguel que saiu nos últimos
 * catorze meses) e o que a pessoa <i>afirmou</i> (o curso que ela pretende
 * pagar). O primeiro tem histórico; o segundo é uma intenção.
 *
 * <p>Apresentar os dois com a mesma cara faz a previsão parecer mais firme do
 * que é. E quando ela erra — e ela erra —, o usuário não tem como saber se o
 * app leu errado ou se ele mesmo informou errado. Marcar a origem devolve
 * essa resposta.
 *
 * <p><b>A regra é curta:</b> série detectada do extrato é <b>medida</b>; série
 * que a pessoa agendou é <b>informada</b>. Série medida com valor variável
 * continua medida — o valor oscila, mas a existência dela foi observada, e é a
 * existência que a previsão está afirmando.
 *
 * <p><b>E "já aconteceu" vence as duas.</b> Um item conciliado no período
 * corrente não é previsão nenhuma: é fato. Chamá-lo de "medido" junto dos
 * outros apagaria a diferença entre o que o app espera e o que já entrou na
 * conta.
 */

export type ForecastOrigin = "settled" | "measured" | "declared";

export interface ForecastOriginLabel {
  kind: ForecastOrigin;
  /** O selo curto que cabe ao lado do valor. */
  badge: string;
  /** A frase que o leitor de tela ouve, e que explica o selo. */
  spoken: string;
}

/**
 * Exportado porque o padrão de renda (EC-237) veste os MESMOS selos: um dia
 * de pagamento medido no extrato e um dia informado no cadastro são a mesma
 * distinção que esta previsão já faz, e dois vocabulários para uma ideia só
 * ensinariam a pessoa a desconfiar dos dois.
 */
export const ROTULOS: Record<ForecastOrigin, Omit<ForecastOriginLabel, "kind">> = {
  settled: {
    badge: "já entrou",
    spoken: "já aconteceu neste período; não é previsão",
  },
  measured: {
    badge: "medido",
    spoken: "medido no seu extrato",
  },
  declared: {
    badge: "informado",
    spoken: "informado por você",
  },
};

export function forecastOrigin(
  item: Pick<ForecastItem, "source" | "settled">,
): ForecastOriginLabel {
  // Conciliado vem primeiro: fato não é previsão, independentemente de onde a
  // série nasceu
  if (item.settled) return { kind: "settled", ...ROTULOS.settled };
  if (item.source === "DETECTED") return { kind: "measured", ...ROTULOS.measured };
  return { kind: "declared", ...ROTULOS.declared };
}

/**
 * Quanto de um período é previsão informada, e não medida.
 *
 * <p>É o número que qualifica o total do mês: "R$ 4.100 previstos, dos quais
 * R$ 900 são estimativa sua" diz mais sobre a confiança daquele saldo do que
 * qualquer barra de erro.
 *
 * <p>O conciliado fica de fora das duas contas: ele já é dinheiro que andou.
 */
export function declaredShare(
  items: Pick<ForecastItem, "source" | "settled" | "amount">[],
): { declared: number; measured: number; ratio: number } {
  let declared = 0;
  let measured = 0;

  for (const item of items) {
    const origem = forecastOrigin(item);
    if (origem.kind === "settled") continue;
    const valor = Math.abs(item.amount);
    if (origem.kind === "declared") declared += valor;
    else measured += valor;
  }

  const total = declared + measured;
  return { declared, measured, ratio: total > 0 ? declared / total : 0 };
}

/**
 * A frase de ressalva do período, ou null quando não há o que ressalvar.
 *
 * <p>Null em dois casos, e os dois são deliberados: previsão inteiramente
 * medida não precisa de aviso, e previsão em que o informado é resíduo
 * (abaixo de 10%) também não — ressalva que aparece sempre é ressalva que
 * ninguém lê, que é a mesma lição do piso de materialidade.
 */
export function declaredCaveat(
  items: Pick<ForecastItem, "source" | "settled" | "amount">[],
): string | null {
  const { declared, ratio } = declaredShare(items);
  if (declared <= 0 || ratio < 0.1) return null;
  const porCento = Math.round(ratio * 100);
  return `${porCento}% desta previsão é estimativa informada por você.`;
}
