/**
 * Aritmética do ciclo financeiro e exibição de datas em UTC (EC-092).
 *
 * O mês do usuário raramente começa no dia 1: ele começa quando o salário cai.
 * A "âncora" é esse dia, e daqui saem as duas coisas que a tela precisa — a
 * janela visível (`start`/`end`, ambos inclusivos) e o recorte que vai para a
 * API (mês de calendário OU janela).
 *
 * Tudo aqui é UTC e trabalha com strings `yyyy-MM-dd`, porque é isso que a API
 * usa: a data da transação é a de lançamento em UTC, e converter para o fuso do
 * aparelho faria a virada do ciclo mudar de dia dependendo de onde o usuário
 * está.
 *
 * Este módulo é também a ÚNICA casa dos formatadores de data do app. A data de
 * lançamento é date-only gravada como meia-noite UTC; passá-la por
 * `new Date(iso).toLocaleDateString()` sem fuso entrega o dia ANTERIOR em todo
 * o Brasil (UTC−3), e foi assim que a mesma transação chegou a aparecer como
 * "31 jul" na lista e "01 de agosto" na folha de detalhes. Os formatadores
 * daqui leem a parte de data da string — o fuso do aparelho nunca entra na
 * conta. Todos aceitam tanto `yyyy-MM-dd` quanto o ISO completo da API
 * (`2026-08-01T00:00:00Z`).
 */

export const MIN_CYCLE_ANCHOR_DAY = 1;
export const MAX_CYCLE_ANCHOR_DAY = 31;
/** Dia 1: o ciclo é exatamente o mês de calendário. */
export const DEFAULT_CYCLE_ANCHOR_DAY = 1;

/** Janela inclusiva nos dois extremos, no formato que a API aceita. */
export interface CycleWindow {
  start: string;
  end: string;
}

/**
 * Recorte de período aceito pela API. É união discriminada de propósito: mandar
 * `month` junto com `start`/`end` é 400 no servidor, e um tipo que permitisse
 * os dois deixaria esse erro possível.
 */
export type AnalysisRange =
  | { kind: "month"; month: string }
  | { kind: "window"; start: string; end: string };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function clampAnchorDay(value: unknown): number {
  const day = Math.trunc(Number(value));
  if (!Number.isFinite(day)) return DEFAULT_CYCLE_ANCHOR_DAY;
  if (day < MIN_CYCLE_ANCHOR_DAY) return MIN_CYCLE_ANCHOR_DAY;
  if (day > MAX_CYCLE_ANCHOR_DAY) return MAX_CYCLE_ANCHOR_DAY;
  return day;
}

