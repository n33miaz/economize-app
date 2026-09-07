import type { AccountInvoice, InvoiceReserve } from "../services/api";

/**
 * Como a tela lê a reserva de uma fatura — EC-181.
 *
 * Regras puras, fora do componente, porque a leitura é o que dá sentido ao
 * número: separar R$ 641,14 para uma fatura de R$ 641,14 é "coberta"; separar
 * o mesmo valor para uma fatura AINDA ABERTA de R$ 320,57 não é sobra, é uma
 * fatura que vai crescer. O card não pode chamar as duas coisas de "sobrou".
 */

export type ReserveCoverage =
  /** O separado dá conta da fatura inteira. */
  | "COVERED"
  /** Dá para uma parte. */
  | "PARTIAL"
  /** Sobra sobre uma fatura JÁ FECHADA: o valor não muda mais. */
  | "SURPLUS"
  /** Sobra sobre uma fatura em aberto: ela ainda cresce até fechar. */
  | "AHEAD";

export interface ReserveReading {
  coverage: ReserveCoverage;
  /** 0–100, arredondado; 100 quando cobre tudo. */
  percent: number;
  /** O que ainda falta separar; 0 quando não falta nada. */
  missing: number;
  /** Quanto passou do valor da fatura; 0 quando não passou. */
  extra: number;
}

export const readReserve = (
  invoice: AccountInvoice,
  reserve: InvoiceReserve | null | undefined = invoice.reserve,
): ReserveReading | null => {
  if (!reserve || reserve.amount <= 0) return null;
  const total = invoice.total;
  // Fatura zerada ou com saldo a favor não tem o que cobrir: qualquer valor
  // separado está adiantado, e dividir por ela daria infinito
  if (total <= 0) {
    return {
      coverage: invoice.open ? "AHEAD" : "SURPLUS",
      percent: 100,
      missing: 0,
      extra: round(reserve.amount),
    };
  }
  const ratio = reserve.amount / total;
  if (ratio >= 0.995 && ratio <= 1.005) {
    // Meio centavo para cada lado: o dono que separa "o valor exato" digita o
    // número da fatura, e um arredondamento não pode transformar isso em
    // "falta R$ 0,01"
    return { coverage: "COVERED", percent: 100, missing: 0, extra: 0 };
  }
  if (ratio < 1) {
    return {
      coverage: "PARTIAL",
      percent: Math.round(ratio * 100),
      missing: round(total - reserve.amount),
      extra: 0,
    };
  }
  return {
    coverage: invoice.open ? "AHEAD" : "SURPLUS",
    percent: 100,
    missing: 0,
    extra: round(reserve.amount - total),
  };
};

/** A frase curta do chip, já com o valor formatado por quem chama. */
export const describeCoverage = (reading: ReserveReading): string => {
  switch (reading.coverage) {
    case "COVERED":
      return "cobre a fatura";
    case "PARTIAL":
      return `cobre ${reading.percent}%`;
    case "AHEAD":
      // A fatura em aberto ainda cresce: chamar isso de sobra seria prometer
      // um troco que pode não existir no fechamento
      return "adiantado";
    case "SURPLUS":
    default:
      return "sobra";
  }
};

const round = (value: number) => Math.round(value * 100) / 100;
