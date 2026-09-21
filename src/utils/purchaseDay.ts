import type {
  IncomePattern,
  IncomeSourceKind,
  IncomeSourcePattern,
  PatternConfidence,
  PatternOrigin,
  PurchaseAdvice,
  PurchaseCadence,
  PurchaseInference,
  PurchasePaymentMode,
  PurchasePreference,
} from "../services/api";
import type { LastPurchaseAdvice } from "../store/preferencesStore";
import {
  formatDayMonth,
  formatWeekdayDayMonth,
  parseIsoDate,
} from "./cycleWindow";
import { ROTULOS, type ForecastOriginLabel } from "./forecastOrigin";

/**
 * As frases do melhor dia de compra (EC-237) — puras, sem tela.
 *
 * <p>O servidor manda a recomendação com faixa, origem, confiança e o que a
 * sustentou. O que ele NÃO manda é a leitura que a tela faz disso: o selo,
 * o rodapé, a faixa escrita em português e o aviso de "recalculado". Tudo
 * isso mora aqui para o card, a linha da Home e a tela de renda dizerem a
 * mesma coisa com as mesmas palavras — e para o teste cobrar a frase sem
 * montar componente.
 */

/**
 * O selo de origem do padrão, reaproveitando os rótulos da previsão (EC-206).
 * `MEASURED` é "medido no seu extrato"; `INFORMED` é "informado por você".
 */
export function patternOriginLabel(origin: PatternOrigin): ForecastOriginLabel {
  if (origin === "MEASURED") return { kind: "measured", ...ROTULOS.measured };
  return { kind: "declared", ...ROTULOS.declared };
}

export function confidenceLabel(
  confidence: PatternConfidence | null | undefined,
): string | null {
  switch (confidence) {
    case "HIGH":
      return "confiança alta";
    case "MEDIUM":
      return "confiança média";
    case "LOW":
      return "confiança baixa";
    default:
      return null;
  }
}

/** "3 meses observados · confiança média" — o rodapé que qualifica a data. */
export function basisFooter(
  monthsObserved: number | null | undefined,
  confidence: PatternConfidence | null | undefined,
): string | null {
  const partes: string[] = [];
  if (monthsObserved != null && monthsObserved > 0) {
    partes.push(
      monthsObserved === 1
        ? "1 mês observado"
        : `${monthsObserved} meses observados`,
    );
  }
  const conf = confidenceLabel(confidence);
  if (conf) partes.push(conf);
  return partes.length > 0 ? partes.join(" · ") : null;
}

/**
 * "entre 06 e 08/10" quando os extremos caem no mesmo mês; "entre 29/09 e
 * 02/10" quando atravessam a virada; "em 07/10" quando não há faixa. A faixa
 * é obrigatória porque três meses de vale já mostraram dispersão de dois a
 * três dias úteis — um dia só seria precisão que o histórico não sustenta.
 */
export function formatRange(
  earliest: string | null | undefined,
  latest: string | null | undefined,
): string | null {
  if (!earliest || !latest) return null;
  if (earliest === latest) return `em ${formatDayMonth(earliest)}`;
  const a = parseIsoDate(earliest);
  const b = parseIsoDate(latest);
  if (a && b && a.year === b.year && a.month === b.month) {
    return `entre ${String(a.day).padStart(2, "0")} e ${formatDayMonth(latest)}`;
  }
  return `entre ${formatDayMonth(earliest)} e ${formatDayMonth(latest)}`;
}

/** A palavra curta com que a frase chama cada fonte. */
export function fundingNoun(kind: IncomeSourceKind | null | undefined): string {
  switch (kind) {
    case "SALARY":
      return "salário";
    case "MEAL_VOUCHER":
    case "FOOD_VOUCHER":
      return "vale";
    case "ADVANCE":
      return "adiantamento";
    default:
      return "dinheiro";
  }
}

/**
 * A fonte que paga o mercado, procurada pelo `fundingSource` da recomendação.
 * Sem ela, a primeira fonte com queda futura — melhor uma frase sobre o
 * salário do que nenhuma.
 */
export function fundingSourceOf(
  pattern: IncomePattern,
): IncomeSourcePattern | null {
  const kind = pattern.advice?.fundingSource ?? null;
  const porTipo = kind
    ? pattern.sources.find((s) => s.kind === kind && s.upcoming.length > 0)
    : null;
  return porTipo ?? pattern.sources.find((s) => s.upcoming.length > 0) ?? null;
}

/**
 * A linha da Home: "sáb 03/10 · o vale cai por volta de 28/09". A frase
 * junta o dia e o motivo dele numa linha só, porque na Home ninguém abre um
 * card para saber por quê — ou a razão cabe ao lado, ou não é lida.
 */
