import type {
  AccountInvoice,
  AccountType,
  BankTransaction,
  ConnectorAccount,
  InvoiceCycleSource,
} from "../services/api";
import {
  formatDayMonth,
  formatMonthLongLabel,
  parseMonthKey,
  shiftMonthKey,
} from "./cycleWindow";
import { formatBRL } from "./money";

/**
 * Origem do lançamento e leitura de fatura (EC-113).
 *
 * A regra que rege este arquivo inteiro: **origem nula é estado normal**, não
 * falha. Todo o histórico anterior à dimensão de conta e todo upload manual de
 * OFX/CSV chegam sem `accountId`, porque o arquivo do banco não diz de qual
 * cartão ele é. Quem lê uma transação sem origem precisa ver "origem não
 * informada" — nunca um erro, nunca um espaço em branco que pareça defeito.
 *
 * A segunda regra: o `total` da fatura vem PRONTO do servidor e nunca é
 * recalculado aqui. `purchasesTotal`, `refundsTotal` e `paymentsTotal` existem
 * para EXPLICAR o total, não para reproduzi-lo — e `paymentsTotal` fica fora
 * dele de propósito: pagar a fatura é dinheiro saindo da conta corrente, não
 * receita nem abatimento de gasto.
 */

/** O que a tela diz quando `accountId` é nulo. */
export const UNKNOWN_ORIGIN_LABEL = "Origem não informada";

/** Frase curta do mesmo estado, para caber em linha de detalhe. */
export const UNKNOWN_ORIGIN_SHORT = "Não informada";

/**
 * Caso diferente do anterior, e que não pode vestir a mesma frase: o
 * lançamento TEM origem, mas ela não está no mapa de contas — porque
 * `/accounts` falhou nesta sessão, ou porque a conta sumiu no provedor entre
 * uma chamada e outra. Dizer "não informada" aqui seria afirmar que o dado não
 * existe quando ele existe e nós é que não o temos.
 */
export const UNLISTED_ORIGIN_LABEL = "Origem não reconhecida";
export const UNLISTED_ORIGIN_SHORT = "Não reconhecida";

/** Rótulo do selo de origem, cobrindo os três estados possíveis. */
export function originLabel(
  accountId: string | null | undefined,
  account: ConnectorAccount | null | undefined,
): string {
  if (account) return accountDisplayName(account);
  return accountId ? UNLISTED_ORIGIN_LABEL : UNKNOWN_ORIGIN_LABEL;
}

/** Mesma decisão, na forma curta da folha de detalhes. */
export function originShortLabel(
  accountId: string | null | undefined,
  account: ConnectorAccount | null | undefined,
): string {
  if (account) return accountDisplayName(account);
  return accountId ? UNLISTED_ORIGIN_SHORT : UNKNOWN_ORIGIN_SHORT;
}

export function isCreditCard(
  account: ConnectorAccount | undefined | null,
): boolean {
  return account?.type === "CREDIT_CARD";
}

export function accountKindLabel(type: AccountType): string {
  // "Conta" e não "conta corrente": poupança também chega como BANK, e o
  // provedor não distingue as duas
  return type === "CREDIT_CARD" ? "Cartão de crédito" : "Conta";
}

/** Nome de exibição, com a resposta honesta para a transação sem origem. */
export function accountDisplayName(
  account: ConnectorAccount | undefined | null,
): string {
  const name = account?.name?.trim();
  if (name) return name;
  if (account) return accountKindLabel(account.type);
  return UNKNOWN_ORIGIN_LABEL;
}

/**
 * Linha de apoio da conta: instituição, tipo e o ciclo do cartão quando o
 * provedor informou. Sem dia de fechamento a frase simplesmente não promete
 * um corte — quem avisa que o período é aproximado é a tela da fatura, que
 * conhece o `cycleSource`.
 */
export function accountSubtitle(account: ConnectorAccount): string {
  const parts: string[] = [];
  if (account.institution) parts.push(account.institution);
  parts.push(accountKindLabel(account.type).toLowerCase());
  if (account.statementClosingDay) {
    parts.push(`fecha dia ${account.statementClosingDay}`);
  }
  if (account.statementDueDay) {
    parts.push(`vence dia ${account.statementDueDay}`);
  }
  if (!account.linked) {
    // Desvincular a instituição não apaga a origem: o histórico continua
    // identificado, o que acabou foi a sincronização
    parts.push("conexão removida");
  }
  return parts.join(" · ");
}

