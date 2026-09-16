import type {
  ConnectorAccount,
  InstallmentOverview,
  RecurringSeries,
} from "../services/api";
import { daysInMonth, formatDayMonth, isoDate } from "./cycleWindow";
import { nextInvoiceInstallmentLoad, openInstallments } from "./installments";
import { daysUntil, formatDueDate } from "./recurrence";

/**
 * O que vence nos próximos dias — a lista que o dono pediu para a Home.
 *
 * <p><i>"Saber as coisas/contas que eu tenho que pagar no futuro (se tiver
 * alguma muito em breve dar mais destaque nela)"</i> — pedido de 15/09/2026.
 * Antes a Home respondia com UM número ("A vencer em 30 dias: R$ X") repetido
 * em dois lugares; aqui a resposta é item a item, com data, e com a semana
 * separada do resto.
 *
 * <p><b>As três fontes, e por que nenhuma soma a outra.</b>
 * <ul>
 *   <li><b>Recorrências</b> (`recurrenceStore.series`): a única fonte com dia e
 *   valor que a pessoa reconhece. É o que entra no total.</li>
 *   <li><b>Faturas de cartão</b>: ESTIMADAS pelo dia de fechamento/vencimento
 *   que a instituição informou e pelo devido de hoje (`reportedBalance`), sem
 *   baixar fatura nenhuma — a fatura inteira traz todos os lançamentos, e a
 *   Home não pode pagar isso a cada foco. Quando existe uma recorrência de
 *   "pagamento de fatura", a linha do cartão fica FORA do total: é o mesmo
 *   dinheiro, e a recorrência é a versão que a pessoa cadastrou ou o app
 *   aprendeu do extrato.</li>
 *   <li><b>Parcelas</b>: uma linha só, agregada, e nunca no total — parcela de
 *   cartão já está dentro da fatura. Somar as duas cobraria duas vezes, que é
 *   exatamente o erro que levou o saldo do app a −R$ 20 mil uma vez.</li>
 * </ul>
 */

export const UPCOMING_WINDOW_DAYS = 30;
/** Até aqui é "esta semana": ganha a pílula de data em destaque. */
export const SOON_DAYS = 7;
/** Até aqui a pílula fala em tom de aviso. */
export const URGENT_DAYS = 3;

export type UpcomingKind = "RECURRENCE" | "INVOICE";

export type UpcomingTarget =
  | { route: "Recorrências"; seriesId: string }
  | { route: "Cartões"; accountId: string };

export interface UpcomingItem {
  key: string;
  kind: UpcomingKind;
  name: string;
  /** `null` = sem estimativa (conta de consumo sem histórico): "a confirmar". */
  amount: number | null;
  /** Valor aproximado: média de consumo, ou devido de hoje no cartão. */
  estimated: boolean;
  /** Entra no total do rodapé. Falso quando repetiria outra linha. */
  countsInTotal: boolean;
  /** ISO `YYYY-MM-DD`. */
  dueDate: string;
  daysUntil: number;
  /** Frase de apoio da linha ("Vence amanhã, 17 de set"). */
  detail: string;
  target: UpcomingTarget;
}

export interface UpcomingInstallmentsLine {
  amount: number;
  count: number;
}

export interface UpcomingOverview {
  /** 0..7 dias. */
  soon: UpcomingItem[];
  /** 8..N dias. */
  later: UpcomingItem[];
  /** Soma dos itens com valor que não repetem outro item. */
  total: number;
  count: number;
  /** Recorrências sem valor estimado: aparecem, mas fora do total. */
  unpricedCount: number;
  /** Parcelas já dentro da próxima fatura — informativo, fora do total. */
  installments: UpcomingInstallmentsLine | null;
}

export interface BuildUpcomingInput {
  series: RecurringSeries[];
  accounts: ConnectorAccount[];
  installments: InstallmentOverview | null;
  today?: Date;
  days?: number;
}

/**
 * Recorrência que é o pagamento de uma fatura de cartão. Heurística de nome,
 * de propósito conservadora: "fatura" ou "cartão" no rótulo. Quando bate, a
 * linha estimada do cartão sai do total — a recorrência já conta esse valor.
 */
export function looksLikeInvoicePayment(name: string): boolean {
  return /\bfatura\b|cart[aã]o/i.test(name);
}

