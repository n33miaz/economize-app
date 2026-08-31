import axios, { AxiosError } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { useToastStore } from "../store/toastStore";
import { healthUrlFrom, waitForServer } from "../store/serverStore";
import type { AnalysisRange } from "../utils/cycleWindow";

// URL de produção usada quando não há env nem servidor Metro (builds EAS)
const PROD_BASE_URL = "https://economize-api.onrender.com/api/v1";

const getBaseUrl = () => {
  // Só variáveis EXPO_PUBLIC_* são embutidas no bundle pelo Metro —
  // API_BASE_URL sem o prefixo nunca chegava ao runtime
  const envUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envUrl) return envUrl.replace(/\/+$/, "");

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:8080/api/v1`;
  }

  return PROD_BASE_URL;
};

// 30s: a API roda no plano free do Render e uma chamada normal responde em
// menos de 1s, mas quem estoura o limite é o container hibernado — e para esse
// caso quem manda é o poll do serverStore, não o timeout
const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 30000,
});

// Interceptor de Requisição
api.interceptors.request.use(
  (config) => {
    const { useAuthStore } = require("../store/authStore");
    const token = useAuthStore.getState().token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de Resposta 
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 || error.response?.status === 403) {
      const { useAuthStore } = require("../store/authStore");
      useAuthStore.getState().logout();
      useToastStore
        .getState()
        .showToast("Sua sessão expirou. Faça login novamente.", "warning");
      return Promise.reject(error);
    }

    // Sem resposta nenhuma (timeout ou conexão recusada) é o sintoma do
    // container hibernado. Em vez de repetir contra um servidor que ainda nem
    // subiu, espera o health responder — com aviso na tela — e refaz uma vez.
    const looksAsleep = !error.response || error.code === "ECONNABORTED";
    if (looksAsleep && originalRequest && !originalRequest._wakeAttempted) {
      originalRequest._wakeAttempted = true;
      const awake = await waitForServer(healthUrlFrom(getBaseUrl()));
      if (awake) return api(originalRequest);
    }

    const isNetworkOrServerError =
      !error.response || error.response.status >= 500;

    // error.config pode vir undefined (falha antes do request montar);
    // sem essa guarda o TypeError aqui mascarava o erro original
    if (
      isNetworkOrServerError &&
      originalRequest &&
      (originalRequest._retryCount ?? 0) < 2
    ) {
      originalRequest._retryCount = (originalRequest._retryCount ?? 0) + 1;

      const backoffTime = originalRequest._retryCount * 1000;
      console.warn(
        `[API] Falha na requisição. Tentativa ${originalRequest._retryCount} em ${backoffTime}ms...`,
      );

      await new Promise((resolve) => setTimeout(resolve, backoffTime));
      return api(originalRequest); // Tenta novamente
    }

    // Tratamento Global de Erros
    if (error.code === "ECONNABORTED") {
      useToastStore
        .getState()
        .showToast("A conexão demorou muito. Verifique sua internet.", "error");
    } else if (!error.response) {
      useToastStore
        .getState()
        .showToast("Sem conexão com o servidor. Você está offline?", "error");
    } else if (error.response.status >= 500) {
      useToastStore
        .getState()
        .showToast(
          "Nossos servidores estão instáveis no momento. Tente mais tarde.",
          "error",
        );
    }

    return Promise.reject(error);
  },
);

export default api;

// --- Interfaces ---
export interface Indicator {
  id: string;
  type: "currency" | "index" | "crypto" | "stock" | "unknown";
  code: string;
  name: string;
  buy: number;
  sell: number | null;
  variation: number;
  location?: string;
  points?: number;
}

export interface NewsArticle {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  content: string | null;
}

export type ReviewStatus = "SUGGESTED" | "UNCATEGORIZED" | "CONFIRMED";

export type CategorizedBy =
  | "USER_RULE"
  | "LEARNED_RULE"
  | "KEYWORD"
  | "FALLBACK"
  | "AI"
  | "USER";

export type CategoryFlow = "EXPENSE" | "INCOME" | "BOTH";

export interface Category {
  id: string;
  name: string;
  slug: string;
  groupName: string | null;
  flow: CategoryFlow;
  color: string | null;
  icon: string | null;
  systemKey: string | null;
  // null = categoria raiz. A hierarquia tem no máximo dois níveis.
  parentId: string | null;
  parentName: string | null;
  parentSystemKey: string | null;
  system: boolean;
  archived: boolean;
}

export interface BankTransaction {
  id: string;
  transactionId: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  /**
   * TEXTO DE EXIBIÇÃO (EC-094): é o apelido quando existe, senão o texto do
   * banco. O campo mudou de semântica — nunca use como chave de dedupe,
   * agrupamento, comparação, cache ou `key` de lista, porque ele muda quando o
   * usuário renomeia. Para isso existe `originalDescription`.
   */
  description: string;
  /** Texto cru do banco: continua o mesmo depois de qualquer rename. */
  originalDescription: string;
  /** Apelido do usuário; null quando a transação nunca foi renomeada. */
  displayAlias: string | null;
  date: string;
  categoryId: string | null;
  reviewStatus: ReviewStatus;
  categorizedBy: CategorizedBy | null;
  confidence: number | null;
  /** Chave do motor de categorização — derivada do texto do banco, nunca do apelido. */
  normalizedDescription: string | null;
  uploadId: string | null;
  /**
   * Conta de onde o lançamento veio (EC-113). **Nulo é legítimo e permanente**:
   * todo o histórico anterior à dimensão de conta e todo upload manual de
   * OFX/CSV nascem sem origem, porque o arquivo não diz de qual cartão ou
   * conta ele é. A tela mostra "origem não informada" — nunca erro.
   */
  accountId: string | null;
}

export interface StatementUploadResult {
  message: string;
  uploadId: string;
  transactionsImported: number;
  suggested: number;
  uncategorized: number;
  // transações reconhecidas como já existentes vindas de outra fonte/formato
  reconciled: number;
  format: string;
  duplicated: boolean;
}

export interface ReviewGroup {
  /** Chave real do agrupamento no servidor (texto do banco normalizado). */
  normalizedDescription: string | null;
  /**
   * Texto de EXIBIÇÃO da primeira transação do grupo — muda com o apelido.
   * Serve de título; não serve de chave (veja `reviewGroupKey`).
   */
  sampleDescription: string | null;
  suggestedCategoryId: string | null;
  categorizedBy: CategorizedBy | null;
  confidence: number | null;
  totalAmount: number;
  transactions: BankTransaction[];
}

export interface ReviewApplyItem {
  transactionIds: string[];
  categoryId: string;
  learnPattern?: boolean;
}

export interface ReviewOutcome {
  confirmed: number;
  rulesSaved: number;
}

export interface MonthTotals {
  /** null quando o recorte é uma janela — ela não é um mês de calendário. */
  month: string | null;
  /** Extremos inclusivos do recorte comparado (`yyyy-MM-dd`). */
  start: string;
  end: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  groupName: string | null;
  color: string | null;
  icon: string | null;
  systemKey: string | null;
  parentSystemKey: string | null;
  system: boolean;
  expenseTotal: number;
  incomeTotal: number;
  txCount: number;
  previousExpenseTotal: number;
  expenseDeltaPct: number | null;
  // no nível raiz os totais já vêm somados; aqui vem a quebra por subcategoria
  children: CategorySlice[];
}

export interface MonthlyAnalytics {
  /** null em modo janela; `start`/`end` são o recorte em qualquer modo. */
  month: string | null;
  start: string;
  end: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
  /**
   * Em modo mês, o mês de calendário anterior. Em modo janela, uma janela do
   * MESMO tamanho terminando na véspera do início — os dois modos divergem de
   * propósito, e por isso a tela precisa dizer contra o que está comparando.
   */
  previous: MonthTotals;
  categories: CategorySlice[];
  pendingReviewCount: number;
}

export interface UserMe {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  lastLoginAt: string | null;
}

export interface HistoricalDataPoint {
  timestamp: string;
  high: number;
}

export interface ConversionResponse {
  currency: string;
  amountBrl: number;
  result: number;
}

// --- Funções Auxiliares ---
export function isCurrencyData(item: Indicator): boolean {
  return item.type === "currency";
}

export function isIndexData(item: Indicator): boolean {
  return item.type === "index";
}

export const getHistoricalData = async (
  currencyCode: string,
  days: number = 7,
): Promise<HistoricalDataPoint[]> => {
  try {
    const response = await api.get<HistoricalDataPoint[]>(
      `/indicators/historical/${currencyCode}`,
      { params: { days } },
    );
    return response.data;
  } catch (error) {
    return [];
  }
};

export const convertCurrency = async (
  code: string,
  amount: number,
): Promise<ConversionResponse | null> => {
  try {
    const response = await api.get<ConversionResponse>("/indicators/convert", {
      params: { code, amount },
    });
    return response.data;
  } catch (error) {
    return null;
  }
};

export const uploadBankStatement = async (
  file: DocumentPicker.DocumentPickerAsset,
) => {
  const formData = new FormData();

  if (file.file) {
    // Web: o picker devolve um File de verdade. O shape {uri,name,type} que o
    // React Native entende viraria a string "[object Object]" no navegador
    formData.append("file", file.file, file.name);
  } else {
    formData.append("file", {
      uri: file.uri,
      name: file.name,
      type: file.mimeType || "application/octet-stream",
    } as never);
  }

  // Sem header manual no navegador: multipart precisa do `boundary=...`, que só
  // o browser sabe gerar. Fixar "multipart/form-data" na mão apagava o boundary
  // e o servidor não conseguia separar as partes.
  const headers =
    Platform.OS === "web"
      ? undefined
      : { "Content-Type": "multipart/form-data" };

  // Extrato de ano inteiro leva dezenas de segundos no servidor (1.682
  // transações levaram 27s): o timeout padrão de 30s cortaria a importação
  const response = await api.post("/bank-statements/upload", formData, {
    headers,
    timeout: 180000,
  });
  return response.data;
};

export const getBankTransactions = async (): Promise<BankTransaction[]> => {
  try {
    const response = await api.get<BankTransaction[]>("/bank-statements");
    return response.data;
  } catch (error) {
    return [];
  }
};

// --- Conector Open Finance (Meu Pluggy) ---

export interface PluggyStatus {
  /** Flag PLUGGY_ENABLED no servidor. Falso esconde a seção inteira. */
  enabled: boolean;
  /** As credenciais são de uma pessoa só; `owner` diz se é esta conta. */
  owner?: boolean;
  /** Tem clientId, clientSecret e ao menos um item configurado. */
  configured: boolean;
  itemCount: number;
}

export const getPluggyStatus = async (): Promise<PluggyStatus> => {
  try {
    const response = await api.get<PluggyStatus>("/connectors/pluggy/status");
    return response.data;
  } catch {
    // Conector é opcional: falhar aqui não pode derrubar a tela de extrato
    return { enabled: false, configured: false, itemCount: 0 };
  }
};

export const syncPluggy = async (
  days = 90,
): Promise<StatementUploadResult> => {
  // Mesma janela do upload: a sincronização passa pelo mesmo pipeline e pode
  // levar dezenas de segundos com 90 dias de histórico
  const response = await api.post<StatementUploadResult>(
    "/connectors/pluggy/sync",
    null,
    { params: { days }, timeout: 180000 },
  );
  return response.data;
};

/** Uma conexão de banco do usuário. `itemId` é o id no agregador. */
export interface PluggyItem {
  id: string;
  itemId: string;
  connectorId: number | null;
  connectorName: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
}

/**
 * Token de sessão do Pluggy Connect, com validade curta. Ele NÃO dá acesso a
 * dados de outros usuários e nasce amarrado a esta conta — por isso pode
 * trafegar até o navegador que abre o widget.
 */
export const createPluggyConnectToken = async (): Promise<string> => {
  const response = await api.post<{ accessToken: string }>(
    "/connectors/pluggy/connect-token",
  );
  return response.data.accessToken;
};

export const listPluggyItems = async (): Promise<PluggyItem[]> => {
  const response = await api.get<PluggyItem[]>("/connectors/pluggy/items");
  return response.data;
};

/**
 * Registra a conexão recém-criada no Pluggy Connect. O servidor confere que o
 * item pertence a esta sessão antes de gravar: item de outra sessão responde
 * 404 e item já registrado responde 409.
 */
export const registerPluggyItem = async (
  itemId: string,
): Promise<PluggyItem> => {
  const response = await api.post<PluggyItem>("/connectors/pluggy/items", {
    itemId,
  });
  return response.data;
};

/** Desvincula do app. Não apaga o histórico já importado nem o item no agregador. */
export const unlinkPluggyItem = async (id: string): Promise<void> => {
  await api.delete(`/connectors/pluggy/items/${id}`);
};

// --- Contas de origem e faturas (EC-113) ---

/**
 * `BANK` cobre conta corrente E poupança — o provedor não distingue as duas, e
 * inventar a diferença aqui seria afirmar o que a API não sabe.
 */
export type AccountType = "CREDIT_CARD" | "BANK";

export interface ConnectorAccount {
  id: string;
  /** Rótulo do provedor, já com os últimos dígitos ("Ultravioleta ····1234"). */
  name: string;
  type: AccountType;
  institution: string | null;
  /** Só em cartão, e só quando o provedor informa; senão o ciclo é derivado. */
  statementClosingDay: number | null;
  statementDueDay: number | null;
  /**
   * `false` = instituição desvinculada. A origem sobrevive (a API usa
   * `ON DELETE SET NULL`), então o histórico continua identificado — o que
   * acabou foi a sincronização.
   */
  linked: boolean;
}

/**
 * De onde saiu o corte da fatura. `CALENDAR_MONTH` significa que o provedor
 * NÃO informou o dia de fechamento e a API derivou o período — a tela precisa
 * dizer que ali o período é aproximado, em vez de fingir precisão.
 */
export type InvoiceCycleSource = "PROVIDER_CLOSING_DAY" | "CALENDAR_MONTH";

export interface AccountInvoice {
  /** Mês em que o ciclo FECHA (`yyyy-MM`), não o mês das compras. */
  reference: string;
  periodStart: string;
  periodEnd: string;
  closingDate: string;
  dueDate: string | null;
  /** O que o usuário DEVE: compras menos estornos. */
  total: number;
  purchasesTotal: number;
  refundsTotal: number;
  /**
   * Pagamentos da fatura. Fica FORA do `total` e **nunca** pode ser somado
   * como receita — é dinheiro saindo da conta corrente para quitar o cartão.
   */
  paymentsTotal: number;
  transactionCount: number;
  /** Ciclo ainda aberto: o valor é parcial e cresce até o fechamento. */
  open: boolean;
  transactions: BankTransaction[];
}

export interface AccountInvoices {
  accountId: string;
  accountName: string;
  accountType: AccountType;
  institution: string | null;
  cycleSource: InvoiceCycleSource;
  /** Fatura em aberto primeiro; ciclos sem lançamento são OMITIDOS. */
  invoices: AccountInvoice[];
}

/** Vazio quando o usuário nunca sincronizou um conector. */
export const getAccounts = async (): Promise<ConnectorAccount[]> => {
  const response = await api.get<ConnectorAccount[]>("/accounts");
  return response.data;
};

/**
 * Faturas de um cartão. `months` (1–24) conta faturas FECHADAS — a que está em
 * aberto vem sempre primeiro e não consome o orçamento.
 *
 * 404 para conta inexistente ou de outro dono (a API não vaza existência);
 * 400 para conta que existe mas é `BANK`, e para `months` fora da faixa.
 */
export const getAccountInvoices = async (
  accountId: string,
  months = 6,
): Promise<AccountInvoices> => {
  const response = await api.get<AccountInvoices>(
    `/accounts/${accountId}/invoices`,
    { params: { months } },
  );
  return response.data;
};

// --- Categorias ---
export const getCategories = async (): Promise<Category[]> => {
  const response = await api.get<Category[]>("/categories");
  return response.data;
};

export const createCategory = async (data: {
  name: string;
  groupName?: string | null;
  flow?: CategoryFlow;
  color?: string | null;
  icon?: string | null;
  parentId?: string | null;
}): Promise<Category> => {
  const response = await api.post<Category>("/categories", data);
  return response.data;
};

export const updateCategory = async (
  id: string,
  data: Partial<{
    name: string;
    groupName: string | null;
    flow: CategoryFlow;
    color: string | null;
    icon: string | null;
    archived: boolean;
    parentId: string | null;
    // parentId sozinho não distingue "não mexer" de "promover para raiz"
    clearParent: boolean;
  }>,
): Promise<Category> => {
  const response = await api.patch<Category>(`/categories/${id}`, data);
  return response.data;
};

export const deleteCategory = async (
  id: string,
): Promise<{ deleted: boolean; archived: boolean }> => {
  const response = await api.delete(`/categories/${id}`);
  return response.data;
};

// --- Revisão de categorização ---
export const getReviewQueue = async (
  uploadId?: string,
): Promise<ReviewGroup[]> => {
  const response = await api.get<ReviewGroup[]>("/transactions/review", {
    params: uploadId ? { uploadId } : undefined,
  });
  return response.data;
};

export const applyReview = async (
  items: ReviewApplyItem[],
): Promise<ReviewOutcome> => {
  const response = await api.patch<ReviewOutcome>("/transactions/review", {
    items,
  });
  return response.data;
};

export const confirmAllReview = async (
  uploadId?: string,
): Promise<ReviewOutcome> => {
  const response = await api.post<ReviewOutcome>(
    "/transactions/review/confirm-all",
    null,
    { params: uploadId ? { uploadId } : undefined },
  );
  return response.data;
};

/**
 * Traduz o recorte para query string. Mês e janela são formas concorrentes de
 * dizer a mesma coisa e o servidor devolve 400 quando chegam juntas — por isso
 * a união discriminada entra aqui e sai como um par de chaves só.
 */
function rangeParams(range?: AnalysisRange) {
  if (!range) return undefined;
  return range.kind === "month"
    ? { month: range.month }
    : { start: range.start, end: range.end };
}

export const getTransactions = async (params?: {
  /** Sem recorte, o servidor devolve o histórico inteiro. */
  range?: AnalysisRange;
  status?: ReviewStatus;
  categoryId?: string;
}): Promise<BankTransaction[]> => {
  const response = await api.get<BankTransaction[]>("/transactions", {
    params: {
      ...rangeParams(params?.range),
      status: params?.status,
      categoryId: params?.categoryId,
    },
  });
  return response.data;
};

/**
 * Renomeia a transação na visão do usuário. `null` (ou texto em branco) limpa o
 * apelido; o texto do banco nunca é tocado. 400 quando passa de 80 caracteres,
 * 404 quando o id não é desta conta — de propósito, para não vazar existência.
 */
export const updateTransactionAlias = async (
  id: string,
  displayAlias: string | null,
): Promise<BankTransaction> => {
  const response = await api.patch<BankTransaction>(
    `/transactions/${id}/alias`,
    { displayAlias },
  );
  return response.data;
};

// --- Análise mensal ---
export const getMonthlyAnalytics = async (
  range?: AnalysisRange,
): Promise<MonthlyAnalytics> => {
  const response = await api.get<MonthlyAnalytics>("/analytics/monthly", {
    params: rangeParams(range),
  });
  return response.data;
};

/**
 * Meses com movimento, do mais recente para o mais antigo. Continua sendo a
 * espinha do seletor mesmo em modo janela: cada mês vira o mês-âncora de um
 * ciclo (veja `cycleMonthKeys`), porque é o servidor que sabe onde há dado.
 */
export const getAnalyticsMonths = async (): Promise<string[]> => {
  const response = await api.get<string[]>("/analytics/months");
  return response.data;
};

// --- Recorrências ---

// INTERNAL é conclusão da detecção (dinheiro do titular circulando entre os
// próprios bancos): existe na leitura, mas não é agendável nem entra na previsão
export type RecurrenceFlow = "EXPENSE" | "INCOME" | "INTERNAL";
// IRREGULAR é o veredito "repete, mas sem ciclo" — não é uma opção do usuário
export type RecurrenceCadence = "MONTHLY" | "WEEKLY" | "QUARTERLY" | "IRREGULAR";
// FIXED = assinatura/plano (valor idêntico); VARIABLE = conta de consumo
export type RecurrenceAmountType = "FIXED" | "VARIABLE";
export type RecurrenceSource = "DETECTED" | "USER";

export interface RecurringSeries {
  id: string;
  /** Chave normalizada da entidade; sobrevive à troca de rótulo do banco */
  merchantKey: string;
  displayName: string | null;
  categoryId: string | null;
  flow: RecurrenceFlow;
  cadence: RecurrenceCadence;
  anchorDay: number | null;
  dayTolerance: number | null;
  amountType: RecurrenceAmountType;
  expectedAmount: number | null;
  occurrences: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  active: boolean;
  /** Descarte explícito do usuário — a varredura nunca ressuscita */
  dismissed: boolean;
  source: RecurrenceSource;
  /** Vigência do agendamento manual; null nas séries detectadas */
  startsAt: string | null;
  endsAt: string | null;
  nextDueDate: string | null;
}

export interface DetectionSummary {
  seriesCreated: number;
  seriesUpdated: number;
  linksCreated: number;
}

export interface ForecastItem {
  seriesId: string;
  displayName: string;
  flow: "EXPENSE" | "INCOME";
  /** null em cadência semanal, que não tem um dia único no mês */
  dueDay: number | null;
  amount: number;
  source: RecurrenceSource;
  /** Ocorrência já conciliada no mês corrente: fica FORA das somas do mês */
  settled: boolean;
}

export interface ForecastMonth {
  month: string;
  expectedIncome: number;
  expectedExpense: number;
  expectedNet: number;
  /** Acumulado a partir do startingBalance informado pelo app */
  cumulativeNet: number;
  items: ForecastItem[];
}

export interface ForecastResponse {
  startingBalance: number | null;
  months: ForecastMonth[];
}

export interface CreateRecurrenceRequest {
  displayName: string;
  flow: "EXPENSE" | "INCOME";
  cadence: "MONTHLY" | "WEEKLY" | "QUARTERLY";
  anchorDay?: number;
  expectedAmount: number;
  amountType?: RecurrenceAmountType;
  categoryId?: string;
  startsAt?: string;
  endsAt?: string;
}

export interface UpdateRecurrenceRequest {
  displayName?: string;
  categoryId?: string;
  active?: boolean;
  amountType?: RecurrenceAmountType;
  expectedAmount?: number;
  cadence?: "MONTHLY" | "WEEKLY" | "QUARTERLY";
  anchorDay?: number;
  startsAt?: string;
  endsAt?: string;
}

/**
 * Sem `active`, o servidor lista só as ativas não descartadas e esconde as
 * INTERNAL; `active: false` traz as inativas (inclusive as descartadas), que é
 * como a tela chega às séries que o usuário mandou embora.
 */
export const getRecurrences = async (params?: {
  flow?: RecurrenceFlow;
  active?: boolean;
}): Promise<RecurringSeries[]> => {
  const response = await api.get<RecurringSeries[]>("/recurrences", { params });
  return response.data;
};

// A varredura relê o histórico inteiro e é idempotente; em extratos de ano
// cheio ela passa dos 30s do timeout padrão, como o upload
export const detectRecurrences = async (): Promise<DetectionSummary> => {
  const response = await api.post<DetectionSummary>("/recurrences/detect", null, {
    timeout: 180000,
  });
  return response.data;
};

/** 409 quando já existe série para a mesma chave/fluxo (traz `seriesId`). */
export const createRecurrence = async (
  data: CreateRecurrenceRequest,
): Promise<RecurringSeries> => {
  const response = await api.post<RecurringSeries>("/recurrences", data);
  return response.data;
};

export const updateRecurrence = async (
  id: string,
  data: UpdateRecurrenceRequest,
): Promise<RecurringSeries> => {
  const response = await api.patch<RecurringSeries>(`/recurrences/${id}`, data);
  return response.data;
};

/** Série agendada sem vínculo some do banco; detectada vira descarte. */
export const deleteRecurrence = async (
  id: string,
): Promise<{ deleted: boolean; deactivated: boolean }> => {
  const response = await api.delete(`/recurrences/${id}`);
  return response.data;
};

/**
 * `startingBalance` não é opcional na prática: sem ele o acumulado parte de
 * zero e "saldo previsto" viraria só a soma das recorrências.
 */
export const getRecurrenceForecast = async (
  months: number,
  startingBalance: number,
): Promise<ForecastResponse> => {
  const response = await api.get<ForecastResponse>("/recurrences/forecast", {
    params: { months, startingBalance },
  });
  return response.data;
};

// --- Senha ---

// Extrai o `detail` do ProblemDetail que o backend devolve em erros de
// negócio (400); null quando a falha não tem resposta estruturada (rede,
// timeout), para o chamador cair na mensagem genérica dele
export function getApiErrorDetail(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { detail?: string } | undefined;
    return data?.detail ?? null;
  }
  return null;
}

/**
 * Status HTTP da falha; null quando nem houve resposta (rede, timeout). Quem
 * precisa distinguir 400 de 404 usa isto em vez de cavar no erro do axios.
 */
export function getApiErrorStatus(error: unknown): number | null {
  if (axios.isAxiosError(error)) {
    return error.response?.status ?? null;
  }
  return null;
}

/**
 * Propriedade `reason` do ProblemDetail. O EC-107 a acrescenta no 502 do
 * assistente para dizer POR QUE o provedor do usuário falhou — e é o que
 * separa esse 502 do 502 genérico de provedor de dados, que não a traz.
 *
 * Ler a chave em vez de casar o texto é regra: a redação do `detail` pode
 * mudar de uma versão para outra, o campo classificado não.
 */
export function getApiErrorReason(error: unknown): string | null {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { reason?: unknown } | undefined;
    return typeof data?.reason === "string" && data.reason.length > 0
      ? data.reason
      : null;
  }
  return null;
}

/**
 * `Retry-After` em segundos, quando o servidor manda um 429 com o cabeçalho.
 * Desde o EC-114 o 429 sai com CORS, então no navegador o axios enxerga a
 * resposta em vez de achar que está offline — sem isso, este helper devolveria
 * null justamente onde ele mais serve.
 */
export function getApiErrorRetryAfterSeconds(error: unknown): number | null {
  if (!axios.isAxiosError(error)) return null;
  const headers = error.response?.headers as
    | Record<string, unknown>
    | undefined;
  // O axios normaliza para minúsculas, mas adaptadores diferentes já
  // devolveram a forma canônica — conferir as duas custa uma linha
  const raw = headers?.["retry-after"] ?? headers?.["Retry-After"];
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.ceil(seconds) : null;
}

// Responde 202 sempre, exista a conta ou não — a neutralidade é contrato da
// API e a tela não deve tentar distinguir os casos
export const forgotPassword = async (email: string): Promise<void> => {
  await api.post("/auth/forgot-password", { email });
};

export const resetPassword = async (
  token: string,
  newPassword: string,
): Promise<void> => {
  await api.post("/auth/reset-password", { token, newPassword });
};

export const changePassword = async (
  currentPassword: string,
  newPassword: string,
): Promise<void> => {
  await api.post("/users/me/change-password", { currentPassword, newPassword });
};

// --- Usuário ---
export const getUserMe = async (): Promise<UserMe> => {
  const response = await api.get<UserMe>("/users/me");
  return response.data;
};

export const updateUserMe = async (name: string): Promise<UserMe> => {
  const response = await api.patch<UserMe>("/users/me", { name });
  return response.data;
};

// --- IA: provedor e chave própria do usuário (EC-107) ---

export type AiProviderId = "GEMINI" | "OPENAI" | "ANTHROPIC" | "OPENROUTER";

/** OK: chave própria legível · UNREADABLE: cadastrada mas ilegível com a
 *  chave-mestra atual (recadastrar) · SERVER_KEY: a conta usa a do servidor. */
export type AiKeyStatus = "OK" | "UNREADABLE" | "SERVER_KEY";

/** Nulo quando o teste passa. Classificado pela API — o app decide o texto. */
export type AiTestReason = "AUTH" | "MODEL" | "RATE_LIMIT" | "NETWORK" | "PROVIDER";

export interface AiProviderOption {
  id: AiProviderId;
  label: string;
  defaultModel: string;
  models: string[];
  /** Página onde o usuário emite a própria chave. */
  apiKeyUrl: string;
}

export interface AiProviderCatalog {
  /** Falso quando o servidor está sem chave-mestra: a opção some da tela. */
  byokAvailable: boolean;
  providers: AiProviderOption[];
}

export interface AiSettings {
  source: "USER" | "SERVER";
  provider: AiProviderId;
  model: string;
  /** Só os 4 últimos caracteres. A chave nunca volta da API. */
  keyLast4: string | null;
  keyStatus: AiKeyStatus;
  byokAvailable: boolean;
  updatedAt: string | null;
}

export interface AiKeyTestResult {
  ok: boolean;
  provider: AiProviderId;
  model: string;
  reason: AiTestReason | null;
  /** Texto pronto para exibir, escrito pela API — nunca o corpo do provedor. */
  message: string;
  latencyMs: number;
}

export const getAiProviders = async (): Promise<AiProviderCatalog> => {
  const response = await api.get<AiProviderCatalog>("/ai/providers");
  return response.data;
};

export const getAiSettings = async (): Promise<AiSettings> => {
  const response = await api.get<AiSettings>("/ai/settings");
  return response.data;
};

export const saveAiSettings = async (
  provider: AiProviderId,
  model: string,
  apiKey: string,
): Promise<AiSettings> => {
  const response = await api.put<AiSettings>("/ai/settings", {
    provider,
    model,
    apiKey,
  });
  return response.data;
};

/** Remove a chave própria; a conta volta para a chave do servidor. */
export const deleteAiSettings = async (): Promise<void> => {
  await api.delete("/ai/settings");
};

/**
 * Testa uma chave SEM gravá-la. `ok: false` chega com HTTP 200 — é resultado de
 * teste, não erro de transporte, e tratar como exceção esconderia a mensagem
 * que explica o motivo. Sem `apiKey`, testa a chave já cadastrada.
 */
export const testAiKey = async (params: {
  provider?: AiProviderId;
  model?: string;
  apiKey?: string;
}): Promise<AiKeyTestResult> => {
  const response = await api.post<AiKeyTestResult>("/ai/settings/test", params);
  return response.data;
};

// ---------------------------------------------------------------- Desejos

/** Estágios de um desejo. GOAL é o que compete pela sobra do mês. */
export type WishStatus = "WISH" | "GOAL" | "PURCHASED" | "ARCHIVED";

export type IncomeSourceKind =
  | "SALARY"
  | "MEAL_VOUCHER"
  | "FOOD_VOUCHER"
  | "ADVANCE"
  | "OTHER";

/**
 * O que muda a data de um desejo. `monthsEarlier` chega nulo quando não havia
 * prazo para comparar — quem não tem sobra nenhuma vê o cenário como o único
 * caminho de saída, sem "antes" de referência.
 */
export interface WishWhatIf {
  percentOfExpense: number;
  monthlyCut: number;
  months: number | null;
  estimatedDate: string | null;
  monthsEarlier: number | null;
}

/**
 * Campo nulo aqui é "ainda não dá para saber", NUNCA zero. A tela transforma
 * cada nulo num convite ("me diga sua jornada"), e é por isso que o servidor
 * prefere omitir a responder um número inventado.
 */
export interface WishProjection {
  remaining: number;
  hoursOfWork: number | null;
  workDays: number | null;
  monthsToAfford: number | null;
  estimatedDate: string | null;
  installments: number | null;
  maxInstallment: number | null;
  achieved: boolean;
  whatIfs: WishWhatIf[];
}

export interface Wish {
  id: string;
  name: string;
  targetAmount: number;
  savedAmount: number;
  categoryId: string | null;
  status: WishStatus;
  targetDate: string | null;
  note: string | null;
  purchasedAt: string | null;
  purchaseTransactionId: string | null;
  projection: WishProjection;
}

/** O que falta para o cálculo fechar — cada código vira um botão na tela. */
export type WishGap =
  | "WORK_PROFILE"
  | "CONFIRMED_INCOME"
  | "HISTORY"
  | "NO_LEFTOVER";

export interface WishBaseline {
  workIncome: number;
  hourlyRate: number | null;
  hoursPerMonth: number | null;
  monthlyLeftover: number | null;
  monthlyExpense: number | null;
  cyclesConsidered: number;
  gaps: WishGap[];
}

export interface WishList {
  baseline: WishBaseline;
  wishes: Wish[];
}

export interface IncomeSource {
  id: string;
  kind: IncomeSourceKind;
  name: string;
  expectedAmount: number | null;
  anchorDay: number | null;
  confirmed: boolean;
  active: boolean;
  seriesId: string | null;
}

export interface WorkProfile {
  daysPerWeek: number;
  hoursPerDay: number;
  hoursPerMonth: number;
}

/** Fonte que o extrato provou e que ainda espera confirmação do usuário. */
export interface IncomeSuggestion {
  seriesId: string;
  suggestedKind: IncomeSourceKind;
  name: string;
  expectedAmount: number | null;
  anchorDay: number | null;
}

export interface IncomeOverview {
  sources: IncomeSource[];
  workProfile: WorkProfile | null;
  suggestions: IncomeSuggestion[];
}

export interface CreateWishPayload {
  name: string;
  targetAmount: number;
  savedAmount?: number;
  categoryId?: string | null;
  targetDate?: string | null;
  note?: string | null;
}

export type UpdateWishPayload = Partial<CreateWishPayload> & {
  status?: WishStatus;
};

export const getWishes = async (): Promise<WishList> => {
  const response = await api.get<WishList>("/wishes");
  return response.data;
};

export const createWish = async (payload: CreateWishPayload): Promise<Wish> => {
  const response = await api.post<Wish>("/wishes", payload);
  return response.data;
};

export const updateWish = async (
  id: string,
  payload: UpdateWishPayload,
): Promise<Wish> => {
  const response = await api.patch<Wish>(`/wishes/${id}`, payload);
  return response.data;
};

export const deleteWish = async (id: string): Promise<void> => {
  await api.delete(`/wishes/${id}`);
};

/** Confirma que o desejo virou compra; o guardado é preservado no histórico. */
export const purchaseWish = async (
  id: string,
  payload?: { purchasedAt?: string; transactionId?: string },
): Promise<Wish> => {
  const response = await api.post<Wish>(`/wishes/${id}/purchase`, payload ?? {});
  return response.data;
};

export const getIncomeOverview = async (): Promise<IncomeOverview> => {
  const response = await api.get<IncomeOverview>("/income");
  return response.data;
};

export const createIncomeSource = async (payload: {
  kind: IncomeSourceKind;
  name: string;
  expectedAmount?: number | null;
  anchorDay?: number | null;
}): Promise<IncomeSource> => {
  const response = await api.post<IncomeSource>("/income/sources", payload);
  return response.data;
};

export const updateIncomeSource = async (
  id: string,
  payload: {
    name?: string;
    expectedAmount?: number | null;
    anchorDay?: number | null;
    confirmed?: boolean;
    active?: boolean;
  },
): Promise<IncomeSource> => {
  const response = await api.patch<IncomeSource>(
    `/income/sources/${id}`,
    payload,
  );
  return response.data;
};

export const deleteIncomeSource = async (id: string): Promise<void> => {
  await api.delete(`/income/sources/${id}`);
};

/** Aceita a sugestão do extrato; sem corpo, valem os dados da própria série. */
export const acceptIncomeSuggestion = async (
  seriesId: string,
  payload?: {
    kind?: IncomeSourceKind;
    name?: string;
    expectedAmount?: number | null;
    anchorDay?: number | null;
  },
): Promise<IncomeSource> => {
  const response = await api.post<IncomeSource>(
    `/income/suggestions/${seriesId}/accept`,
    payload ?? {},
  );
  return response.data;
};

export const saveWorkProfile = async (payload: {
  daysPerWeek: number;
  hoursPerDay: number;
}): Promise<WorkProfile> => {
  const response = await api.put<WorkProfile>("/income/work-profile", payload);
  return response.data;
};