export function indexAccounts(
  accounts: ConnectorAccount[],
): Map<string, ConnectorAccount> {
  return new Map(accounts.map((account) => [account.id, account]));
}

export function creditCardAccounts(
  accounts: ConnectorAccount[],
): ConnectorAccount[] {
  return accounts.filter(isCreditCard);
}

// --- Filtro de origem ---

export const ORIGIN_ALL = "all";
export const ORIGIN_NONE = "none";

/** `all`, `none` ou o id da conta. */
export type OriginFilterKey = string;

export interface OriginFilterOption {
  key: OriginFilterKey;
  label: string;
  /** Quantas transações da lista atual caem neste filtro. */
  count: number;
  /** Null em "Tudo" e em "Sem origem". */
  account: ConnectorAccount | null;
}

/**
 * Opções do filtro de origem, derivadas da lista que está na tela.
 *
 * Duas decisões que importam:
 *
 * 1. **Conta sem lançamento não vira chip.** Um chip que filtra para o vazio é
 *    um beco: o usuário toca, a lista some e ele culpa o app. A conta continua
 *    existindo e aparece na tela de faturas, que é onde ela tem o que dizer.
 * 2. **"Sem origem" só existe quando existe.** Quem sincronizou tudo pelo
 *    conector nunca vê esse chip; quem tem histórico antigo vê, e é assim que
 *    ele descobre que aquelas linhas não são de nenhum cartão.
 *
 * Cartões vêm antes das contas porque o pedido é sobre cartão — e dentro de
 * cada grupo a ordem é a que o servidor mandou, que é estável entre recargas.
 */
export function originFilterOptions(
  accounts: ConnectorAccount[],
  transactions: BankTransaction[],
): OriginFilterOption[] {
  const counts = new Map<string, number>();
  let withoutOrigin = 0;
  for (const tx of transactions) {
    if (!tx.accountId) {
      withoutOrigin += 1;
      continue;
    }
    counts.set(tx.accountId, (counts.get(tx.accountId) ?? 0) + 1);
  }

  const withCount = accounts.filter(
    (account) => (counts.get(account.id) ?? 0) > 0,
  );
  const cards = withCount.filter(isCreditCard);
  const banks = withCount.filter((account) => !isCreditCard(account));

  // Enquanto NENHUM lançamento tem origem conhecida, a dimensão inteira não
  // existe para este usuário — e "Tudo × Sem origem" seria um par de chips que
  // filtra exatamente a mesma lista. Quem só importa OFX na mão nunca vê esta
  // barra, e é assim que ela deixa de ser ruído.
  if (cards.length === 0 && banks.length === 0) return [];

  // Origem conhecida pela transação mas ausente de `/accounts` (conta apagada
  // no provedor entre uma chamada e outra): sem chip próprio, essas linhas
  // continuam contadas em "Tudo" — some o atalho, nunca o lançamento
  const options: OriginFilterOption[] = [
    { key: ORIGIN_ALL, label: "Tudo", count: transactions.length, account: null },
    ...[...cards, ...banks].map((account) => ({
      key: account.id,
      label: accountDisplayName(account),
      count: counts.get(account.id) ?? 0,
      account,
    })),
  ];

  if (withoutOrigin > 0) {
    options.push({
      key: ORIGIN_NONE,
      label: "Sem origem",
      count: withoutOrigin,
      account: null,
    });
  }

  return options;
}

export function applyOriginFilter(
  transactions: BankTransaction[],
  key: OriginFilterKey,
): BankTransaction[] {
  if (key === ORIGIN_ALL) return transactions;
  if (key === ORIGIN_NONE) return transactions.filter((tx) => !tx.accountId);
  return transactions.filter((tx) => tx.accountId === key);
}