export function homeLine(
  pattern: IncomePattern | null,
): { day: string; spokenDay: string; detail: string | null } | null {
  if (!pattern || pattern.status !== "READY" || !pattern.advice) return null;
  const advice = pattern.advice;
  const fonte = fundingSourceOf(pattern);
  const queda = fonte?.upcoming[0]?.expected ?? advice.fundingDate;
  const detail = queda
    ? `o ${fundingNoun(fonte?.kind ?? advice.fundingSource)} cai por volta de ${formatDayMonth(queda)}`
    : null;
  return {
    day: formatWeekdayDayMonth(advice.bestDay),
    spokenDay: advice.bestDay,
    detail,
  };
}

/**
 * O aviso de prestação de contas (EC-202): a data mudou E uma queda nova a
 * sustentou. Só a segunda condição justifica a primeira — se o dia mudou sem
 * queda nova, foi preferência (a pessoa sabe) ou mês virando (o card já diz).
 */
export function adviceChanged(
  previous: LastPurchaseAdvice | null | undefined,
  next: PurchaseAdvice | null | undefined,
): { from: string; to: string; trigger: string | null } | null {
  if (!previous || !next) return null;
  if (previous.bestDay === next.bestDay) return null;
  const antes = previous.basisLastOccurrence;
  const agora = next.basis?.lastOccurrence ?? null;
  // Sem data de queda na resposta anterior (servidor antigo) não há como
  // afirmar o gatilho, e afirmar sem saber é o que este aviso existe para
  // impedir
  if (!agora || !antes || agora <= antes) return null;
  return { from: previous.bestDay, to: next.bestDay, trigger: agora };
}

/** A frase do aviso, já com as datas escritas. */
export function describeChange(
  change: { from: string; to: string; trigger: string | null },
  fundingKind: IncomeSourceKind | null | undefined,
): string {
  const gatilho = change.trigger
    ? `depois que o ${fundingNoun(fundingKind)} de ${formatDayMonth(change.trigger)} entrou`
    : "com o extrato novo";
  return `Recalculado ${gatilho}: o dia sugerido passou de ${formatWeekdayDayMonth(change.from)} para ${formatWeekdayDayMonth(change.to)}.`;
}

/**
 * A frase honesta de quem ainda não tem padrão. A do servidor vence; sem
 * ela, a contagem do que já foi visto — nunca uma data inventada.
 */
export function insufficientHistoryText(pattern: IncomePattern): string {
  if (pattern.message) return pattern.message;
  const vistos = Math.max(
    0,
    ...pattern.sources.map((s) => s.pattern?.monthsObserved ?? 0),
  );
  if (vistos === 0) {
    return "Ainda não vi nenhum pagamento no seu extrato. A partir de 3 meses eu digo o padrão.";
  }
  return `Vi só ${vistos === 1 ? "1 pagamento" : `${vistos} pagamentos`}; a partir de 3 meses eu digo o padrão.`;
}

export function cadenceLabel(cadence: PurchaseCadence): string {
  return cadence === "WEEKLY" ? "Semanal" : "Mensal";
}

export function paymentLabel(
  mode: PurchasePaymentMode | null | undefined,
  cardName?: string | null,
): string {
  if (mode === "CARD") return cardName ? `no ${cardName}` : "no cartão";
  return "no dinheiro da conta";
}

/**
 * O resumo do card "Como você faz as compras": o que a pessoa declarou ou,
 * sem declaração, o que o app deduziu — dizendo qual dos dois é.
 */
export function preferenceSummary(
  preference: PurchasePreference | null | undefined,
  inferred: PurchaseInference | null | undefined,
  cardName?: string | null,
): string {
  if (preference) {
    const partes = [cadenceLabel(preference.cadence)];
    if (preference.weekendPreferred) partes.push("fim de semana");
    partes.push(paymentLabel(preference.paymentMode, cardName));
    return partes.join(" · ");
  }
  if (inferred) {
    const partes = [cadenceLabel(inferred.cadence).toLowerCase()];
    if (inferred.weekendShare != null && inferred.weekendShare >= 0.5) {
      partes.push("fim de semana");
    }
    const meses =
      inferred.monthsObserved > 0
        ? ` (${inferred.monthsObserved === 1 ? "1 mês" : `${inferred.monthsObserved} meses`} de extrato)`
        : "";
    return `Deduzido do extrato: ${partes.join(" · ")}${meses}`;
  }
  return "Diga se compra por mês ou por semana, e com o quê";
}
