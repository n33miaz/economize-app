import {
  addDays,
  cycleMonthKeyContaining,
  cycleWindowForMonth,
  formatDayMonthShort,
  isoDate,
  parseIsoDate,
  shiftMonthKey,
} from "./cycleWindow";

import type { ReportPeriod } from "../store/reportsStore";

/**
 * As janelas que o usuário pode pedir num relatório (EC-047).
 *
 * <p>Antes disto o botão gerava sempre o período CORRENTE — o único que ainda
 * está acontecendo, e por isso o menos útil de todos. O mês fechado é o que se
 * quer olhar, e não havia como pedir.
 *
 * <p>A regra do mensal é a âncora do usuário (EC-092), a mesma da Home e da
 * Análise: quem recebe dia 5 tem "julho" começando em 05/07.
 */

/** Quantas janelas passadas a folha oferece. */
export const JANELAS_OFERECIDAS = 6;

export interface ReportWindow {
  /** "01 jul → 31 jul" */
  label: string;
  startIso: string;
  endIso: string;
  /**
   * Se a janela ainda não fechou. O fim dela é HOJE, e não a data futura de
   * fechamento: relatório que termina no futuro vende como fechado um período
   * que ainda está acontecendo.
   */
  emAndamento: boolean;
}

export function reportWindows(
  period: ReportPeriod,
  anchorDay: number,
  today: string,
  count: number = JANELAS_OFERECIDAS,
): ReportWindow[] {
  const janelas: ReportWindow[] = [];
  for (let i = 0; i < count; i += 1) {
    const bruta = janelaCrua(period, anchorDay, today, i);
    if (bruta === null) continue;
    const emAndamento = bruta.end > today;
    janelas.push({
      startIso: bruta.start,
      endIso: emAndamento ? today : bruta.end,
      emAndamento,
      label: `${formatDayMonthShort(bruta.start)} → ${formatDayMonthShort(
        emAndamento ? today : bruta.end,
      )}`,
    });
  }
  return janelas;
}

function janelaCrua(
  period: ReportPeriod,
  anchorDay: number,
  today: string,
  atras: number,
): { start: string; end: string } | null {
  if (period === "MONTHLY") {
    const atual = cycleMonthKeyContaining(anchorDay, today);
    return cycleWindowForMonth(anchorDay, shiftMonthKey(atual, -atras));
  }
  if (period === "WEEKLY") {
    // Blocos de sete dias contados de hoje para trás — a mesma regra que o
    // botão já usava, só deslocada. Semana ISO exigiria explicar ao usuário
    // por que "esta semana" começa na segunda
    const end = addDays(today, -7 * atras);
    return { start: addDays(end, -6), end };
  }
  // Anual: blocos de doze meses, também contados de hoje
  const fim = shiftPorMeses(today, -12 * atras);
  if (fim === null) return null;
  const inicio = shiftPorMeses(fim, -12);
  if (inicio === null) return null;
  return { start: addDays(inicio, 1), end: fim };
}

/** Desloca uma data ISO em meses, encurtando para o último dia quando falta. */
function shiftPorMeses(iso: string, meses: number): string | null {
  const parsed = parseIsoDate(iso);
  if (!parsed) return null;
  const indice = parsed.year * 12 + (parsed.month - 1) + meses;
  const ano = Math.floor(indice / 12);
  const mes = (indice % 12) + 1;
  const ultimo = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  return isoDate(ano, mes, Math.min(parsed.day, ultimo));
}

/** O intervalo em ISO 8601 completo, que é o que o servidor recebe. */
export function toInstantRange(window: ReportWindow): {
  startDate: string;
  endDate: string;
} {
  return {
    startDate: `${window.startIso}T00:00:00.000Z`,
    // Fim do dia: com T00:00 o último dia do período ficaria de fora, e o
    // relatório perderia justamente o dia do fechamento
    endDate: `${window.endIso}T23:59:59.999Z`,
  };
}
