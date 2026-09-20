import type { Indicator } from "../services/api";
import { dayRange, positionInDayRange } from "./indicatorFormat";
import { formatDecimal, formatPercent } from "./money";

/**
 * A MANCHETE do Mercado: qual ativo vira o destaque grande, e a frase que
 * conta o que aconteceu com ele.
 *
 * <p>Escolha 10 do dono em 16/09/2026: <i>"o topo vira uma manchete: o ativo
 * que você mais olha, grande, com linha de tendência, faixa do dia e a frase
 * do que aconteceu"</i>.
 */

/** A partir daqui o preço está "perto" de um extremo do dia. */
const PERTO_DO_EXTREMO = 0.2;

/**
 * O ativo da manchete.
 *
 * <p><b>"O que você mais olha" — e o que isso pode ser, honestamente.</b> O
 * app não conta quantas vezes cada ativo foi aberto, e inventar essa contagem
 * agora só para escolher um card seria caro e adivinhado. O sinal que JÁ
 * existe é mais forte que uma contagem: a estrela. Favoritar é a pessoa
 * dizendo, com o dedo, qual ativo importa — e o primeiro favorito é o que ela
 * pôs primeiro.
 *
 * <p>Sem favorito nenhum, vale o primeiro destaque curado da aba: é o que a
 * tela já mostrava em cima antes desta escolha. Sem os dois, não há manchete —
 * e a tela começa direto pela grade, em vez de reservar espaço para um card
 * vazio.
 */
export function ativoDaManchete(
  favoritos: readonly Indicator[],
  destaques: readonly Indicator[],
): Indicator | null {
  return favoritos[0] ?? destaques[0] ?? null;
}

/** De onde a manchete saiu, para a tela poder dizer isso a quem lê. */
export function origemDaManchete(
  favoritos: readonly Indicator[],
): "favorito" | "destaque" {
  return favoritos.length > 0 ? "favorito" : "destaque";
}

/**
 * A frase do que aconteceu.
 *
 * <p>Uma frase, no indicativo, sem jargão e sem prometer causa: o app sabe que
 * o número subiu, não <i>por que</i> subiu. Dizer "subiu com o dólar" seria
 * inventar uma explicação que este dado não carrega — o mesmo cuidado que o
 * extrato tem ao não separar estorno de pagamento de fatura.
 *
 * <p>Quando existe faixa do dia, a frase diz ONDE dentro dela o preço está,
 * que é a informação que a porcentagem do dia não dá: "subiu 1,2%" e "está
 * perto da máxima" são fatos diferentes, e o segundo é o que responde "ainda
 * vale a pena esperar?".
 */
export function fraseDoDia(indicador: Indicator): string {
  const valor = indicador.points ?? indicador.buy;
  const temValor = valor != null && Number.isFinite(Number(valor));
  if (!temValor) return "Sem cotação agora.";

  const variacao = Number(indicador.variation) || 0;
  const faixa = dayRange(indicador.dayLow, indicador.dayHigh);
  const posicao = positionInDayRange(
    valor,
    indicador.dayLow,
    indicador.dayHigh,
  );

  const movimento =
    variacao > 0
      ? `Subiu ${formatPercent(variacao)} hoje`
      : variacao < 0
        ? `Caiu ${formatPercent(Math.abs(variacao))} hoje`
        : "Sem variação hoje";

  if (!faixa || posicao === null) return `${movimento}.`;

  if (posicao >= 1 - PERTO_DO_EXTREMO) {
    return `${movimento}, e está perto da máxima do dia.`;
  }
  if (posicao <= PERTO_DO_EXTREMO) {
    return `${movimento}, e está perto da mínima do dia.`;
  }
  return (
    `${movimento}; o dia foi de ${formatDecimal(faixa.baixa)} ` +
    `a ${formatDecimal(faixa.alta)}.`
  );
}