/**
 * O filtro selecionado sobrevive à recarga da lista? Uma conta pode perder
 * todos os lançamentos (revisão moveu, sincronização removeu) e o chip some —
 * sem isto, a tela ficaria presa num filtro invisível mostrando lista vazia.
 */
export function resolveOriginFilter(
  key: OriginFilterKey,
  options: OriginFilterOption[],
): OriginFilterKey {
  return options.some((option) => option.key === key) ? key : ORIGIN_ALL;
}

/** Rótulo falado do estado do filtro, para o resumo da lista. */
export function describeOriginFilter(
  key: OriginFilterKey,
  options: OriginFilterOption[],
): string {
  const selected = options.find((option) => option.key === key);
  if (!selected || selected.key === ORIGIN_ALL) return "Todas as origens";
  if (selected.key === ORIGIN_NONE) return UNKNOWN_ORIGIN_LABEL;
  return selected.label;
}

// --- Fatura ---

export function invoiceCycleIsApproximate(source: InvoiceCycleSource): boolean {
  return source === "CALENDAR_MONTH";
}

/**
 * O aviso do corte derivado. Ele é específico de propósito: dizer só
 * "aproximado" faria o usuário desconfiar do valor, quando o que varia é a
 * BORDA — uma compra do fim do mês pode estar na fatura seguinte no app do
 * banco.
 */
export const INVOICE_APPROX_TITLE = "Período aproximado";
export const INVOICE_APPROX_NOTE =
  "O banco não informou o dia de fechamento deste cartão, então usamos o mês " +
  "de calendário. Uma compra do fim do mês pode aparecer na fatura seguinte " +
  "no app do banco.";

export function invoiceStatusLabel(invoice: AccountInvoice): string {
  return invoice.open ? "Em aberto" : "Fechada";
}

/**
 * Fatura com estorno maior que compras: o `total` vem NEGATIVO e o usuário não
 * deve nada — tem crédito a receber. Chamar isso de "TOTAL" em cor neutra faz
 * um saldo a favor parecer dívida, então o rótulo muda junto com o sinal. O
 * VALOR continua o do servidor, com sinal e tudo: é o número que o usuário
 * compara com o app do banco, e abreviar o sinal já seria recalcular.
 */
export function invoiceIsCredit(invoice: AccountInvoice): boolean {
  return invoice.total < 0;
}

/** "CRÉDITO" / "PARCIAL" / "TOTAL" — o que aquele número é. */
export function invoiceAmountLabel(invoice: AccountInvoice): string {
  if (invoiceIsCredit(invoice)) return "CRÉDITO";
  return invoice.open ? "PARCIAL" : "TOTAL";
}

export interface InvoiceBreakdownRow {
  key: "purchases" | "refunds" | "payments";
  label: string;
  value: number;
  /** Quando presente, explica por que a linha não fecha com o total. */
  hint?: string;
}

/**
 * As partes que explicam o total, na ordem em que se lê a conta.
 *
 * Estorno e pagamento só aparecem quando existem — linha zerada em fatura
 * comum é ruído. E o pagamento carrega a ressalva escrita: ele NÃO entra no
 * total e não é receita, que é justamente o erro de leitura que a separação
 * entre estorno e pagamento existe para evitar.
 */
export function invoiceBreakdown(invoice: AccountInvoice): InvoiceBreakdownRow[] {
  const rows: InvoiceBreakdownRow[] = [
    { key: "purchases", label: "Compras", value: invoice.purchasesTotal },
  ];
  if (invoice.refundsTotal > 0) {
    rows.push({
      key: "refunds",
      label: "Estornos",
      value: invoice.refundsTotal,
      hint: "já descontados do total",
    });
  }
  if (invoice.paymentsTotal > 0) {
    rows.push({
      key: "payments",
      label: "Pagamentos",
      value: invoice.paymentsTotal,
      hint: "não entra no total",
    });
  }
  return rows;
}

/**
 * Um buraco na linha do tempo, guardado pelos EXTREMOS e pela contagem.
 *
 * A versão anterior materializava a lista de meses com teto de 24 e depois
 * resumia por `months[0]`/`months[months.length - 1]`. Num cartão dormente
 * (faturas em 2026-08 e 2024-01) o teto cortava o array em 2024-08 e a tela
 * escrevia "sem lançamentos de agosto de 2024 a julho de 2026" logo acima do
 * card de JANEIRO de 2024: seis meses sumiam do resumo e da lista ao mesmo
 * tempo. Guardar `from`/`to`/`count` calculados por índice não tem teto, não
 * aloca nada e não pode divergir do que está desenhado embaixo.
 */