/** `month` em base 1 (1 = janeiro). */
export function daysInMonth(year: number, month: number): number {
  // dia 0 do mês seguinte é o último dia deste
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseMonthKey(
  monthKey: string,
): { year: number; month: number } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(monthKey ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function parseIsoDate(
  iso: string,
): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

export function monthKeyOf(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return `${parsed.year}-${pad2(parsed.month)}`;
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const index = parsed.year * 12 + (parsed.month - 1) + delta;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${pad2(month)}`;
}

export function addDays(iso: string, days: number): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day + days),
  );
  return isoDate(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}

export function lastDayOfMonth(monthKey: string): string {
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  return isoDate(
    parsed.year,
    parsed.month,
    daysInMonth(parsed.year, parsed.month),
  );
}

/** Hoje em UTC — o mesmo relógio que a API usa para datar o lançamento. */
export function todayIso(now: Date = new Date()): string {
  return isoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

/** Dia 1 é o único valor em que ciclo e mês de calendário coincidem. */
export function isCalendarMonthAnchor(anchorDay: number): boolean {
  return clampAnchorDay(anchorDay) === DEFAULT_CYCLE_ANCHOR_DAY;
}

/**
 * Primeiro dia do ciclo que começa no mês informado. Âncora 31 em fevereiro
 * cai para o último dia do mês — encurtar é a única saída que não abre buraco
 * entre um ciclo e o seguinte.
 */
export function cycleStart(
  anchorDay: number,
  year: number,
  month: number,
): string {
  const day = Math.min(clampAnchorDay(anchorDay), daysInMonth(year, month));
  return isoDate(year, month, day);
}

/**
 * Ciclo que COMEÇA no mês informado. Termina na véspera do ciclo seguinte, e
 * não no mesmo dia do mês que vem: com fim no próprio dia da âncora, o salário
 * do dia 12 seria contado no ciclo que fecha e no que abre. É também o que faz
 * a âncora 1 devolver exatamente o mês de calendário.
 */
export function cycleWindowForMonth(
  anchorDay: number,
  monthKey: string,
): CycleWindow {
  const parsed = parseMonthKey(monthKey) ?? parseMonthKey(monthKeyOf(todayIso()))!;
  const start = cycleStart(anchorDay, parsed.year, parsed.month);
  const next = shiftMonthKey(`${parsed.year}-${pad2(parsed.month)}`, 1);
  const nextParsed = parseMonthKey(next)!;
  const nextStart = cycleStart(anchorDay, nextParsed.year, nextParsed.month);
  return { start, end: addDays(nextStart, -1) };
}

/** Mês em que começa o ciclo que contém a data informada. */
export function cycleMonthKeyContaining(anchorDay: number, iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return monthKeyOf(todayIso());
  const startDay = Math.min(
    clampAnchorDay(anchorDay),
    daysInMonth(parsed.year, parsed.month),
  );
  const monthKey = `${parsed.year}-${pad2(parsed.month)}`;
  return parsed.day >= startDay ? monthKey : shiftMonthKey(monthKey, -1);
}

export function cycleWindowContaining(
  anchorDay: number,
  iso: string,
): CycleWindow {
  return cycleWindowForMonth(anchorDay, cycleMonthKeyContaining(anchorDay, iso));
}

/**
 * Com âncora no dia 1 seguimos mandando `month`: o comparável do servidor
 * continua sendo o mês de calendário anterior, que é o significado que o
 * usuário já aprendeu. Fora do dia 1 o recorte não é um mês, e aí vai a janela
 * — cujo comparável passa a ser a janela anterior de mesmo tamanho.
 */
export function analysisRangeForMonth(
  anchorDay: number,
  monthKey: string,
): AnalysisRange {
  if (isCalendarMonthAnchor(anchorDay)) {
    return { kind: "month", month: monthKey };
  }
  const window = cycleWindowForMonth(anchorDay, monthKey);
  return { kind: "window", start: window.start, end: window.end };
}

/**
 * Data de referência da Home. Ela responde pelo período corrente, mas quem só
 * tem extrato antigo veria a tela vazia — então, fora do mês corrente, a
 * referência é o último mês com movimento. A janela resultante aparece escrita
 * na tela, então não há mágica escondida.
 *
 * LIMITE CONHECIDO (e por que ele não se resolve aqui): o servidor devolve
 * MESES com movimento, nunca o dia. Um mês de calendário pode cair em dois
 * ciclos — com âncora no dia 12, o movimento de 01–11/05 pertence ao ciclo
 * 12/04→11/05, e o de 20/05 ao ciclo 12/05→11/06. Escolhendo o último dia do
 * mês, esta função sempre aposta no ciclo mais novo; sem o dia do lançamento
 * não existe aposta melhor. Quem desempata é `fetchHomeMonthly`, que recua um
 * ciclo quando a janela escolhida volta vazia — lá a resposta do servidor já
 * é a evidência que falta aqui.
 */
export function homeReferenceDate(
  monthsWithData: string[],
  today: string,
): string {
  const latest = monthsWithData[0];
  if (!latest) return today;
  return latest === monthKeyOf(today) ? today : lastDayOfMonth(latest);
}

/**
 * Meses-âncora que o seletor deve oferecer, do mais novo para o mais antigo.
 *
 * Em modo janela, cada mês com movimento gera DOIS ciclos alcançáveis: o que
 * começa nele e o que começa no mês anterior — porque o servidor informa o mês,
 * não o dia, e com âncora no dia 12 o movimento de 01–11/05 pertence ao ciclo
 * que abriu em abril. Oferecer só um dos dois deixava dias do histórico sem
 * chip, e o ciclo corrente sem chip marcado quando o mês anterior não teve
 * movimento.
 */
export function cycleMonthKeys(
  anchorDay: number,
  monthsWithData: string[],
): string[] {
  if (monthsWithData.length === 0) return [];
  if (isCalendarMonthAnchor(anchorDay)) return monthsWithData;
  const keys = new Set<string>();
  for (const month of monthsWithData) {
    keys.add(month);
    keys.add(shiftMonthKey(month, -1));
  }
  // `yyyy-MM` ordena igual como texto e como data — o reverse deixa o mais novo
  // na frente, que é a ordem em que o servidor entrega os meses
  return [...keys].sort().reverse();
}

/**
 * "2026-08" → "ago 2026". O Intl pt-BR abrevia com ponto ("ago."); removemos o
 * ponto para o rótulo curto dos chips e comparações.
 */
export function formatMonthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  if (!year || !m) return month;
  const name = new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(year, m - 1, 1))
    .replace(".", "");
  return `${name} ${year}`;
}

/**
 * "2026-08" → "agosto de 2026". Título de fatura: o chip abrevia, mas o
 * cabeçalho que responde "de qual mês é esta conta" fala o mês por extenso.
 */
export function formatMonthLongLabel(month: string): string {
  const parsed = parseMonthKey(month);
  if (!parsed) return month;
  const name = new Intl.DateTimeFormat("pt-BR", { month: "long" }).format(
    new Date(parsed.year, parsed.month - 1, 1),
  );
  return `${name} de ${parsed.year}`;
}

function monthShortName(year: number, month: number): string {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(year, month - 1, 1))
    .replace(".", "");
}

/** "2026-08-12" → "12/08". */
export function formatDayMonth(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return `${pad2(parsed.day)}/${pad2(parsed.month)}`;
}

/** "2026-08-01T00:00:00Z" → "01 ago". Formato das listas de transação. */
export function formatDayMonthShort(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return `${pad2(parsed.day)} ${monthShortName(parsed.year, parsed.month)}`;
}

/**
 * "2026-08-01T00:00:00Z" → "01 de agosto de 2026". Data por extenso da folha de
 * detalhes; o meio-dia na construção é folga contra qualquer arredondamento de
 * fuso, e o `timeZone` explícito é quem garante o dia.
 */
export function formatLongDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12));
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

/** "12/07 → 11/08" — o recorte exato que está sendo somado. */
export function formatWindowLabel(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  // Defensivo de propósito: o app roda contra a API de produção, que pode
  // estar uma versão atrás e responder sem `start`/`end`. Sem janela, quem
  // chama volta para o rótulo de mês.
  if (!start || !end) return null;
  return `${formatDayMonth(start)} → ${formatDayMonth(end)}`;
}

function spokenDate(iso: string, withYear: boolean): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const date = new Date(
    Date.UTC(parsed.year, parsed.month - 1, parsed.day, 12),
  );
  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(date);
}

/** Versão falada da janela, para `accessibilityLabel`. */
export function describeWindow(
  start: string | null | undefined,
  end: string | null | undefined,
): string | null {
  if (!start || !end) return null;
  return `de ${spokenDate(start, false)} a ${spokenDate(end, true)}`;
}

/**
 * Rótulo do chip do seletor. Em modo janela o chip identifica o ciclo pelo dia
 * em que ele abre ("12 ago"); o recorte completo fica no cabeçalho, para o chip
 * não virar uma linha de texto.
 */
export function cycleChipLabel(anchorDay: number, monthKey: string): string {
  if (isCalendarMonthAnchor(anchorDay)) return formatMonthLabel(monthKey);
  const parsed = parseMonthKey(monthKey);
  if (!parsed) return monthKey;
  const start = parseIsoDate(cycleStart(anchorDay, parsed.year, parsed.month))!;
  return `${start.day} ${monthShortName(parsed.year, parsed.month)}`;
}
