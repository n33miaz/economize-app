// Lógica pura das recorrências: rótulos em pt-BR, montagem dos payloads,
// leitura do ProblemDetail e as contas de "previsto × já liquidado". Vive fora
// das telas por dois motivos: é o que dá para testar sem montar árvore de
// componente, e é onde as regras do servidor são espelhadas — descobrir que
// "semanal não tem dia do mês" só depois de um 400 é jogar o erro do servidor
// na cara de quem está preenchendo o formulário.

import type {
  DetectionSummary,
  ForecastItem,
  ForecastMonth,
  RecurrenceAmountType,
  RecurrenceCadence,
  RecurrenceFlow,
  RecurrenceSource,
  RecurringSeries,
} from "../services/api";

// --- Rótulos ---

export const CADENCE_LABELS: Record<RecurrenceCadence, string> = {
  MONTHLY: "Mensal",
  WEEKLY: "Semanal",
  QUARTERLY: "Trimestral",
  // IRREGULAR é veredito da detecção ("achei repetição, mas sem ciclo"), não
  // uma opção de agendamento: aparece na leitura e nunca no formulário
  IRREGULAR: "Sem ritmo definido",
};

/** Cadências que o usuário pode agendar — o servidor recusa IRREGULAR. */
export const SCHEDULABLE_CADENCES = ["MONTHLY", "WEEKLY", "QUARTERLY"] as const;
export type SchedulableCadence = (typeof SCHEDULABLE_CADENCES)[number];

export const FLOW_LABELS: Record<RecurrenceFlow, string> = {
  EXPENSE: "Saída",
  INCOME: "Entrada",
  INTERNAL: "Transferência própria",
};

export const AMOUNT_TYPE_LABELS: Record<RecurrenceAmountType, string> = {
  FIXED: "Valor fixo",
  VARIABLE: "Valor variável",
};

export const SOURCE_LABELS: Record<RecurrenceSource, string> = {
  DETECTED: "Detectada",
  USER: "Agendada por você",
};

export function cadenceLabel(cadence: RecurrenceCadence): string {
  return CADENCE_LABELS[cadence] ?? cadence;
}

/**
 * A API projeta a cadência semanal como 4,33 ocorrências por mês (52 semanas ÷
 * 12 meses). Onde a tela fala de mês — lista, previsão, formulário — o rótulo
 * assume essa conta em vez de deixar "semanal" sugerir 4× redondas: sem isso o
 * valor mensal projetado não bate com o que o usuário multiplica de cabeça.
 */
export const WEEKLY_PER_MONTH_LABEL = "~4,3×/mês";
/** Versão falada: leitor de tela não lê "×/mês" de forma inteligível. */
export const WEEKLY_PER_MONTH_SPOKEN = "cerca de 4,3 vezes por mês";

/**
 * WEEKLY não tem dia do mês e MONTHLY/QUARTERLY não vivem sem ele — mesma
 * regra do `requireAnchorConsistency` do servidor. O formulário esconde o
 * campo em vez de esperar o 400.
 */
export function cadenceUsesAnchorDay(cadence: string): boolean {
  return cadence === "MONTHLY" || cadence === "QUARTERLY";
}

/** "Mensal · dia 30", "Semanal · ~4,3×/mês", "Trimestral · dia 5". */
export function cadenceDetailLabel(
  cadence: RecurrenceCadence,
  anchorDay: number | null,
): string {
  const base = cadenceLabel(cadence);
  if (cadence === "WEEKLY") return `${base} · ${WEEKLY_PER_MONTH_LABEL}`;
  if (!cadenceUsesAnchorDay(cadence) || anchorDay == null) return base;
  return `${base} · dia ${anchorDay}`;
}

/** O mesmo rótulo, mas pronunciável — para accessibilityLabel. */
export function cadenceSpokenLabel(
  cadence: RecurrenceCadence,
  anchorDay: number | null,
): string {
  if (cadence === "WEEKLY") {
    return `${cadenceLabel(cadence)}, ${WEEKLY_PER_MONTH_SPOKEN}`;
  }
  return cadenceDetailLabel(cadence, anchorDay);
}

/** Estado do mês corrente na lista: entrada e saída não "pagam" igual. */
export function monthStateLabel(flow: RecurrenceFlow, settled: boolean): string {
  if (!settled) return "Previsto este mês";
  return flow === "INCOME" ? "Já recebido" : "Já pago";
}