export interface InvoiceGap {
  /** Mês mais antigo sem fatura (`yyyy-MM`). */
  from: string;
  /** Mês mais recente sem fatura. */
  to: string;
  /** Quantos ciclos o buraco cobre. */
  count: number;
}

export type InvoiceTimelineItem =
  | { kind: "invoice"; key: string; invoice: AccountInvoice }
  | { kind: "gap"; key: string; gap: InvoiceGap };

/** Meses decorridos desde o ano 0 — só serve para subtrair duas referências. */
function monthIndex(monthKey: string): number | null {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return null;
  return parsed.year * 12 + (parsed.month - 1);
}

/** O buraco entre duas referências, ou `null` quando elas são vizinhas. */
export function invoiceGapBetween(
  newer: string,
  older: string,
): InvoiceGap | null {
  const a = monthIndex(newer);
  const b = monthIndex(older);
  if (a === null || b === null) return null;
  const count = a - b - 1;
  if (count <= 0) return null;
  return { from: shiftMonthKey(older, 1), to: shiftMonthKey(newer, -1), count };
}

/**
 * A lista de faturas com os ciclos vazios marcados.
 *
 * A API **omite** ciclo sem lançamento, então um extrato com dezembro e
 * outubro deixaria novembro invisível — e "não gastei em novembro" é
 * informação, não ausência dela. Aqui o buraco vira item explícito.
 *
 * A ordenação é defensiva: o contrato garante a fatura em aberto primeiro, mas
 * não a ordem das fechadas. Ordenamos por referência decrescente (`yyyy-MM`
 * ordena igual como texto e como data), com a aberta ganhando o empate.
 */
export function buildInvoiceTimeline(
  invoices: AccountInvoice[],
): InvoiceTimelineItem[] {
  const sorted = [...invoices].sort((a, b) => {
    if (a.reference === b.reference) return Number(b.open) - Number(a.open);
    return a.reference < b.reference ? 1 : -1;
  });

  // Duas faturas FECHADAS com a mesma referência colidiriam na chave, e a
  // chave é o que marca o card aberto: uma colisão fazia um toque expandir os
  // dois cards de uma vez. O sufixo de ocorrência só aparece na repetição,
  // então o caso normal mantém a chave estável entre recargas.
  const seen = new Map<string, number>();
  const uniqueKey = (base: string) => {
    const occurrence = seen.get(base) ?? 0;
    seen.set(base, occurrence + 1);
    return occurrence === 0 ? base : `${base}#${occurrence + 1}`;
  };

  const items: InvoiceTimelineItem[] = [];
  sorted.forEach((invoice, index) => {
    const previous = sorted[index - 1];
    // Referência que o parser não entende não gera buraco inventado: sem mês
    // válido dos dois lados, a única resposta honesta é não afirmar nada
    const gap = previous
      ? invoiceGapBetween(previous.reference, invoice.reference)
      : null;
    if (gap) {
      items.push({ kind: "gap", key: uniqueKey(`gap-${gap.from}-${gap.to}`), gap });
    }
    items.push({
      kind: "invoice",
      key: uniqueKey(`${invoice.reference}-${invoice.open ? "aberta" : "fechada"}`),
      invoice,
    });
  });
  return items;
}

/**
 * "Sem lançamentos em julho de 2026" / "… de maio a julho de 2026 · 3 ciclos".
 *
 * A contagem entra a partir de dois porque o resumo cita só os extremos: sem
 * ela, um buraco de 3 e um de 30 meses se leem igual.
 */
export function describeInvoiceGap(gap: InvoiceGap | null): string {
  if (!gap || gap.count <= 0) return "";
  if (gap.count === 1) {
    return `Sem lançamentos em ${formatMonthLongLabel(gap.from)}`;
  }
  return (
    `Sem lançamentos de ${formatMonthLongLabel(gap.from)} a ` +
    `${formatMonthLongLabel(gap.to)} · ${gap.count} ciclos`
  );
}

