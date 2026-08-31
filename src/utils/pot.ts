import type { MonthlyAnalytics } from "../services/api";

/**
 * O desempenho do ciclo que o pote conta (EC-146).
 *
 * <p><b>Dinheiro que foi para investimento não é gasto.</b> O extrato o registra
 * como saída — é uma transferência —, mas para quem olha o pote ele é o
 * contrário de gastar. Sem esse ajuste, o mês em que a pessoa mais poupou seria
 * justamente o que mostraria o pote vazio, e o ícone estaria mentindo sobre o
 * esforço dela.
 *
 * <p>Resgate segue como entrada, e isso é honesto: o dinheiro voltou para a
 * conta e está disponível de novo.
 */

/** Chave de sistema da raiz de Investimentos — a categoria não muda de nome. */
const INVESTMENT_ROOT = "INVESTMENT";

export interface CyclePerformance {
  /** O que a pessoa realmente ficou com: sobra do ciclo + o que investiu. */
  kept: number;
  /** Tudo que entrou no ciclo. */
  income: number;
  /** Quanto saiu para investimento. */
  invested: number;
}

/**
 * `null` quando não há ciclo carregado — e a tela mostra o pote no estado
 * padrão, nunca no vermelho: vermelho sem dado acusaria o usuário de um
 * resultado que ninguém mediu.
 */
export function cyclePerformance(
  monthly: MonthlyAnalytics | null | undefined,
): CyclePerformance | null {
  if (!monthly) return null;

  const invested = (monthly.categories ?? [])
    .filter((slice) => slice.systemKey === INVESTMENT_ROOT)
    .reduce((sum, slice) => sum + (slice.expenseTotal ?? 0), 0);

  return {
    kept: monthly.net + invested,
    income: monthly.totalIncome,
    invested,
  };
}

/**
 * A frase que explica o estado do pote no cartão do mês. Fica separada do
 * rótulo curto de {@code potStateFor} porque aqui há espaço para dizer POR QUE
 * o pote está daquele tamanho — e é isso que ensina a ler o ícone.
 */
export function describePotReason(
  performance: CyclePerformance | null,
): string | null {
  if (!performance || performance.income <= 0) return null;
  if (performance.invested > 0) {
    // sem esta frase, quem investiu acharia que o app ignorou a aplicação
    return "Contando o que você investiu como guardado";
  }
  if (performance.kept < 0) return "Saiu mais do que entrou neste ciclo";
  return null;
}