// --- Datas ---

// Nomes fixos em vez de Intl: a lista formata dezenas de datas por render e o
// resultado precisa ser idêntico em qualquer runtime (inclusive no jest)
const MONTHS_SHORT = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

function pad2(value: number): string {
  return value < 10 ? `0${value}` : String(value);
}

/**
 * "2026-09-12" → Date local. `new Date("2026-09-12")` seria meia-noite UTC e,
 * no fuso do Brasil, formataria o dia 11 — o vencimento aparecia um dia antes.
 */
export function parseIsoDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  // rejeita data que "virou" (31/02 vira 03/03): o servidor recusaria depois
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** "2026-09-12" → "12 de set". */
export function formatDueDate(iso: string | null | undefined): string {
  const date = parseIsoDate(iso);
  if (!date) return "sem data";
  return `${date.getDate()} de ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "2026-09-12" → "12/09/2026" (o formato que o campo de texto aceita). */
export function formatDateInput(iso: string | null | undefined): string {
  const date = parseIsoDate(iso);
  if (!date) return "";
  return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * "12/09/2026" (ou "2026-09-12") → ISO. Sem seletor de data nativo no projeto,
 * o campo é texto: aceitar as duas grafias evita que colar a data do servidor
 * vire erro de digitação.
 */
export function parseDateInput(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  const iso = parseIsoDate(trimmed);
  if (iso) return toIsoDate(iso);
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;
  const candidate = `${match[3]}-${pad2(Number(match[2]))}-${pad2(Number(match[1]))}`;
  const parsed = parseIsoDate(candidate);
  return parsed ? toIsoDate(parsed) : null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function daysUntil(iso: string | null | undefined, today = new Date()): number | null {
  const target = parseIsoDate(iso);
  if (!target) return null;
  const diffMs = target.getTime() - startOfDay(today).getTime();
  return Math.round(diffMs / 86400000);
}

/**
 * Frase do próximo vencimento. Série detectada sem cobrança nova fica com o
 * vencimento no passado: dizer "vence em -3 dias" seria pior que dizer que a
 * cobrança está atrasada em relação ao ritmo aprendido.
 */
export function dueSummary(
  iso: string | null | undefined,
  today = new Date(),
): string {
  const days = daysUntil(iso, today);
  if (days === null) return "Sem próximo vencimento previsto";
  const date = formatDueDate(iso);
  if (days < 0) {
    const late = Math.abs(days);
    return `Era esperada em ${date} — ${late} ${late === 1 ? "dia" : "dias"} atrás`;
  }
  if (days === 0) return `Vence hoje, ${date}`;
  if (days === 1) return `Vence amanhã, ${date}`;
  return `Vence em ${days} dias, ${date}`;
}

/** "De 01/09/2026 até 01/09/2027" — só as séries agendadas têm vigência. */
export function validityLabel(
  startsAt: string | null,
  endsAt: string | null,
): string | null {
  const start = formatDateInput(startsAt);
  const end = formatDateInput(endsAt);
  if (!start && !end) return null;
  if (start && end) return `De ${start} até ${end}`;
  if (start) return `A partir de ${start}`;
  return `Até ${end}`;
}

// --- Valores ---

/**
 * Texto do campo → número. Aceita "1.234,56", "1234,56", "1234.56" e o "R$"
 * colado por quem copia da tela. Devolve null quando não sobra número algum:
 * o campo vazio não pode virar 0 e ser aceito pelo servidor como valor.
 */
export function parseAmountInput(text: string): number | null {
  const cleaned = text.replace(/[^\d,.-]/g, "").trim();
  if (!cleaned) return null;
  let normalized: string;
  if (cleaned.includes(",")) {
    // Vírgula é o separador decimal em pt-BR; o ponto que sobra é de milhar
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
    // Sem vírgula, ponto em grupos de 3 é grafia de milhar: "2.500" é dois mil
    // e quinhentos — lê-lo como decimal gravava o valor 1000× menor em silêncio
    normalized = cleaned.replace(/\./g, "");
  } else {
    // ponto solto ("1234.56", "2.5") segue sendo decimal de quem cola número
    normalized = cleaned;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

// --- Payloads ---

export interface RecurrenceFormValues {
  displayName: string;
  flow: "EXPENSE" | "INCOME";
  cadence: SchedulableCadence;
  /** Texto do campo: vazio quando a cadência é semanal */
  anchorDay: string;
  expectedAmount: string;
  amountType: RecurrenceAmountType;
  categoryId: string | null;
  /** "DD/MM/AAAA" — vazio significa "hoje" para o início e "sem fim" para o fim */
  startsAt: string;
  endsAt: string;
}

export interface CreateRecurrencePayload {
  displayName: string;
  flow: "EXPENSE" | "INCOME";
  cadence: SchedulableCadence;
  anchorDay?: number;
  expectedAmount: number;
  amountType: RecurrenceAmountType;
  categoryId?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface UpdateRecurrencePayload {
  displayName?: string;
  categoryId?: string;
  amountType?: RecurrenceAmountType;
  expectedAmount?: number;
  cadence?: SchedulableCadence;
  anchorDay?: number;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
}

export type PayloadResult<T> =
  | { ok: true; payload: T; notices: string[] }
  | { ok: false; message: string };

const MAX_NAME_LENGTH = 160;

/** Validação comum de criação e edição, na ordem em que o campo aparece. */
function validateForm(
  values: RecurrenceFormValues,
  opts: { requireAmount: boolean },
): { message: string } | { amount: number | null; anchorDay: number | null; startsAt: string | null; endsAt: string | null } {
  const name = values.displayName.trim();
  if (!name) return { message: "Dê um nome à recorrência." };
  if (name.length > MAX_NAME_LENGTH) {
    return { message: `O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.` };
  }

  // Na criação o servidor exige o valor; no PATCH ele é opcional e uma série
  // detectada pode viver sem estimativa — obrigar a inventar um número só
  // para trocar a categoria seria pior do que seguir sem valor
  const amount = parseAmountInput(values.expectedAmount);
  if (amount === null && opts.requireAmount) {
    return { message: "Informe o valor esperado." };
  }
  if (amount !== null && amount <= 0) {
    return { message: "O valor esperado precisa ser maior que zero." };
  }

  let anchorDay: number | null = null;
  if (cadenceUsesAnchorDay(values.cadence)) {
    anchorDay = parseAmountInput(values.anchorDay);
    if (anchorDay === null || !Number.isInteger(anchorDay)) {
      return { message: "Informe o dia do mês em que a cobrança cai." };
    }
    if (anchorDay < 1 || anchorDay > 31) {
      return { message: "O dia da cobrança precisa estar entre 1 e 31." };
    }
  }

  const startsAt = values.startsAt.trim() ? parseDateInput(values.startsAt) : null;
  if (values.startsAt.trim() && !startsAt) {
    return { message: "Data de início inválida. Use o formato DD/MM/AAAA." };
  }
  const endsAt = values.endsAt.trim() ? parseDateInput(values.endsAt) : null;
  if (values.endsAt.trim() && !endsAt) {
    return { message: "Data de fim inválida. Use o formato DD/MM/AAAA." };
  }
  if (startsAt && endsAt && endsAt < startsAt) {
    return { message: "A data de fim não pode ser anterior à data de início." };
  }

  return { amount, anchorDay, startsAt, endsAt };
}

export function buildCreatePayload(
  values: RecurrenceFormValues,
): PayloadResult<CreateRecurrencePayload> {
  const checked = validateForm(values, { requireAmount: true });
  if ("message" in checked) return { ok: false, message: checked.message };
  // requireAmount já barrou o vazio acima; o guard existe para o TypeScript
  if (checked.amount === null) {
    return { ok: false, message: "Informe o valor esperado." };
  }

  const payload: CreateRecurrencePayload = {
    displayName: values.displayName.trim(),
    flow: values.flow,
    cadence: values.cadence,
    expectedAmount: checked.amount,
    amountType: values.amountType,
  };
  // anchorDay só viaja nas cadências ancoradas: mandá-lo em WEEKLY é 400 certo
  if (checked.anchorDay !== null) payload.anchorDay = checked.anchorDay;
  if (values.categoryId) payload.categoryId = values.categoryId;
  if (checked.startsAt) payload.startsAt = checked.startsAt;
  if (checked.endsAt) payload.endsAt = checked.endsAt;
  return { ok: true, payload, notices: [] };
}

/**
 * PATCH parcial: só o que mudou viaja. O record do servidor não distingue
 * "null" de "ausente", então limpar categoria ou data de fim é impossível pela
 * API — em vez de fingir que apagou, o aviso volta para a tela contar.
 */
export function buildUpdatePayload(
  values: RecurrenceFormValues,
  original: RecurringSeries,
): PayloadResult<UpdateRecurrencePayload> {
  const checked = validateForm(values, { requireAmount: false });
  if ("message" in checked) return { ok: false, message: checked.message };

  const payload: UpdateRecurrencePayload = {};
  const notices: string[] = [];
  const name = values.displayName.trim();

  // A comparação usa o mesmo fallback do preenchimento (merchantKey): sem ele,
  // série com displayName nulo mandava PATCH em todo save "sem mudança" — e
  // qualquer PATCH promove a série detectada a agendada
  if (name !== (original.displayName ?? original.merchantKey)) {
    payload.displayName = name;
  }
  if (values.amountType !== original.amountType) payload.amountType = values.amountType;
  if (checked.amount !== null) {
    if (checked.amount !== original.expectedAmount) payload.expectedAmount = checked.amount;
  } else if (original.expectedAmount != null) {
    notices.push("O valor esperado não pode ser removido por aqui.");
  }

  const cadenceChanged = values.cadence !== original.cadence;
  if (cadenceChanged) payload.cadence = values.cadence;
  if (checked.anchorDay !== null) {
    // sair de semanal exige mandar a âncora junto, mesmo que o número já
    // estivesse gravado: o servidor valida o estado resultante
    if (checked.anchorDay !== original.anchorDay || cadenceChanged) {
      payload.anchorDay = checked.anchorDay;
    }
  }

  if (values.categoryId && values.categoryId !== original.categoryId) {
    payload.categoryId = values.categoryId;
  } else if (!values.categoryId && original.categoryId) {
    notices.push("A categoria não pode ser removida por aqui — troque por outra.");
  }

  if (checked.startsAt && checked.startsAt !== original.startsAt) {
    payload.startsAt = checked.startsAt;
  } else if (!checked.startsAt && original.startsAt) {
    notices.push("A data de início não pode ser removida por aqui.");
  }
  if (checked.endsAt && checked.endsAt !== original.endsAt) {
    payload.endsAt = checked.endsAt;
  } else if (!checked.endsAt && original.endsAt) {
    notices.push("A data de fim não pode ser removida por aqui.");
  }

  if (Object.keys(payload).length === 0) {
    return { ok: false, message: "Nada mudou nesta recorrência." };
  }
  return { ok: true, payload, notices };
}

/** Preenche o formulário a partir de uma série existente (edição). */
export function formValuesFromSeries(
  series: RecurringSeries,
): RecurrenceFormValues {
  const cadence: SchedulableCadence =
    series.cadence === "IRREGULAR" ? "MONTHLY" : series.cadence;
  return {
    displayName: series.displayName ?? series.merchantKey,
    // INTERNAL não é agendável: a edição trata a transferência como saída
    flow: series.flow === "INCOME" ? "INCOME" : "EXPENSE",
    cadence,
    anchorDay: series.anchorDay != null ? String(series.anchorDay) : "",
    expectedAmount:
      series.expectedAmount != null
        ? String(series.expectedAmount).replace(".", ",")
        : "",
    amountType: series.amountType,
    categoryId: series.categoryId,
    startsAt: formatDateInput(series.startsAt),
    endsAt: formatDateInput(series.endsAt),
  };
}

export function emptyFormValues(today = new Date()): RecurrenceFormValues {
  return {
    displayName: "",
    flow: "EXPENSE",
    cadence: "MONTHLY",
    // dia de hoje como palpite: é o que a maioria das cobranças novas segue
    anchorDay: String(today.getDate()),
    expectedAmount: "",
    amountType: "FIXED",
    categoryId: null,
    startsAt: formatDateInput(toIsoDate(today)),
    endsAt: "",
  };
}

// --- Erros do servidor ---

export interface ApiProblem {
  status: number | null;
  detail: string | null;
  /** Propriedade extra do ProblemDetail no 409: a série que já existe */
  seriesId: string | null;
}

/**
 * Lê o ProblemDetail sem depender do axios: o shape é `error.response.data`
 * em qualquer cliente, e manter isto livre de import concreto é o que permite
 * testar a tradução sem subir a camada de rede.
 */
export function readProblem(error: unknown): ApiProblem {
  const response = (error as { response?: { status?: unknown; data?: unknown } } | null)
    ?.response;
  const data = response?.data as
    | { detail?: unknown; seriesId?: unknown }
    | undefined;
  return {
    status: typeof response?.status === "number" ? response.status : null,
    detail: typeof data?.detail === "string" ? data.detail : null,
    seriesId: typeof data?.seriesId === "string" ? data.seriesId : null,
  };
}

// O servidor responde 400 com a mensagem da regra violada, escrita para quem
// lê a API (nomes de campo e de enum). Aqui ela vira a frase que o dono da
// conta entende, sem o vocabulário do backend.
const ERROR_TRANSLATIONS: { match: RegExp; message: string }[] = [
  {
    match: /endsAt não pode ser anterior/i,
    message: "A data de fim não pode ser anterior à data de início.",
  },
  {
    match: /Dia âncora não se aplica/i,
    message: "Cobrança semanal não tem dia do mês — deixe o dia de cobrança em branco.",
  },
  {
    match: /Dia âncora é obrigatório/i,
    message: "Informe o dia do mês em que a cobrança cai.",
  },
  {
    match: /Dia âncora deve estar entre/i,
    message: "O dia da cobrança precisa estar entre 1 e 31.",
  },
  {
    match: /Cadência (é obrigatória|inválida)/i,
    message: "Escolha a frequência: mensal, semanal ou trimestral.",
  },
  {
    match: /Fluxo (é obrigatório|inválido)/i,
    message: "Escolha se a recorrência é entrada ou saída.",
  },
  {
    match: /Tipo de valor inválido/i,
    message: "Escolha se o valor é fixo ou variável.",
  },
  {
    match: /Categoria não encontrada/i,
    message: "A categoria escolhida não existe mais. Escolha outra.",
  },
  {
    match: /Série recorrente não encontrada/i,
    message: "Esta recorrência não existe mais. Atualize a lista.",
  },
  {
    match: /chave de conciliação/i,
    message:
      "Dê um nome mais específico à cobrança (ex.: “Spotify”, “Conta de luz”) para o app reconhecê-la no extrato.",
  },
  {
    match: /Nome de exibição (é obrigatório|não pode ser vazio)/i,
    message: "Dê um nome à recorrência.",
  },
  {
    match: /Nome de exibição deve ter no máximo/i,
    message: `O nome pode ter no máximo ${MAX_NAME_LENGTH} caracteres.`,
  },
  {
    match: /Valor esperado é obrigatório/i,
    message: "Informe o valor esperado.",
  },
  {
    match: /Valor esperado deve ser positivo/i,
    message: "O valor esperado precisa ser maior que zero.",
  },
  {
    match: /months deve estar entre/i,
    message: "Escolha um período entre 1 e 12 meses.",
  },
  {
    match: /Usuário não encontrado/i,
    message: "Sua sessão não confere. Entre novamente.",
  },
];

export function translateRecurrenceError(
  error: unknown,
  fallback: string,
): string {
  const problem = readProblem(error);
  if (!problem.detail) return fallback;
  const hit = ERROR_TRANSLATIONS.find((rule) => rule.match.test(problem.detail as string));
  if (hit) return hit.message;
  // 400 sem tradução: a mensagem do servidor já vem em português e é melhor
  // que um genérico — o que não pode é vazar erro cru de 500/rede
  return problem.status === 400 || problem.status === 409
    ? (problem.detail as string)
    : fallback;
}

export interface RecurrenceConflict {
  message: string;
  /** Quando presente, a UI pode levar direto à edição da série existente */
  seriesId: string | null;
}

/**
 * 409 do POST: já existe série para a mesma (chave, fluxo). O servidor manda o
 * `seriesId` justamente para a tela oferecer "editar a existente" — sem isso o
 * usuário teria que caçar a série na lista para cumprir a instrução.
 */
export function describeConflict(error: unknown): RecurrenceConflict | null {
  const problem = readProblem(error);
  if (problem.status !== 409) return null;
  if (problem.seriesId) {
    return {
      message:
        "Você já tem uma recorrência para esta cobrança. Em vez de criar outra, edite a que existe.",
      seriesId: problem.seriesId,
    };
  }
  return {
    message:
      problem.detail ??
      "Já existe uma recorrência para esta cobrança. Atualize a lista e edite a existente.",
    seriesId: null,
  };
}

// --- Varredura ---

export function describeDetection(summary: DetectionSummary): string {
  const parts: string[] = [];
  if (summary.seriesCreated > 0) {
    parts.push(
      `${summary.seriesCreated} ${summary.seriesCreated === 1 ? "nova série" : "novas séries"}`,
    );
  }
  if (summary.seriesUpdated > 0) {
    parts.push(
      `${summary.seriesUpdated} ${summary.seriesUpdated === 1 ? "atualizada" : "atualizadas"}`,
    );
  }
  if (parts.length > 0) return `Varredura concluída: ${parts.join(" e ")}.`;
  if (summary.linksCreated > 0) {
    return `Nada novo — ${summary.linksCreated} ${
      summary.linksCreated === 1
        ? "lançamento vinculado"
        : "lançamentos vinculados"
    } às séries que você já tem.`;
  }
  return "Nada novo: suas recorrências já estavam em dia.";
}

// --- Previsão ---

export interface SeriesMonthState {
  settled: boolean;
  dueDay: number | null;
  amount: number;
}

/**
 * Estado do mês corrente por série, tirado do primeiro mês da previsão: é o
 * único lugar onde o servidor diz se a ocorrência do mês já foi conciliada.
 * A lista usa isso para separar "previsto" de "já pago".
 */
export function deriveMonthState(
  month: ForecastMonth | null | undefined,
): Record<string, SeriesMonthState> {
  const state: Record<string, SeriesMonthState> = {};
  if (!month) return state;
  month.items.forEach((item) => {
    state[item.seriesId] = {
      settled: item.settled,
      dueDay: item.dueDay,
      amount: item.amount,
    };
  });
  return state;
}

export interface ForecastMonthSplit {
  /** O que já caiu na conta neste mês — fora das somas do servidor */
  settledItems: ForecastItem[];
  /** O que ainda falta acontecer — é isto que forma o saldo previsto */
  pendingItems: ForecastItem[];
  settledTotal: number;
  pendingIncome: number;
  pendingExpense: number;
}

/**
 * Separa o mês em liquidado × previsto. O servidor já devolve
 * `expectedIncome/expectedExpense` sem os liquidados, mas a tela precisa das
 * DUAS listas para explicar o número: sem isso, a cobrança que já saiu some da
 * composição e o usuário procura o que não vai encontrar.
 */
export function splitForecastMonth(month: ForecastMonth): ForecastMonthSplit {
  const settledItems: ForecastItem[] = [];
  const pendingItems: ForecastItem[] = [];
  let settledTotal = 0;
  let pendingIncome = 0;
  let pendingExpense = 0;

  month.items.forEach((item) => {
    if (item.settled) {
      settledItems.push(item);
      settledTotal += item.amount;
      return;
    }
    pendingItems.push(item);
    if (item.flow === "INCOME") pendingIncome += item.amount;
    else pendingExpense += item.amount;
  });

  return {
    settledItems,
    pendingItems,
    settledTotal,
    pendingIncome,
    pendingExpense,
  };
}

/** Mês fecha no vermelho: é o que a tela precisa destacar com cor de risco. */
export function isMonthAtRisk(month: ForecastMonth): boolean {
  return month.cumulativeNet < 0;
}

/** Primeiro mês da janela que fecha negativo — o alerta que vale mostrar. */
export function firstRiskMonth(
  months: ForecastMonth[] | null | undefined,
): ForecastMonth | null {
  return months?.find(isMonthAtRisk) ?? null;
}

export interface UpcomingCommitment {
  total: number;
  count: number;
  /** Série que vence primeiro na janela — o nome que a Home mostra */
  nextName: string | null;
  nextDueDate: string | null;
}

/**
 * Quanto já está comprometido nos próximos N dias, direto das séries (sem
 * chamar a previsão): a Home precisa de um número honesto sem depender do
 * saldo inicial, que só a tela de previsão sabe montar.
 */
export function upcomingCommitment(
  series: RecurringSeries[],
  days = 30,
  today = new Date(),
): UpcomingCommitment {
  let total = 0;
  let count = 0;
  let nextName: string | null = null;
  let nextDueDate: string | null = null;

  series.forEach((item) => {
    if (item.flow !== "EXPENSE" || !item.active) return;
    if (item.expectedAmount == null) return;
    const distance = daysUntil(item.nextDueDate, today);
    if (distance === null || distance < 0 || distance > days) return;
    total += item.expectedAmount;
    count += 1;
    if (nextDueDate === null || (item.nextDueDate as string) < nextDueDate) {
      nextDueDate = item.nextDueDate;
      nextName = item.displayName ?? item.merchantKey;
    }
  });

  return { total, count, nextName, nextDueDate };
}