/**
 * A frase do "pedi 6, vieram 4".
 *
 * A API omite ciclo sem lançamento, então uma janela de 6 pode devolver 4
 * faturas fechadas — e o seletor continuaria afirmando "6 meses" sobre uma
 * lista mais curta, sem explicar a diferença. Marcar o buraco da BORDA (o
 * ciclo vazio mais novo ou mais antigo da janela) exigiria a API dizer qual
 * período ela varreu; enquanto isso não existe, o honesto é declarar a
 * diferença em vez de deixar o usuário achar que perdeu histórico.
 *
 * `null` quando não há o que explicar: a janela veio cheia.
 */
export function describeInvoiceWindow(
  invoices: AccountInvoice[],
  requestedMonths: number,
): string | null {
  const closed = invoices.filter((invoice) => !invoice.open).length;
  if (closed >= requestedMonths) return null;
  return (
    `${closed} de ${requestedMonths} ${plural(requestedMonths, "ciclo fechado", "ciclos fechados")} ` +
    `${plural(closed, "tem", "têm")} lançamento. Ciclo sem movimento não vira fatura.`
  );
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Título da fatura: "Fatura de agosto de 2026". */
export function invoiceTitle(invoice: AccountInvoice): string {
  return `Fatura de ${formatMonthLongLabel(invoice.reference)}`;
}

/** "11/07 → 10/08" — o recorte exato que está sendo somado. */
export function invoicePeriodLabel(invoice: AccountInvoice): string {
  return `${formatDayMonth(invoice.periodStart)} → ${formatDayMonth(invoice.periodEnd)}`;
}

export function invoiceDueLabel(invoice: AccountInvoice): string | null {
  // Sem data de vencimento (provedor não informou) a linha não aparece, em vez
  // de mostrar um traço que parece dado faltando
  return invoice.dueDate ? `Vence em ${formatDayMonth(invoice.dueDate)}` : null;
}

/**
 * Versão falada da fatura. O valor vai por extenso porque este é o número que
 * o usuário vai conferir contra o app do banco — e o estado (aberta/fechada)
 * vem antes dele, senão o leitor de tela anuncia um valor parcial como se
 * fosse a conta final.
 */
export function describeInvoice(
  invoice: AccountInvoice,
  approximate: boolean,
): string {
  // Saldo a favor é falado como crédito, e em módulo: um leitor de tela
  // anunciando "menos duzentos reais" deixa o ouvinte montando o sinal sozinho,
  // que é justamente onde a leitura de dívida × crédito se inverte. Na TELA o
  // número continua com o sinal do servidor.
  const amount = invoiceIsCredit(invoice)
    ? `crédito de ${formatBRL(Math.abs(invoice.total))} a seu favor`
    : formatBRL(invoice.total);
  const parts = [
    invoiceTitle(invoice),
    invoice.open ? `em aberto, parcial de ${amount}` : `fechada, ${amount}`,
    `período ${invoicePeriodLabel(invoice)}${approximate ? " (aproximado)" : ""}`,
  ];
  const due = invoiceDueLabel(invoice);
  if (due) parts.push(due.toLowerCase());
  return `${parts.join(", ")}. Toque para ver os lançamentos`;
}

/**
 * Mensagem honesta para cada falha da fatura. O 404 do dono errado é
 * indistinguível de "não existe" de propósito (a API não vaza existência), e o
 * 400 de conta `BANK` é erro de navegação do app, não do usuário — por isso a
 * frase fala do que ele vê na tela, não do código.
 */
export function describeInvoiceFailure(status: number | null): string {
  if (status === 400) {
    return "Este tipo de conta não tem fatura — só cartão de crédito fecha em ciclos.";
  }
  if (status === 404) {
    return "Não encontramos este cartão na sua conta. Sincronize de novo e tente outra vez.";
  }
  if (status === 401 || status === 403) {
    return "Sua sessão expirou. Entre de novo para ver as faturas.";
  }
  return "Não foi possível carregar as faturas agora. Tente de novo.";
}
