import type { ForecastMonth, InstallmentOverview } from "../services/api";
import { forecastPeriodLabel } from "./recurrence";
import type { CommitmentMonth } from "../components/CommitmentTimeline";

/**
 * Monta a linha do tempo de compromisso a partir do que o app já tem — EC-226.
 *
 * <p><b>As três fontes, e por que separá-las.</b> Somar tudo num número só
 * responde "quanto", mas não responde "de quê" — e as três dívidas se
 * comportam de forma diferente: parcela **acaba** numa data conhecida, fatura
 * varia com o consumo do mês, e recorrência continua até alguém cancelar.
 * Quem vê a proporção sabe qual delas dá para mexer.
 *
 * <p><b>Recorrência: só EXPENSE, e só o que ainda não caiu.</b> A previsão
 * traz receita e despesa no mesmo saco de itens; somar a receita aqui faria a
 * barra de "o que já tem dono" encolher quando entra dinheiro, que é o
 * contrário do que ela mede. E ocorrência já conciliada (`settled`) saiu da
 * conta porque já saiu da conta bancária — contá-la de novo cobraria duas
 * vezes.
 */
export function buildCommitmentTimeline(
  months: ForecastMonth[],
  installments: InstallmentOverview | null,
  maxMonths = 6,
): CommitmentMonth[] {
  if (months.length === 0) return [];

  // Parcelas por mês: cada série aberta cobra o mesmo valor até o último mês
  // dela. `lastMonth` é `YYYY-MM` e vem da projeção do EC-217
  const parcelasPorMes = new Map<string, number>();
  for (const serie of installments?.series ?? []) {
    if (serie.finished || serie.remaining <= 0) continue;
    // Do próximo mês até o último da série, uma parcela em cada
    for (let i = 0; i < serie.remaining; i += 1) {
      const chave = addMonths(serie.lastMonth, -(serie.remaining - 1 - i));
      parcelasPorMes.set(
        chave,
        (parcelasPorMes.get(chave) ?? 0) + serie.installmentAmount,
      );
    }
  }

  return months.slice(0, maxMonths).map((mes) => {
    const chave = mes.month.slice(0, 7);
    const recorrencias = mes.items
      .filter((item) => item.flow === "EXPENSE" && !item.settled)
      .reduce((soma, item) => soma + Math.abs(item.amount), 0);

    return {
      month: chave,
      label: forecastPeriodLabel(mes).short,
      installments: parcelasPorMes.get(chave) ?? 0,
      // A fatura prevista já entra nas recorrências quando existe série para
      // ela; separar exigiria uma fonte que a previsão ainda não devolve, e
      // inventar a separação seria pior do que somar honestamente
      invoice: 0,
      recurring: recorrencias,
    };
  });
}

/** `YYYY-MM` mais (ou menos) N meses, sem passar por `Date`. */
export function addMonths(yearMonth: string, delta: number): string {
  const [ano, mes] = yearMonth.split("-").map(Number);
  if (!Number.isFinite(ano) || !Number.isFinite(mes)) return yearMonth;
  // Base zero para o módulo funcionar com delta negativo
  const total = ano * 12 + (mes - 1) + delta;
  const novoAno = Math.floor(total / 12);
  const novoMes = total - novoAno * 12 + 1;
  return `${novoAno}-${String(novoMes).padStart(2, "0")}`;
}
