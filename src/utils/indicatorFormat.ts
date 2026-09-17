import { formatDecimal } from "./money";

/**
 * Como um ativo é escrito na tela — as regras que valiam só dentro do
 * `IndicatorCard`.
 *
 * <p><b>Por que saíram de lá.</b> A escolha 10 do dono ("uma manchete, depois
 * o resto") põe o MESMO ativo em dois lugares da mesma tela: grande, em cima,
 * e pequeno, na grade. Duas cópias da regra de formatação é a receita para o
 * IBOVESPA aparecer como "179.722 pts" na manchete e "R$ 179.722,48" no card
 * logo abaixo — que foi, letra por letra, um defeito real desta tela. O
 * `TransactionRow` existe pelo mesmo motivo: quatro telas desenhavam a linha
 * do extrato de quatro jeitos.
 *
 * <p>Cada regra aqui é uma cicatriz, e o comentário diz de quê.
 */

/** Abaixo deste valor a cotação mostra quatro casas em vez de duas. */
const PISO_QUATRO_CASAS = 0.1;

export interface ValorDeAtivo {
  value: number | null | undefined;
  /** "R$", "US$", "pts"… */
  symbol?: string;
  type?: string;
}

/**
 * O valor do ativo, já escrito.
 *
 * <ul>
 *   <li><b>Traço e não zero</b> quando não há cotação: quem lê entende "sem
 *   cotação" em vez de "não vale nada". `Number(null) || 0` apagava essa
 *   diferença e o card afirmava R$ 0,00 com a variação certa ao lado.</li>
 *   <li><b>Índice é pontuado</b>, e a decisão vem do TIPO, não só do símbolo:
 *   o catálogo não passa símbolo e mostrava o IBOVESPA como "R$
 *   179.722,48".</li>
 *   <li><b>Quatro casas abaixo de R$ 0,10</b>: peso argentino e iene saíam
 *   "R$ 0,00" ao lado de uma variação de -0,82%.</li>
 * </ul>
 */
export function formatIndicatorValue({
  value,
  symbol = "R$",
  type,
}: ValorDeAtivo): string {
  const temValor = value != null && Number.isFinite(Number(value));
  if (!temValor) return "—";
  const numero = Number(value);

  if (symbol === "pts" || type === "index") {
    return `${numero.toLocaleString("pt-BR", {
      maximumFractionDigits: 0,
    })} pts`;
  }

  const casas = numero > 0 && numero < PISO_QUATRO_CASAS ? 4 : 2;
  return `${symbol} ${formatDecimal(numero, casas)}`;
}

/**
 * "Dia: 42,10 – 43,55" — os dois extremos, ou `null`.
 *
 * <p>Nulo é ausência, não zero: um extremo do dia igual a zero faria a faixa
 * afirmar que o papel chegou a valer nada. E `alta <= baixa` também devolve
 * nulo, porque uma faixa invertida (ou de largura zero) não é faixa — é fonte
 * ruim, e desenhar uma barra a partir dela daria divisão por zero.
 */
export function dayRangeLabel(
  dayLow: number | null | undefined,
  dayHigh: number | null | undefined,
): string | null {
  const faixa = dayRange(dayLow, dayHigh);
  if (!faixa) return null;
  return `Dia: ${formatDecimal(faixa.baixa)} – ${formatDecimal(faixa.alta)}`;
}

/** Os extremos do dia já validados, para quem precisa dos números. */
export function dayRange(
  dayLow: number | null | undefined,
  dayHigh: number | null | undefined,
): { baixa: number; alta: number } | null {
  const baixa =
    dayLow != null && Number.isFinite(Number(dayLow)) ? Number(dayLow) : null;
  const alta =
    dayHigh != null && Number.isFinite(Number(dayHigh))
      ? Number(dayHigh)
      : null;
  if (baixa == null || alta == null || alta <= baixa) return null;
  return { baixa, alta };
}

/**
 * Onde o preço de agora está dentro da faixa do dia, de 0 (na mínima) a 1 (na
 * máxima) — ou `null` quando não há faixa.
 *
 * <p>É o que permite desenhar a posição do preço na barra do dia. Fica preso
 * ao intervalo de propósito: cotação e extremos chegam da fonte em momentos
 * diferentes, e um preço um centavo fora da faixa desenharia a marca do lado
 * de fora da barra.
 */
export function positionInDayRange(
  value: number | null | undefined,
  dayLow: number | null | undefined,
  dayHigh: number | null | undefined,
): number | null {
  const faixa = dayRange(dayLow, dayHigh);
  if (!faixa) return null;
  if (value == null || !Number.isFinite(Number(value))) return null;
  const bruto = (Number(value) - faixa.baixa) / (faixa.alta - faixa.baixa);
  return Math.min(1, Math.max(0, bruto));
}