/**
 * Série que é uma PARCELA de compra no cartão, e não uma conta do mês.
 *
 * <p><b>O defeito que isto fecha, visto na tela em 16/09/2026.</b> A detecção
 * de recorrências do servidor acerta ao ver "MAGAZINE LUIZA - Parcela 3/6"
 * repetindo todo mês pelo mesmo valor: é mesmo uma cobrança mensal. Só que
 * parcela de cartão <b>já está dentro da fatura</b> — e a fatura tem linha
 * própria aqui, com o valor devido inteiro. Com as duas na lista, o total
 * somava a mesma parcela duas vezes: R$ 3.414,57 onde o certo eram
 * R$ 3.002,07.
 *
 * <p>A parcela sai da lista quando existe linha de fatura para engoli-la, e
 * fica quando não existe (cartão não cadastrado) — a mesma regra que já vale
 * para a recorrência "pagamento de fatura". O rodapé do card continua dizendo
 * quanto das parcelas está na próxima fatura, que é a informação que não
 * aparece em lugar nenhum.
 */
export function looksLikeInstallment(name: string): boolean {
  return /\bparc(ela)?\s*\d+\s*\/\s*\d+/i.test(name);
}

function ymd(date: Date): { year: number; month: number; day: number } {
  return {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
}

/** ISO do dia `day` do mês, com o dia preso ao tamanho do mês (31 → 30). */
function isoOnDay(year: number, month: number, day: number): string {
  return isoDate(year, month, Math.min(day, daysInMonth(year, month)));
}

function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

interface InvoiceEstimate {
  dueDate: string;
  /** Fechamento que gera este vencimento (para a frase de apoio). */
  closingDate: string | null;
  /** A fatura já fechou: o devido de hoje é ela. */
  closed: boolean;
}

/**
 * Quando a próxima fatura do cartão vence, a partir dos DIAS informados pela
 * instituição. Sem `statementDueDay` não há vencimento a estimar; com
 * fechamento e vencimento, a regra é a do cartão: o vencimento fica no mesmo
 * mês do fechamento quando cai depois dele, e no mês seguinte quando cai
 * antes (fecha dia 25, vence dia 5).
 *
 * <p>Se o vencimento da fatura já FECHADA ainda não passou, ele é o próximo
 * (e é o caso urgente). Se passou, a próxima é a fatura ainda aberta.
 */
export function estimateNextInvoice(
  card: Pick<ConnectorAccount, "statementClosingDay" | "statementDueDay">,
  today: Date,
): InvoiceEstimate | null {
  const dueDay = card.statementDueDay;
  const closingDay = card.statementClosingDay;
  if (!dueDay) return null;
  const hoje = ymd(today);
  const hojeIso = isoDate(hoje.year, hoje.month, hoje.day);

  if (!closingDay) {
    // Só o vencimento: a próxima ocorrência do dia, hoje incluído
    const nesteMes = isoOnDay(hoje.year, hoje.month, dueDay);
    if (nesteMes >= hojeIso) {
      return { dueDate: nesteMes, closingDate: null, closed: false };
    }
    const proximo = shiftMonth(hoje.year, hoje.month, 1);
    return {
      dueDate: isoOnDay(proximo.year, proximo.month, dueDay),
      closingDate: null,
      closed: false,
    };
  }

  const dueFor = (closing: { year: number; month: number }) => {
    const mesDoVencimento =
      dueDay > closingDay ? closing : shiftMonth(closing.year, closing.month, 1);
    return isoOnDay(mesDoVencimento.year, mesDoVencimento.month, dueDay);
  };

  // Último fechamento que já aconteceu (hoje incluído)
  const ultimoFechamento =
    hoje.day >= closingDay ? { year: hoje.year, month: hoje.month } : shiftMonth(hoje.year, hoje.month, -1);
  const vencimentoDaFechada = dueFor(ultimoFechamento);
  if (vencimentoDaFechada >= hojeIso) {
    return {
      dueDate: vencimentoDaFechada,
      closingDate: isoOnDay(ultimoFechamento.year, ultimoFechamento.month, closingDay),
      closed: true,
    };
  }

  const proximoFechamento = shiftMonth(ultimoFechamento.year, ultimoFechamento.month, 1);
  return {
    dueDate: dueFor(proximoFechamento),
    closingDate: isoOnDay(proximoFechamento.year, proximoFechamento.month, closingDay),
    closed: false,
  };
}

function recurrenceItems(
  series: RecurringSeries[],
  today: Date,
  days: number,
): UpcomingItem[] {
  const itens: UpcomingItem[] = [];
  for (const item of series) {
    if (item.flow !== "EXPENSE" || !item.active || item.dismissed) continue;
    const distancia = daysUntil(item.nextDueDate, today);
    // Passado fica de fora: série detectada com `nextDueDate` atrás de hoje
    // quase sempre é extrato ainda não importado, e "atrasada" seria alarme
    // falso na primeira tela
    if (distancia === null || distancia < 0 || distancia > days) continue;
    const nome = item.displayName ?? item.merchantKey;
    itens.push({
      key: `REC:${item.id}`,
      kind: "RECURRENCE",
      name: nome,
      amount: item.expectedAmount,
      estimated: item.amountType === "VARIABLE",
      countsInTotal: item.expectedAmount != null,
      dueDate: item.nextDueDate as string,
      daysUntil: distancia,
      detail: describeDue(distancia, item.nextDueDate as string),
      target: { route: "Recorrências", seriesId: item.id },
    });
  }
  return itens;
}

function invoiceItems(
  accounts: ConnectorAccount[],
  today: Date,
  days: number,
  hasInvoiceRecurrence: boolean,
): UpcomingItem[] {
  const itens: UpcomingItem[] = [];
  for (const card of accounts) {
    if (card.type !== "CREDIT_CARD") continue;
    const estimativa = estimateNextInvoice(card, today);
    if (!estimativa) continue;
    const distancia = daysUntil(estimativa.dueDate, today);
    if (distancia === null || distancia < 0 || distancia > days) continue;
    const devido =
      card.reportedBalance != null ? Math.abs(card.reportedBalance) : null;
    const apoio = estimativa.closed
      ? `Fatura fechada · ${describeDue(distancia, estimativa.dueDate)}`
      : estimativa.closingDate
        ? `Fecha ${formatDayMonth(estimativa.closingDate)} · vence ${formatDayMonth(estimativa.dueDate)}`
        : describeDue(distancia, estimativa.dueDate);
    itens.push({
      key: `INV:${card.id}`,
      kind: "INVOICE",
      name: card.name,
      amount: devido,
      // O devido de hoje é estimativa da fatura mesmo depois do fechamento:
      // compra nova já entra nele
      estimated: true,
      countsInTotal: devido != null && !hasInvoiceRecurrence,
      dueDate: estimativa.dueDate,
      daysUntil: distancia,
      detail: apoio,
      target: { route: "Cartões", accountId: card.id },
    });
  }
  return itens;
}

/** "Vence hoje, 16 de set" / "Vence amanhã, 17 de set" / "Vence em 5 dias, 21 de set". */
export function describeDue(days: number, iso: string): string {
  const data = formatDueDate(iso);
  if (days <= 0) return `Vence hoje, ${data}`;
  if (days === 1) return `Vence amanhã, ${data}`;
  return `Vence em ${days} dias, ${data}`;
}

/** Texto da pílula de data: "hoje", "amanhã" ou "dd/mm". */
export function duePillLabel(item: Pick<UpcomingItem, "daysUntil" | "dueDate">): string {
  if (item.daysUntil <= 0) return "hoje";
  if (item.daysUntil === 1) return "amanhã";
  return formatDayMonth(item.dueDate);
}

export function buildUpcoming(input: BuildUpcomingInput): UpcomingOverview {
  const today = input.today ?? new Date();
  const days = input.days ?? UPCOMING_WINDOW_DAYS;

  const recorrencias = recurrenceItems(input.series, today, days);
  const temRecorrenciaDeFatura = recorrencias.some((item) =>
    looksLikeInvoicePayment(item.name),
  );
  const faturas = invoiceItems(input.accounts, today, days, temRecorrenciaDeFatura);

  // Parcela de cartão só aparece sozinha quando NÃO há fatura para contê-la
  const semParcelasEngolidas =
    faturas.length === 0
      ? recorrencias
      : recorrencias.filter((item) => !looksLikeInstallment(item.name));

  const todos = [...semParcelasEngolidas, ...faturas].sort(
    (a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, "pt-BR"),
  );

  const hoje = ymd(today);
  const mesCorrente = `${hoje.year}-${String(hoje.month).padStart(2, "0")}`;
  const parcelas = nextInvoiceInstallmentLoad(
    openInstallments(input.installments),
    mesCorrente,
  );

  return {
    soon: todos.filter((item) => item.daysUntil <= SOON_DAYS),
    later: todos.filter((item) => item.daysUntil > SOON_DAYS),
    total: todos.reduce(
      (soma, item) => soma + (item.countsInTotal && item.amount != null ? item.amount : 0),
      0,
    ),
    count: todos.length,
    unpricedCount: todos.filter((item) => item.amount == null).length,
    installments: parcelas.amount > 0 ? parcelas : null,
  };
}
