import type { InstallmentOverview, InstallmentSeries } from "../services/api";
import { addMonths } from "./commitmentTimeline";

/**
 * Uma série de parcelamento em andamento, já traduzida para o que a tela
 * pergunta — e com o que o servidor NÃO manda.
 *
 * <p>A projeção do servidor (EC-217) é por mês e termina em `lastMonth`; ela
 * não diz em que mês cai a PRÓXIMA parcela porque isso se deriva: se faltam
 * `remaining` parcelas e a última é em `lastMonth`, a próxima é `remaining - 1`
 * meses antes dela. É a mesma conta que a linha do tempo da Previsão já faz
 * (`commitmentTimeline`), e por isso `addMonths` vem de lá — duas contas para
 * o mesmo mês seria o jeito de um dia elas discordarem.
 *
 * <p><b>"Pagas" é `total - remaining`, nunca `seen`.</b> `seen` é quantas
 * parcelas o extrato MOSTRA, e o histórico pode começar no meio da compra:
 * uma série 5/10 vista a partir da quinta tem `seen: 1` e quatro pagas antes
 * de o app existir. O usuário pagou dez menos as que faltam, ponto.
 */
export interface OpenInstallment {
  /** Estável entre chamadas: a mesma compra recebe a mesma chave. */
  key: string;
  description: string;
  total: number;
  /** Quantas já caíram. */
  paid: number;
  remaining: number;
  installmentAmount: number;
  remainingAmount: number;
  /** `YYYY-MM` da próxima parcela. */
  nextMonth: string;
  /** `YYYY-MM` da última parcela. */
  lastMonth: string;
  /** Fração paga, 0..1 — é o que a barra desenha. */
  progress: number;
}

export interface InstallmentsSummary {
  open: OpenInstallment[];
  count: number;
  /**
   * Soma das parcelas das séries abertas: quanto da próxima fatura já está
   * travado antes de qualquer compra nova. É o número que responde "por que a
   * fatura nunca baixa".
   */
  monthlyLoad: number;
  remainingTotal: number;
}

/** Série que ainda vai cobrar: nem terminou, nem está zerada. */
export function isOpenInstallment(series: InstallmentSeries): boolean {
  return !series.finished && series.remaining > 0;
}

/** `YYYY-MM` em que cai a próxima parcela da série. */
export function nextInstallmentMonth(series: InstallmentSeries): string {
  if (series.remaining <= 0) return series.lastMonth;
  return addMonths(series.lastMonth, -(series.remaining - 1));
}

/**
 * As séries abertas, na ordem em que o servidor as manda (última parcela mais
 * próxima primeiro): a que termina antes é a que mais interessa a quem quer
 * ver a fatura aliviar.
 */
export function openInstallments(
  overview: InstallmentOverview | null | undefined,
): OpenInstallment[] {
  return (overview?.series ?? []).filter(isOpenInstallment).map((series) => {
    const total = Math.max(series.total, 1);
    const paid = Math.max(0, series.total - series.remaining);
    return {
      key: `${series.description}|${series.firstMonth}`,
      description: series.description,
      total: series.total,
      paid,
      remaining: series.remaining,
      installmentAmount: series.installmentAmount,
      remainingAmount: series.remainingAmount,
      nextMonth: nextInstallmentMonth(series),
      lastMonth: series.lastMonth,
      progress: Math.min(1, Math.max(0, paid / total)),
    };
  });
}

/** Soma das parcelas mensais das séries abertas. */
export function monthlyInstallmentLoad(open: OpenInstallment[]): number {
  return open.reduce((soma, item) => soma + item.installmentAmount, 0);
}

/**
 * Quanto em parcelas cai na PRÓXIMA fatura — a do mês corrente ou a do
 * seguinte, conforme o ciclo do cartão. Série cuja próxima parcela é mais
 * adiante (parcelamento agendado que ainda não começou) fica de fora.
 */
export function nextInvoiceInstallmentLoad(
  open: OpenInstallment[],
  currentMonth: string,
): { amount: number; count: number } {
  const limite = addMonths(currentMonth, 1);
  const proximas = open.filter((item) => item.nextMonth <= limite);
  return {
    amount: monthlyInstallmentLoad(proximas),
    count: proximas.length,
  };
}

export function installmentsSummary(
  overview: InstallmentOverview | null | undefined,
): InstallmentsSummary {
  const open = openInstallments(overview);
  return {
    open,
    count: open.length,
    monthlyLoad: monthlyInstallmentLoad(open),
    remainingTotal: open.reduce((soma, item) => soma + item.remainingAmount, 0),
  };
}

/** "2 de 3 pagas" — a leitura de progresso de uma linha. */
export function describeInstallmentProgress(item: OpenInstallment): string {
  return `${item.paid} de ${item.total} pagas`;
}
