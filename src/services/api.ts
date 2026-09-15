import axios, { AxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { useToastStore } from "../store/toastStore";
import { healthUrlFrom, waitForServer } from "../store/serverStore";
import { APP_VERSION, platformHeader, versionHeaders } from "../utils/appVersion";
import type { AnalysisRange } from "../utils/cycleWindow";
import { describeRequestFailure } from "./requestFailure";

// A leitura das falhas mora em módulo próprio (puro, sem cliente HTTP) e sai
// também por aqui: quem já importa o `api` não precisa saber onde ela vive
export {
  describeLoadFailure,
  describeRequestFailure,
  FAILURE_MESSAGES,
} from "./requestFailure";
export type { RequestFailure, RequestFailureKind } from "./requestFailure";

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
    // Versão e plataforma em TODA requisição: é o que permite ao servidor
    // recusar (426) um app velho demais para o contrato atual, em vez de
    // responder um shape que a tela não sabe ler
    config.headers["X-App-Version"] = APP_VERSION;
    config.headers["X-App-Platform"] = platformHeader();
    return config;
  },
  (error) => Promise.reject(error),
);

// Interceptor de Resposta
//
// Quem LÊ a falha é `describeRequestFailure`; aqui só se decide o que fazer
// com ela. A regra é uma: toast só quando o USUÁRIO agiu (POST/PUT/PATCH/
// DELETE) ou quando a sessão caiu. GET que falha fica em silêncio — a tela
// que pediu mostra o `ErrorState` com "tentar de novo", e uma frase no lugar
// explica mais do que um toast global que some em quatro segundos. A versão
// anterior gritava "servidores instáveis" para qualquer 5xx de qualquer GET,
// três vezes por cold start, e o usuário lia culpa onde havia só um
// container subindo.
const USER_ACTION_METHODS = new Set(["post", "put", "patch", "delete"]);

/** Teto para esperar um `Retry-After` em silêncio; acima disso, avisa. */
const RATE_LIMIT_SILENT_WAIT_S = 5;
/** Pausa antes da única repetição silenciosa de um 5xx. */
const SERVER_RETRY_BACKOFF_MS = 1000;

type RetryableRequest = InternalAxiosRequestConfig & {
  _wakeAttempted?: boolean;
  _retried?: boolean;
};

function isUserAction(config: RetryableRequest | undefined): boolean {
  return USER_ACTION_METHODS.has((config?.method ?? "get").toLowerCase());
}

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

// "Você está offline" sai UMA vez por queda: o flag só volta a zero quando
// uma resposta chega de fato — não a cada dez segundos enquanto a rede não
// volta
let offlineNoticed = false;

api.interceptors.response.use(
  (response) => {
    offlineNoticed = false;
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as RetryableRequest | undefined;
    const failure = describeRequestFailure(error);
    const { showToast } = useToastStore.getState();

    // 426: o servidor não fala mais com esta versão. Nem retry nem toast —
    // quem assume é o gate de atualização, e o corpo (ProblemDetail) já traz
    // a versão mínima e o endereço do download. Import tardio pelo mesmo
    // motivo do authStore abaixo: o store de versão importa esta API.
    if (failure.kind === "upgrade") {
      const { useVersionStore } = require("../store/versionStore");
      useVersionStore.getState().markUpgradeRequired(error.response?.data);
      return Promise.reject(error);
    }

    if (failure.kind === "unauthorized") {
      const { useAuthStore } = require("../store/authStore");
      useAuthStore.getState().logout();
      showToast(failure.message, "warning");
      return Promise.reject(error);
    }

    if (failure.kind === "offline") {
      if (!offlineNoticed) {
        offlineNoticed = true;
        showToast(failure.message, "warning");
      }
      return Promise.reject(error);
    }

    // Servidor acordando (sem resposta, ou 502/503 do proxy da hospedagem):
    // em vez de repetir contra um container que ainda nem subiu, espera o
    // health responder — com o aviso do serverStore na tela — e refaz UMA vez
    if (
      failure.kind === "waking" &&
      originalRequest &&
      !originalRequest._wakeAttempted
    ) {
      originalRequest._wakeAttempted = true;
      const awake = await waitForServer(healthUrlFrom(getBaseUrl()));
      if (awake) return api(originalRequest);
    }

    // 429 com prazo curto: espera o que o servidor pediu e repete em silêncio
    if (
      failure.kind === "rate-limited" &&
      originalRequest &&
      !originalRequest._retried &&
      failure.retryAfterSeconds !== null &&
      failure.retryAfterSeconds <= RATE_LIMIT_SILENT_WAIT_S
    ) {
      originalRequest._retried = true;
      await sleep(failure.retryAfterSeconds * 1000);
      return api(originalRequest);
    }

    // 5xx que não é hibernação: uma repetição, em silêncio. `error.config`
    // pode vir undefined (falha antes do request montar); sem a guarda o
    // TypeError aqui mascarava o erro original
    if (
      failure.kind === "server" &&
      originalRequest &&
      !originalRequest._retried
    ) {
      originalRequest._retried = true;
      await sleep(SERVER_RETRY_BACKOFF_MS);
      return api(originalRequest);
    }

    // Daqui para baixo a repetição já foi feita (ou não cabia). Só a AÇÃO do
    // usuário ganha toast — e no tom certo: 429 e servidor acordando são
    // informação, não alarme vermelho
    if (isUserAction(originalRequest) && failure.retryable) {
      showToast(failure.message, failure.kind === "server" ? "error" : "info");
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
  /**
   * O servidor manda 
ull (não omite) para tudo que não é índice — e o
   * próprio índice hoje chega com o valor em uy. Quem lê tem que usar
   * ??: !== undefined deixava o null passar e a lista de Moedas
   * mostrava R$ 0,00 com a variação certa ao lado.
   */
  points?: number | null;
}

/**
 * Item do catálogo paginado (EC-099). Estende `Indicator`: o app já sabe
 * renderizar esse shape, então a lista infinita reaproveita o card existente.
 */
export interface CatalogItem extends Indicator {
  /** Recorte para a UI: acoes, fiis, etfs, bdrs, indices, moedas, cripto. */
  segment: string;
  /**
   * Procedência do preço. `UNQUOTED` significa que `buy`/`sell` vêm nulos: o
   * catálogo entrega identidade sem gastar cota do provedor, e o item nunca
   * desaparece da lista por falta de preço.
   */
  quoteStatus: "LIVE" | "STALE" | "UNQUOTED";
}

export interface CatalogPageInfo {
  limit: number;
  returned: number;
  hasMore: boolean;
  /** Cursor da próxima página; nulo quando `hasMore` é falso. */
  nextCursor: string | null;
  totalMatched: number;
  catalogVersion: string;
  /**
   * Janela de ordenação desta página. Páginas com o mesmo `rankEpoch` são
   * fatias da MESMA ordem congelada; epoch diferente significa que a ordem foi
   * recalculada e continuar paginando repetiria ou pularia item.
   */
  rankEpoch: number;
  /** Quantas cotações novas ainda cabem na cota do dia. */
  quoteBudgetRemaining: number;
}

export interface CatalogPage {
  items: CatalogItem[];
  page: CatalogPageInfo;
}

export interface CatalogQuery {
  type?: string;
  segment?: string;
  q?: string;
  sort?: "trending" | "name" | "code";
  limit?: number;
  /** Ids dos favoritos: são o componente "do usuário" da ordenação. */
  favorites?: string;
  cursor?: string;
}

export const getCatalog = async (query: CatalogQuery): Promise<CatalogPage> => {
  const response = await api.get<CatalogPage>("/indicators/catalog", {
    params: query,
  });
  return response.data;
};

/**
 * Detalhe enriquecido de um ativo (EC-103). Uma requisição ao provedor entrega
 * tudo: a faixa de 52 semanas já vinha na cotação, e a série do ano vem no
 * mesmo corpo.
 */
export interface AssetChangeWindow {
  key: "24h" | "7d" | "30d" | "ytd";
  label: string;
  /**
   * `null` é resposta legítima: papel recém-listado não tem 30 dias de
   * histórico, e zero ali afirmaria estabilidade onde não há dado.
   */
  changePct: number | null;
  fromPrice: number | null;
  fromDate: string | null;
}

export interface AssetDetail {
  code: string;
  name: string;
  price: number | null;
  dayChangePct: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  /** Posição do preço na faixa de 52 semanas, de 0 a 1; nula sem faixa. */
  rangePosition: number | null;
  windows: AssetChangeWindow[];
  /** Preço de snapshot antigo: a cota do dia acabou ou o provedor falhou. */
  stale: boolean;
}

export const getAssetDetail = async (code: string): Promise<AssetDetail> => {
  const response = await api.get<AssetDetail>(
    `/indicators/${encodeURIComponent(code)}/detail`,
  );
  return response.data;
};

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

/** Por onde um lançamento entrou (EC-195). */
export type ImportSourceKind = "CONNECTION" | "FILE" | "UNKNOWN";

/** Um arquivo já importado — o que dá nome ao `uploadId` de cada linha. */
export interface ImportSource {
  id: string;
  fileName: string | null;
  format: string;
  importedCount: number;
  importedAt: string;
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
  /**
   * Dinheiro do titular trocando de bolso (pagamento de fatura, Pix para si
   * mesmo). Fica FORA das somas de receita e despesa — de todas elas.
   */
  internalTransfer: boolean;
  /**
   * A linha não deveria existir: entrou pela conexão bancária E por um arquivo,
   * ou a pessoa a descartou. Sai de toda soma e continua no extrato com selo.
   */
  ignored: boolean;
  /**
   * Transferência entre pessoas da mesma casa. Sai SÓ da soma da Casa: aqui, na
   * análise pessoal de quem recebeu, o dinheiro entrou mesmo.
   */
  familyTransfer: boolean;
  /**
   * Uma das duas pernas de um estorno: a compra que saiu e o crédito que
   * voltou.
   *
   * <p>Diferente de `ignored`, onde a linha não deveria existir. Aqui as duas
   * linhas são reais e o saldo fecha com elas — o que estaria errado é somá-las.
   * Quem gastou R$ 4,00 e recebeu R$ 4,00 de volta não gastou nada.
   */
  refunded: boolean;
  /** No lado do crédito, a compra que ele estornou. Nulo do outro lado. */
  refundOfId: string | null;
  /**
   * Por onde esta linha entrou (EC-195).
   *
   * `UNKNOWN` não é falha: é o histórico anterior ao registro de origem, e é a
   * maioria do extrato de quem sempre importou arquivo na mão. Dizer "não sei
   * de onde veio" é a resposta honesta.
   *
   * Opcional no tipo porque servidor mais velho que o app não manda o campo —
   * e a ausência dele não pode quebrar a tela.
   */
  source?: ImportSourceKind | null;
  /**
   * Quando a linha entrou no banco de dados. É outra coisa que `date`: a
   * compra foi no dia 3, o arquivo entrou no dia 20. Quando o número da tela
   * não bate com o do banco, a distância entre as duas é quase sempre a
   * explicação.
   */
  importedAt?: string | null;
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
  /**
   * O que o total NÃO diz (EC-138). Opcional porque o servidor pode ser mais
   * velho que o app; a tela trata ausência como "nenhuma ressalva".
   */
  caveats?: CycleCaveat[];
  /**
   * Até que dia o extrato do usuário alcança (EC-137), de qualquer período.
   * Opcional porque o servidor pode ser mais velho que o app — e aí "não sei"
   * não pode ser lido como "já chegou".
   */
  lastTransactionDate?: string | null;
}

/**
 * Ressalva sobre o período: nota de rodapé, nunca número escondido. O valor
 * continua sendo o que é — a ressalva explica por que ele não é comparável.
 */
export interface CycleCaveat {
  kind: "LATE_INCOME" | "PARTIAL_PERIOD" | "NO_PREVIOUS_DATA";
  title: string;
  detail: string;
  /** Valor envolvido, quando a ressalva é sobre dinheiro e não sobre o período. */
  amount: number | null;
}

export interface UserMe {
  id: string;
  name: string;
  email: string;
  createdAt: string | null;
  lastLoginAt: string | null;
  /**
   * Senha provisória pendente de troca. Verdadeiro só em conta criada por
   * outra pessoa — enquanto não trocar, alguém além do dono sabe a senha. Vem
   * do SERVIDOR de propósito: se fosse decisão do app, bastaria entrar por
   * outro cliente para pular a troca. Opcional porque o servidor pode ser
   * mais velho que o app.
   */
  mustChangePassword?: boolean;
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
  } catch {
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
  } catch {
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

// Falha PROPAGA: a versão que engolia o erro e devolvia [] fazia o Extrato
// mostrar "Nenhum extrato importado" para quem tinha dois anos de histórico e
// só perdeu a rede — o store trata o erro e a tela oferece "tentar de novo"
export const getBankTransactions = async (): Promise<BankTransaction[]> => {
  const response = await api.get<BankTransaction[]>("/bank-statements");
  return response.data;
};

// --- Conector Open Finance ---
//
// Nenhum nome de provedor daqui para baixo, nem nas rotas: o usuário só
// precisa saber que pode conectar o banco, e quem faz os trâmites somos nós.
// É também o que deixa o app trocar de provedor sem mexer em tela nenhuma.

export interface ConnectorStatus {
  /** Conector ligado no servidor. Falso esconde a seção inteira. */
  enabled: boolean;
  /** As credenciais são de uma pessoa só; `owner` diz se é esta conta. */
  owner?: boolean;
  /** Tem credenciais e ao menos um item configurado. */
  configured: boolean;
  itemCount: number;
  /** Quem opera a conexão por trás. Não vai para a tela. */
  provider?: { id: string; displayName: string } | null;
  /**
   * O script do widget que a ponte (`public/conectar-banco.html`) carrega, e
   * o tipo dele. Vem do servidor justamente para a ponte não conhecer
   * provedor nenhum.
   */
  widget?: { scriptUrl: string; kind: string } | null;
}

export const getConnectorStatus = async (): Promise<ConnectorStatus> => {
  try {
    const response = await api.get<ConnectorStatus>("/connectors/status");
    return response.data;
  } catch {
    // Conector é opcional: falhar aqui não pode derrubar a tela de extrato
    return { enabled: false, configured: false, itemCount: 0 };
  }
};

export const syncConnector = async (
  days = 90,
): Promise<StatementUploadResult> => {
  // Mesma janela do upload: a sincronização passa pelo mesmo pipeline e pode
  // levar dezenas de segundos com 90 dias de histórico
  const response = await api.post<StatementUploadResult>(
    "/connectors/sync",
    null,
    { params: { days }, timeout: 180000 },
  );
  return response.data;
};

/**
 * Uma conexão de banco do usuário. `itemId` é o id no agregador, e
 * `connectorName` é o nome do CONECTOR lá — nunca vai para a tela: quem
 * nomeia a conexão para o usuário é `institution`.
 */
export interface ConnectorItem {
  id: string;
  itemId: string;
  connectorId: number | null;
  connectorName: string | null;
  institution?: string | null;
  createdAt: string;
  lastSyncedAt: string | null;
}

/**
 * Token de sessão do widget, com validade curta. Ele NÃO dá acesso a dados de
 * outros usuários e nasce amarrado a esta conta — por isso pode trafegar até
 * o navegador que abre o widget.
 */
export const createConnectToken = async (): Promise<string> => {
  const response = await api.post<{ accessToken: string }>(
    "/connectors/connect-token",
  );
  return response.data.accessToken;
};

export const listConnectorItems = async (): Promise<ConnectorItem[]> => {
  const response = await api.get<ConnectorItem[]>("/connectors/items");
  return response.data;
};

/**
 * Registra a conexão recém-criada no widget. O servidor confere que o item
 * pertence a esta sessão antes de gravar: item de outra sessão responde 404 e
 * item já registrado responde 409.
 */
export const registerConnectorItem = async (
  itemId: string,
): Promise<ConnectorItem> => {
  const response = await api.post<ConnectorItem>("/connectors/items", {
    itemId,
  });
  return response.data;
};

/** Desvincula do app. Não apaga o histórico já importado nem o item no agregador. */
export const unlinkConnectorItem = async (id: string): Promise<void> => {
  await api.delete(`/connectors/items/${id}`);
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
  /**
   * O saldo que a INSTITUIÇÃO informou, e quando (EC-196).
   *
   * Nulo é informação, não ausência: quer dizer que o número que a tela mostra
   * nasce só da soma dos lançamentos importados, sem segunda fonte para
   * conferir. Em cartão o campo é o valor DEVIDO, não um saldo.
   */
  reportedBalance: number | null;
  reportedBalanceAt: string | null;
}

/**
 * O que exatamente está errado entre o saldo do banco e o da tela — nunca
 * "os números não batem".
 */
export type BalanceFindingKind =
  | "SEM_SALDO_INFORMADO"
  | "ZERO_COM_MOVIMENTO"
  | "SALDO_VELHO"
  | "MOVIMENTO_APOS_LEITURA";

export interface BalanceFinding {
  accountId: string;
  accountName: string;
  kind: BalanceFindingKind;
  reportedBalance: number | null;
  reportedAt: string | null;
  /** Soma do que entrou depois da leitura; nulo quando não se aplica. */
  movementAfter: number | null;
  message: string;
}

export interface BalanceCheck {
  accountsChecked: number;
  findings: BalanceFinding[];
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
  /**
   * Dinheiro já separado para pagar ESTA fatura (EC-181), ou `null` quando o
   * dono não separou nada. Não é lançamento: nada saiu da conta, e por isso o
   * extrato e as somas continuam iguais. Comparar com `total` é trabalho da
   * tela — pode ser menor (cobre em parte) ou maior (a fatura ainda cresce).
   */
  reserve: InvoiceReserve | null;
  transactions: BankTransaction[];
}

export interface InvoiceReserve {
  id: string;
  amount: number;
  /** Onde o dinheiro está parado; nulo quando foi separado fora do sistema. */
  heldInAccountId: string | null;
  heldInAccountName: string | null;
  note: string | null;
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

/** O teto que o usuário pôs numa categoria (EC-204). */
export interface CategoryBudget {
  categoryId: string;
  categoryName: string | null;
  /** MENSAL, mesmo quando o usuário lê o gasto por ciclo. */
  monthlyLimit: number;
}

/**
 * Como um teto está indo no período.
 *
 * `exceeded` e `abovePace` respondem perguntas DIFERENTES: a primeira diz que
 * já estourou, a segunda que o ritmo leva a estourar. "Você está em 20% do
 * limite" é verdade e é inútil — 20% no terceiro dia é ruim, no vigésimo
 * oitavo é ótimo.
 */
export interface BudgetLine {
  categoryId: string;
  categoryName: string | null;
  monthlyLimit: number;
  /** O teto mensal esticado (ou encolhido) para o tamanho da janela. */
  windowLimit: number;
  spent: number;
  /** Quanto já se poderia ter gasto até hoje. */
  expectedSoFar: number;
  /** Quanto passou; zero quando não passou. */
  overBy: number;
  exceeded: boolean;
  abovePace: boolean;
}

export interface BudgetStatus {
  exceededCount: number;
  abovePaceCount: number;
  lines: BudgetLine[];
}

// A listagem crua de `/analytics/budgets` não tem cliente aqui de propósito:
// `getBudgetStatus` devolve os MESMOS tetos com o gasto do período junto, e
// toda tela que mostra um teto quer os dois. Um segundo caminho para a mesma
// pergunta é como duas telas passam a discordar.

/** Upsert: reajustar o limite muda o MESMO teto, não cria um segundo. */
export const setBudget = async (
  categoryId: string,
  monthlyLimit: number,
): Promise<CategoryBudget> => {
  const response = await api.put<CategoryBudget>(
    `/analytics/budgets/${categoryId}`,
    null,
    { params: { monthlyLimit } },
  );
  return response.data;
};

export const clearBudget = async (categoryId: string): Promise<void> => {
  await api.delete(`/analytics/budgets/${categoryId}`);
};

export const getBudgetStatus = async (
  range: AnalysisRange,
): Promise<BudgetStatus> => {
  const response = await api.get<BudgetStatus>("/analytics/budgets/status", {
    params: rangeParams(range),
  });
  return response.data;
};

/** Uma série de parcelamento em andamento (EC-213/EC-217). */
export interface InstallmentSeries {
  description: string;
  /** Total de parcelas da compra. */
  total: number;
  /** Quantas o extrato mostra — pode ser menos quando o histórico começa no meio. */
  seen: number;
  /** Quantas ainda vão cair. */
  remaining: number;
  installmentAmount: number;
  /** O que falta pagar, estimado pela parcela mais recente. */
  remainingAmount: number;
  /** `YYYY-MM`. */
  firstMonth: string;
  /** `YYYY-MM` da última parcela — a projeção. */
  lastMonth: string;
  finished: boolean;
}

export interface InstallmentOverview {
  totalSeries: number;
  openSeries: number;
  /** O total a vencer somando todas as séries abertas. */
  remainingTotal: number;
  series: InstallmentSeries[];
}

/**
 * Parcelamentos em andamento.
 *
 * A projeção é por MÊS, não por dia: parcela cai em ciclo de fatura, não em
 * aniversário da compra. Na série real medida os intervalos foram de 25 e 36
 * dias, mas o mês avançou exatamente um por parcela.
 */
export const getInstallments = async (): Promise<InstallmentOverview> => {
  const response = await api.get<InstallmentOverview>("/analytics/installments");
  return response.data;
};

/** Quanto saiu e quanto entrou num dia (EC-235) — alimenta o calendário. */
export interface DailyTotal {
  /** `YYYY-MM-DD`. */
  date: string;
  spent: number;
  earned: number;
  count: number;
}

/**
 * Totais por dia do período.
 *
 * Agregado no servidor de propósito: para somar trinta dias o app teria de
 * baixar o extrato inteiro, e 1.688 linhas custam 92 KB e segundos de espera.
 * Trinta linhas destas custam menos de 2 KB. Dia sem movimento não volta —
 * quem monta a grade é a tela, que sabe quantos dias o mês tem.
 */
export const getDailyTotals = async (
  range: AnalysisRange,
): Promise<DailyTotal[]> => {
  const response = await api.get<DailyTotal[]>("/analytics/daily", {
    params: rangeParams(range),
  });
  return response.data;
};

/** Vazio quando o usuário nunca sincronizou um conector. */
export const getAccounts = async (): Promise<ConnectorAccount[]> => {
  const response = await api.get<ConnectorAccount[]>("/accounts");
  return response.data;
};

/**
 * Os arquivos que o usuário já importou (EC-195).
 *
 * Carregado uma vez e casado em memória pelo `uploadId` de cada linha, como o
 * mapa de contas: repetir o nome do arquivo em cada uma de 1.682 linhas seria
 * pagar mil vezes pelo mesmo texto.
 */
export const getImportSources = async (): Promise<ImportSource[]> => {
  const response = await api.get<ImportSource[]>("/bank-statements/sources");
  return response.data;
};

/**
 * Confronta o saldo que o banco informou com o que o app mostra (EC-196).
 *
 * Só devolve o que dá para provar. NÃO compara a soma dos lançamentos com o
 * saldo do banco: o provedor devolve ~12 meses e a conta é mais velha, então
 * essa diferença tocaria sempre — e alarme que toca sempre é alarme nenhum.
 */
export const getBalanceCheck = async (): Promise<BalanceCheck> => {
  const response = await api.get<BalanceCheck>("/accounts/balance-check");
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

export interface RecategorizeOutcome {
  /** Linhas pendentes que o motor reexaminou. */
  reviewed: number;
  /** Quantas ganharam uma sugestão que não tinham. */
  resolved: number;
  /** Quantas seguem sem resposta — decisão do usuário. */
  stillPending: number;
  /** Quantas foram resolvidas pelo modelo, e não pelo vocabulário. */
  resolvedByAi: number;
}

/**
 * Reexamina a fila com o motor de hoje.
 *
 * A categorização só acontecia na importação: uma palavra nova no vocabulário
 * (ou uma regra aprendida numa correção) valia para o próximo arquivo e nunca
 * alcançava o extrato que já estava no banco. Não toca no que o usuário
 * confirmou.
 */
export const recategorizePending = async (): Promise<RecategorizeOutcome> => {
  const response = await api.post<RecategorizeOutcome>(
    "/transactions/review/recategorize",
  );
  return response.data;
};

/**
 * Quantas transações esperam revisão — só o número.
 *
 * A Home escreve "N transações esperando você" e não desenha nenhuma delas.
 * Buscando a fila inteira, isso custava 92 KB agrupados (1.656 pendentes) e
 * 2,1 s a cada abertura do app. A tela de revisão continua usando a fila.
 */
export const getReviewCount = async (): Promise<number> => {
  const response = await api.get<{ count: number }>(
    "/transactions/review/count",
  );
  return response.data.count;
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
 * Tipos de dívida que o extrato revela (EC-139). Sem essa distinção o app soma
 * a parcela do carro com o mercado e chama tudo de despesa.
 */
export type DebtKind =
  | "FINANCING"
  | "INSTALLMENT"
  | "CONSORTIUM"
  | "LOAN"
  | "REVOLVING";

export interface DebtEntry {
  transactionId: string;
  description: string;
  amount: number;
  date: string | null;
  installment: number | null;
  total: number | null;
  /** Quantas faltam — por quanto tempo esse compromisso ainda vai pesar. */
  remaining: number | null;
}

export interface DebtGroup {
  kind: DebtKind;
  total: number;
  count: number;
  items: DebtEntry[];
}

/**
 * `shareOfExpense` vem nulo quando não houve despesa no período: 0/0 não é 0%,
 * e "0% do seu mês é dívida" num mês sem extrato seria uma boa notícia que
 * ninguém apurou.
 */
export interface DebtOverview {
  month: string | null;
  start: string;
  end: string;
  totalExpense: number;
  totalDebt: number;
  shareOfExpense: number | null;
  groups: DebtGroup[];
  /** Rotativo ou parcelamento de fatura no período: o alarme mais caro. */
  revolvingAlert: boolean;
}

export const getDebtOverview = async (
  range?: AnalysisRange,
): Promise<DebtOverview> => {
  const response = await api.get<DebtOverview>("/analytics/debt", {
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
  /**
   * Data COMPLETA do vencimento (EC-116). Num ciclo ancorado o dia sozinho não
   * ordena nem localiza: o ciclo 12/08→11/09 tem o dia 20 (de agosto) ANTES do
   * dia 5 (de setembro), e só a data diz qual é qual. Os itens já vêm
   * ordenados por ela. null em WEEKLY, pelo mesmo motivo do `dueDay`.
   */
  dueDate: string | null;
  amount: number;
  source: RecurrenceSource;
  /** Ocorrência já conciliada no período corrente: fica FORA das somas */
  settled: boolean;
}

/**
 * Um período da previsão. `month` é o mês em que o período COMEÇA — identidade
 * do período, não rótulo: em ciclo ancorado o "2026-08" é o ciclo que abre em
 * 12/08 e vai até 11/09. Quem descreve o recorte são `start`/`end`.
 */
export interface ForecastMonth {
  month: string;
  /** Recorte explícito do período (EC-116), inclusivo nas duas pontas */
  start: string;
  end: string;
  expectedIncome: number;
  expectedExpense: number;
  expectedNet: number;
  /** Acumulado a partir do startingBalance informado pelo app */
  cumulativeNet: number;
  items: ForecastItem[];
}

export interface ForecastResponse {
  startingBalance: number | null;
  /**
   * Dia em que o ciclo vira, lido pelo servidor a partir do recorte pedido; 1
   * quando a projeção correu por mês do calendário (EC-116). É a única parte do
   * recorte que o app não mandou escrita — está aqui para uma leitura errada da
   * âncora aparecer na primeira resposta, e não três períodos adiante.
   */
  anchorDay: number;
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

/** Uma assinatura reconhecida entre as séries (EC-203). */
export interface Subscription {
  seriesId: string;
  name: string;
  category: string | null;
  monthlyAmount: number;
  /** O número que faz alguém cancelar. */
  yearlyAmount: number;
  occurrences: number;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  /** Não cobra há mais de 45 dias — acabou, ou volta de surpresa. */
  silent: boolean;
}

export interface SubscriptionReport {
  /** Quantas séries foram olhadas — o denominador que mostra o filtro. */
  seriesExamined: number;
  subscriptions: number;
  yearlyTotal: number;
  silentCount: number;
  details: Subscription[];
}

/**
 * O que o usuário paga todo mês, e quanto isso é por ano (EC-203).
 *
 * O valor está no FILTRO, não na detecção: medida contra o extrato real, a
 * regra ingênua de "mesmo valor em três meses" achou 24 candidatas das quais
 * 2 eram assinaturas. Quem recusa as outras 22 é o servidor — aqui só se
 * desenha o que sobrou.
 */
export const getSubscriptions = async (): Promise<SubscriptionReport> => {
  const response = await api.get<SubscriptionReport>("/analytics/subscriptions");
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
 *
 * `range` é o período corrente na MESMA gramática de `/analytics/monthly`
 * (EC-116): `month` com âncora no dia 1, `start`/`end` fora dele — os períodos
 * seguintes o servidor encadeia a partir desse recorte. Sem `range` ele projeta
 * por mês do calendário a partir do mês corrente, que é o que o APK publicado
 * ainda pede; por isso o parâmetro é opcional e fica por último.
 */
export const getRecurrenceForecast = async (
  months: number,
  startingBalance: number,
  range?: AnalysisRange,
): Promise<ForecastResponse> => {
  const response = await api.get<ForecastResponse>("/recurrences/forecast", {
    params: { months, startingBalance, ...rangeParams(range) },
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

/** Os três contadores do hub do Perfil — só os números. */
export interface UserStats {
  bankTransactions: number;
  walletTransactions: number;
  reports: number;
}

/**
 * Contadores do Perfil.
 *
 * A tela mostrava os três números somando o `length` das três listas — e para
 * isso baixava o extrato inteiro (100 KB para 1.752 linhas), a carteira e os
 * relatórios em toda abertura, o que fazia do Perfil uma das telas mais lentas
 * do app (3,6 s medidos). Aqui o servidor conta.
 */
export const getUserStats = async (): Promise<UserStats> => {
  const response = await api.get<UserStats>("/users/me/stats");
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
  // Meses e anos TRABALHADOS. Não confundir com `monthsToAfford`, que é
  // espera guardando a sobra: a moto custa 4,1 meses de trabalho e leva 19
  // meses para ser paga
  workMonths: number | null;
  workYears: number | null;
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

/** Um aporte numa meta (EC-205) — a linha que explica o saldo dela. */
export interface WishContribution {
  id: string;
  /** Positivo guarda, negativo devolve. */
  amount: number;
  /**
   * `MEASURED` veio da sobra que o app apurou; `DECLARED` a pessoa digitou.
   *
   * A distinção aparece na tela: apresentar como medido o que foi informado é
   * exatamente o que o EC-206 proíbe na previsão, e vale igual aqui.
   */
  origin: "MEASURED" | "DECLARED";
  /** `YYYY-MM` do ciclo de onde a sobra saiu; null no aporte digitado. */
  cycleMonth: string | null;
  note: string | null;
  createdAt: string;
}

export interface WishContributionResult {
  contribution: WishContribution;
  /** O saldo da meta DEPOIS do aporte. */
  savedAmount: number;
}

/**
 * Guarda dinheiro numa meta.
 *
 * `cycleMonth` marca o aporte como medido e trava o ciclo: a sobra de setembro
 * entra uma vez só, por mais vezes que alguém toque no botão. Valor negativo
 * devolve — sai do saldo e fica no histórico, que é o desfazer honesto.
 */
export const contributeToWish = async (
  id: string,
  payload: { amount: number; cycleMonth?: string | null; note?: string | null },
): Promise<WishContributionResult> => {
  const response = await api.post<WishContributionResult>(
    `/wishes/${id}/contributions`,
    payload,
  );
  return response.data;
};

/** O extrato de uma meta, do aporte mais novo para o mais velho. */
export const getWishContributions = async (
  id: string,
): Promise<WishContribution[]> => {
  const response = await api.get<WishContribution[]>(`/wishes/${id}/contributions`);
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

/**
 * Uma conta que já tem dono. `estimated` marca conta de consumo (luz, água):
 * o valor é a média do histórico, não um boleto fechado — a tela precisa
 * dizer isso, senão o total parece mais exato do que é.
 */
export interface CommittedItem {
  seriesId: string;
  name: string;
  categoryId: string | null;
  dueDate: string;
  amount: number;
  estimated: boolean;
}

/**
 * "Quando o salário cair, R$ X já têm dono."
 *
 * Com `salaryKnown: false` não há salário confirmado com dia de pagamento:
 * `beforeSalary` vira simplesmente as contas dos próximos 30 dias e os campos
 * de salário chegam nulos.
 */
export interface CommittedOverview {
  salaryKnown: boolean;
  salaryDate: string | null;
  daysUntilSalary: number | null;
  expectedSalary: number | null;
  committedBeforeSalary: number;
  beforeSalary: CommittedItem[];
  committedAfterSalary: number;
  afterSalary: CommittedItem[];
  /** O que realmente sobra do próximo pagamento. */
  free: number | null;
}

export const getCommittedOverview = async (): Promise<CommittedOverview> => {
  const response = await api.get<CommittedOverview>("/income/committed");
  return response.data;
};

// ---------------------------------------------------------- Grupo familiar

/**
 * A "Casa" (EC-149/150): um usuário pertence a no máximo um grupo. Quem cria é
 * OWNER; quem entra pelo código é MEMBER. O papel decide quem convida, quem
 * remove e quem apaga.
 */
export type FamilyRole = "OWNER" | "MEMBER";

/**
 * O que EU mostro para a casa. `TOTALS` é o padrão ao entrar: somas por
 * categoria e do período, nenhuma linha. `NONE` continua na lista de membros
 * — a casa sabe que a pessoa existe e escolheu não mostrar.
 */
export type FamilyShareScope = "NONE" | "TOTALS" | "TRANSACTIONS";

export interface FamilyMember {
  id: string;
  userId: string;
  name: string;
  role: FamilyRole;
  joinedAt: string;
  shareScope: FamilyShareScope;
  /** O próprio chamador, marcado pelo servidor — a tela não compara ids. */
  isMe: boolean;
}

/**
 * Parâmetros do que o chamador compartilha. `sharedAccountIds` vazio significa
 * TODAS as contas; preenchido, só as listadas — e aí as transações sem conta
 * (importadas por arquivo) só entram com `includeUnassigned`.
 */
export interface FamilySharing {
  shareScope: FamilyShareScope;
  hiddenCategoryIds: string[];
  sharedAccountIds: string[];
  includeUnassigned: boolean;
}

/**
 * Convite vivo do grupo. O `code` só existe na resposta da emissão
 * (`createFamilyInvite`); no `GET /family` ele volta nulo de propósito — quem
 * perdeu o código emite outro, e o anterior morre.
 */
export interface FamilyInviteInfo {
  code: string | null;
  expiresAt: string;
}

export interface FamilyInvite {
  code: string;
  expiresAt: string;
}

export interface FamilyResponse {
  id: string;
  name: string;
  /** Papel do CHAMADOR neste grupo. */
  role: FamilyRole;
  members: FamilyMember[];
  mySharing: FamilySharing;
  invite: FamilyInviteInfo | null;
}

export interface FamilyTotals {
  income: number;
  expense: number;
  net: number;
}

/**
 * Soma por categoria na visão da casa. `categoryName` viaja na resposta porque
 * a categoria pessoal de OUTRO membro não existe no catálogo do chamador — sem
 * o nome aqui a tela mostraria só um id.
 */
export interface FamilyCategoryTotal {
  categoryId: string | null;
  categoryName: string;
  income: number;
  expense: number;
  txCount: number;
}

export interface FamilyMemberAnalytics {
  memberId: string;
  name: string;
  isMe: boolean;
  shareScope: FamilyShareScope;
  /** Nulo para quem escolheu `NONE`: a pessoa aparece, o número não. */
  totals: FamilyTotals | null;
  categories: FamilyCategoryTotal[];
}

export interface FamilyAnalyticsResponse {
  /** O recorte que o CHAMADOR pediu — a âncora é de quem está olhando. */
  window: { start: string; end: string; month: string | null };
  members: FamilyMemberAnalytics[];
  combined: FamilyTotals & { categories: FamilyCategoryTotal[] };
}

/** Linha compartilhada: o lançamento como no extrato, mais de quem ele é. */
export interface FamilyTransaction extends BankTransaction {
  memberId: string;
  memberName: string;
}

/**
 * `null` quando o chamador não pertence a grupo nenhum. O servidor responde
 * 404 nesse caso, e 404 aqui é ESTADO ("sem casa"), não falha — a tela mostra
 * os cards de criar/entrar, nunca o ErrorState. Qualquer outro erro sobe.
 */
export const getFamily = async (): Promise<FamilyResponse | null> => {
  try {
    const response = await api.get<FamilyResponse>("/family");
    return response.data;
  } catch (error) {
    if (getApiErrorStatus(error) === 404) return null;
    throw error;
  }
};

/** 201 com o grupo; 409 quando o chamador já pertence a um. */
export const createFamily = async (name?: string): Promise<FamilyResponse> => {
  const response = await api.post<FamilyResponse>(
    "/family",
    name ? { name } : {},
  );
  return response.data;
};

/** Só o OWNER. */
export const renameFamily = async (name: string): Promise<FamilyResponse> => {
  const response = await api.patch<FamilyResponse>("/family", { name });
  return response.data;
};

/** Só o OWNER: apaga grupo, membros, convites e parâmetros — para todos. */
export const deleteFamily = async (): Promise<void> => {
  await api.delete("/family");
};

/**
 * Só o OWNER. Emitir de novo invalida o convite anterior: há um convite vivo
 * por grupo de cada vez. Esta é a ÚNICA resposta em que o código aparece.
 */
export const createFamilyInvite = async (): Promise<FamilyInvite> => {
  const response = await api.post<FamilyInvite>("/family/invites");
  return response.data;
};

/**
 * 404 para código inválido, expirado ou já usado — a mesma resposta para os
 * três, de propósito, para não dizer qual. 409 quando o chamador já pertence
 * a um grupo. Entra no balde caro do limitador (10/min): 429 é possível.
 */
export const joinFamily = async (code: string): Promise<FamilyResponse> => {
  const response = await api.post<FamilyResponse>("/family/join", { code });
  return response.data;
};

/**
 * OWNER remove qualquer outro; MEMBER só o próprio. `"me"` é aceito como id
 * para "sair" — e sair apaga os parâmetros de compartilhamento do membro.
 */
export const removeFamilyMember = async (memberId: string): Promise<void> => {
  await api.delete(`/family/members/${memberId}`);
};

/** 400 quando uma categoria ou conta listada não é do chamador. */
export const updateFamilySharing = async (
  sharing: FamilySharing,
): Promise<FamilySharing> => {
  const response = await api.put<FamilySharing>("/family/sharing", sharing);
  return response.data;
};

/** Mesma gramática de recorte de `/analytics/monthly`: `month` XOR janela. */
export const getFamilyAnalytics = async (
  range: AnalysisRange,
): Promise<FamilyAnalyticsResponse> => {
  const response = await api.get<FamilyAnalyticsResponse>(
    "/family/analytics/monthly",
    { params: rangeParams(range) },
  );
  return response.data;
};

/**
 * Só linhas de membros com `TRANSACTIONS` (o próprio chamador sempre
 * completo); categoria oculta e conta não compartilhada vêm AUSENTES — o
 * filtro é do servidor, e o app não tem como (nem deve) refazê-lo.
 */
export const getFamilyTransactions = async (params: {
  range: AnalysisRange;
  memberId?: string;
  categoryId?: string;
}): Promise<FamilyTransaction[]> => {
  const response = await api.get<FamilyTransaction[]>("/family/transactions", {
    params: {
      ...rangeParams(params.range),
      memberId: params.memberId,
      categoryId: params.categoryId,
    },
  });
  return response.data;
};

/**
 * O que a varredura da casa encontrou — EC-189.
 *
 * `against` diz contra quantos outros membros houve nome completo para
 * comparar: zero explica um resultado zerado sem o app ter de adivinhar se
 * não achou nada ou não tinha como procurar.
 */
export interface FamilyTransferOutcome {
  scanned: number;
  marked: number;
  against: number;
}

/**
 * Desconta da casa o dinheiro que só circulou dentro dela — o Pix entre o
 * casal, a mesada, o rateio da luz. Roda pela conta de quem chama: cada pessoa
 * precisa rodar a sua. A marca vale SÓ para a visão da casa; na análise
 * pessoal a linha continua lá, porque o dinheiro entrou mesmo.
 */
export const reconcileFamilyTransfers =
  async (): Promise<FamilyTransferOutcome> => {
    const response = await api.post<FamilyTransferOutcome>(
      "/family/reconcile-transfers",
    );
    return response.data;
  };

/**
 * Diz que a linha é dinheiro do titular trocando de bolso — pagamento de
 * fatura, Pix para si mesmo. Sai de TODAS as somas, não só da casa.
 */
export const setInternalTransfer = async (
  id: string,
  internalTransfer: boolean,
): Promise<BankTransaction> => {
  const response = await api.patch<BankTransaction>(
    `/transactions/${id}/internal`,
    { internalTransfer },
  );
  return response.data;
};

/**
 * Descarta (ou traz de volta) uma linha. Ela some das somas e continua no
 * extrato com selo — nada é apagado, porque reimportar o arquivo não desfaz.
 */
export const setTransactionIgnored = async (
  id: string,
  ignored: boolean,
): Promise<BankTransaction> => {
  const response = await api.patch<BankTransaction>(
    `/transactions/${id}/ignored`,
    { ignored },
  );
  return response.data;
};

/**
 * O que a faxina mexeu. É a mesma rotina que roda sozinha depois de cada
 * importação — este gatilho existe para reprocessar o histórico quando uma
 * regra melhora.
 */
export interface TidyOutcome {
  internalMarked: number;
  /** Aplicação e resgate: trocaram de gaveta, não são gasto nem receita. */
  investmentMarked: number;
  familyMarked: number;
  duplicatesMarked: number;
  /** Pares compra + estorno que se anulam. */
  refundsMarked: number;
  seriesCreated: number;
  seriesUpdated: number;
}

export const tidyStatement = async (): Promise<TidyOutcome> => {
  const response = await api.post<TidyOutcome>("/transactions/tidy");
  return response.data;
};

/** Qual varredura — o mesmo nome que o servidor grava em `sweep_runs.kind`. */
export type WatchmanKind =
  | "INTERNAL_TRANSFER"
  | "INVESTMENT_FLOW"
  | "FAMILY_TRANSFER"
  | "DUPLICATE"
  | "REFUND"
  | "RECURRENCE";

/** Um vigia: quem é e o que faz (EC-202). */
export interface Watchman {
  kind: WatchmanKind;
  name: string;
  /** Uma linha dizendo o que ele faz. Nunca duas. */
  role: string;
  frequency: string;
  /** Se as passadas dele podem ser desfeitas. */
  undoable: boolean;
}

/** O recado de UMA passada. */
export interface WatchmanNote {
  runId: string;
  kind: WatchmanKind;
  watchman: string;
  role: string;
  /** Já vem pronto do servidor, com singular e plural resolvidos. */
  message: string;
  affected: number;
  volume: number | null;
  ranAt: string;
  undone: boolean;
  /**
   * Já vem calculado para a tela não desenhar um botão que não funciona — a
   * detecção de recorrência não se desfaz por aqui.
   */
  canUndo: boolean;
}

/**
 * Quem trabalha no extrato — a lista é FIXA e vem do código.
 *
 * Ela existe para o usuário saber quem mexe nos números dele mesmo antes da
 * primeira passada: um trabalhador que só aparece depois de mexer já apareceu
 * tarde.
 */
export const getWatchmen = async (): Promise<Watchman[]> => {
  const response = await api.get<Watchman[]>("/watchmen");
  return response.data;
};

/** As 50 passadas mais recentes, da mais nova para a mais velha. */
export const getWatchmanNotes = async (): Promise<WatchmanNote[]> => {
  const response = await api.get<WatchmanNote[]>("/watchmen/notes");
  return response.data;
};

/**
 * Solta exatamente as linhas que AQUELA passada marcou — nunca a varredura
 * inteira. Uma linha marcada à mão depois continua marcada, porque decisão de
 * gente vence varredura em qualquer direção.
 */
export const undoSweepRun = async (runId: string): Promise<WatchmanNote> => {
  const response = await api.post<WatchmanNote>(`/watchmen/notes/${runId}/undo`);
  return response.data;
};

/** Correção manual de uma linha: a decisão da pessoa vence a varredura. */
export const setFamilyTransfer = async (
  id: string,
  familyTransfer: boolean,
): Promise<BankTransaction> => {
  const response = await api.patch<BankTransaction>(
    `/transactions/${id}/family-transfer`,
    { familyTransfer },
  );
  return response.data;
};

/**
 * Registra que o valor da fatura já está separado — EC-181. Não cria
 * lançamento nenhum: o dinheiro não saiu, e inventar um débito falsificaria o
 * extrato. Chamar de novo sobrescreve, que é o comum enquanto a fatura cresce.
 */
export const saveInvoiceReserve = async (
  accountId: string,
  reference: string,
  body: { amount: number; heldInAccountId?: string | null; note?: string | null },
): Promise<InvoiceReserve> => {
  const response = await api.put<InvoiceReserve>(
    `/accounts/${accountId}/invoices/${reference}/reserve`,
    body,
  );
  return response.data;
};

/** Desfaz a reserva: o dono gastou em outra coisa, ou a fatura já foi paga. */
export const deleteInvoiceReserve = async (
  accountId: string,
  reference: string,
): Promise<void> => {
  await api.delete(`/accounts/${accountId}/invoices/${reference}/reserve`);
};

// --- Segundo fator (TOTP) ---

export interface MfaStatus {
  enabled: boolean;
  /** Cadastro começado e não confirmado: o login ainda NÃO pede código. */
  pendingConfirmation: boolean;
  confirmedAt: string | null;
  recoveryCodesRemaining: number;
}

export interface MfaSetup {
  /** O segredo em texto, para quem digita à mão. Só vem UMA vez. */
  secret: string;
  /** A mesma coisa em forma de QR — `otpauth://totp/...`. */
  otpauthUri: string;
}

export const getMfaStatus = async (): Promise<MfaStatus> => {
  const response = await api.get<MfaStatus>("/mfa");
  return response.data;
};

/** Gera um segredo novo. Repetir antes de confirmar TROCA o anterior. */
export const startMfaSetup = async (): Promise<MfaSetup> => {
  const response = await api.post<MfaSetup>("/mfa/setup");
  return response.data;
};

/** Confirma com o primeiro código e devolve os códigos de recuperação. */
export const activateMfa = async (code: string): Promise<string[]> => {
  const response = await api.post<{ codes: string[] }>("/mfa/activate", {
    code,
  });
  return response.data.codes;
};

/** Novo lote; o anterior deixa de valer por inteiro. */
export const rotateMfaRecoveryCodes = async (): Promise<string[]> => {
  const response = await api.post<{ codes: string[] }>("/mfa/recovery-codes");
  return response.data.codes;
};

/** Desligar pede a SENHA, e não um código — ver o DTO no servidor. */
export const disableMfa = async (password: string): Promise<void> => {
  await api.post("/mfa/disable", { password });
};

// --- Versão mínima ---

/** Resposta pública de `GET /app/version`. */
export interface VersionInfo {
  /** Abaixo disto o servidor recusa (426). */
  minVersion: string;
  /** A última publicada — acima da mínima é aviso, não bloqueio. */
  latestVersion: string;
  /** Página de download (a `baixar.html` do site). */
  downloadUrl: string;
  storeUrl: string | null;
  /** APK direto, quando publicado; `null` enquanto não há. */
  apkUrl?: string | null;
  message?: string | null;
  apiVersion?: string;
  schemaVersion?: string;
}

/** O ProblemDetail que acompanha o 426. Tudo opcional: é corpo de erro. */
export interface UpgradeRequiredProblem {
  type?: string;
  title?: string;
  detail?: string;
  minVersion?: string;
  downloadUrl?: string;
}

// Curto de propósito: a consulta roda na abertura do app e não pode segurar
// nada. Se a API estiver hibernada, o poll do serverStore acorda ela pela
// primeira requisição de verdade — esta aqui só falha em silêncio e tenta na
// próxima abertura
const VERSION_CHECK_TIMEOUT_MS = 8000;

/**
 * Consulta de versão. Vai pelo axios CRU, e não pela instância `api`, por
 * três razões: não leva token (a rota é pública), não pode disparar o aviso
 * de "acordando o servidor" nem os retries do interceptor (é checagem de
 * fundo), e o 426 dela não faz sentido — é ela quem diz o que é 426.
 */
export const getAppVersion = async (): Promise<VersionInfo> => {
  const response = await axios.get<VersionInfo>(`${getBaseUrl()}/app/version`, {
    timeout: VERSION_CHECK_TIMEOUT_MS,
    headers: versionHeaders(),
    // O endpoint responde `Cache-Control: public, max-age=300` de propósito --
    // é o que impede um app antigo consultando em laço de virar carga na
    // instância gratuita. Mas isso fazia a ABERTURA do app ler um documento de
    // até cinco minutos atrás: o dono publicou a versão nova, abriu o app e
    // nada apareceu; só depois de fechar e abrir várias vezes o aviso surgiu,
    // quando o cache venceu.
    //
    // O parâmetro muda a URL a cada consulta, então esta chamada nunca vem do
    // cache. Ela acontece na abertura e no retorno do bloqueio -- um punhado
    // de vezes por dia, não em laço --, e o cabeçalho do servidor continua
    // valendo para todo o resto.
    params: { _: Date.now() },
  });
  return response.data;
};

// --- Plano (Gratuito × Plus) ---

export type PlanId = "FREE" | "PLUS";

export interface PlanOption {
  id: PlanId;
  name: string;
  /** Em reais por mês; zero no gratuito. */
  priceMonthly: number;
  features: string[];
}

export interface PlansResponse {
  current: PlanId;
  plans: PlanOption[];
  /** Enquanto `false`, o app só registra interesse — não há como pagar. */
  checkoutAvailable: boolean;
  interestRegistered: boolean;
  /**
   * Até quando o plano pago vale. Null em gratuito e no Plus sem prazo.
   *
   * É o número que permite dizer a DATA exata em vez de "sua assinatura
   * continua ativa" — a frase que não responde nada a quem acabou de cancelar.
   */
  activeUntil: string | null;
  /** Quando a pessoa pediu para sair; null = não pediu (EC-208). */
  cancelledAt: string | null;
}

export interface CancelPlanOutcome {
  cancelledAt: string;
  /** Até quando o acesso pago continua; null quando não havia prazo. */
  activeUntil: string | null;
  /** A frase pronta do servidor — a tela não recompõe a regra. */
  message: string;
}

/**
 * Cancela a renovação do plano pago (EC-208).
 *
 * O acesso NÃO é cortado na hora: quem pagou até o dia 20 usa até o dia 20.
 * Idempotente — cancelar de novo devolve a mesma resposta, porque quem toca
 * duas vezes está inseguro e um erro na segunda confirma o medo.
 */
export const cancelPlan = async (): Promise<CancelPlanOutcome> => {
  const response = await api.post<CancelPlanOutcome>("/plans/cancel");
  return response.data;
};

/** O assunto de um chamado (EC-209) — lista curta, para não virar triagem. */
export type SupportSubject =
  | "NUMERO_ERRADO"
  | "IMPORTACAO"
  | "CONEXAO"
  | "COBRANCA"
  | "CONTA"
  | "OUTRO";

export type SupportStatus = "OPEN" | "ANSWERED" | "CLOSED";

export interface SupportTicket {
  id: string;
  subject: SupportSubject;
  message: string;
  status: SupportStatus;
  /** Até quando prometemos responder — gravado no chamado, não numa frase. */
  respondBy: string;
  answer: string | null;
  answeredAt: string | null;
  /** O prazo passou sem resposta. A tela precisa poder dizer isso. */
  overdue: boolean;
  createdAt: string;
}

/**
 * Abre um chamado que sobrevive a fechar o app.
 *
 * A tela e a versão viajam junto: sem elas, metade dos chamados começa com uma
 * ida e volta só para descobrir onde a pessoa estava — e cada ida e volta
 * custa um dia.
 */
export const openSupportTicket = async (payload: {
  subject: SupportSubject;
  message: string;
  appVersion?: string | null;
  screen?: string | null;
}): Promise<SupportTicket> => {
  const response = await api.post<SupportTicket>("/support/tickets", payload);
  return response.data;
};

/** Os chamados da pessoa — é esta lista que prova que nada sumiu. */
export const getSupportTickets = async (): Promise<SupportTicket[]> => {
  const response = await api.get<SupportTicket[]>("/support/tickets");
  return response.data;
};

/** Encerrar é da pessoa: quem resolveu sozinho não espera alguém fechar. */
export const closeSupportTicket = async (id: string): Promise<SupportTicket> => {
  const response = await api.post<SupportTicket>(`/support/tickets/${id}/close`);
  return response.data;
};

export const getPlans = async (): Promise<PlansResponse> => {
  const response = await api.get<PlansResponse>("/plans");
  return response.data;
};

/** "Tenho interesse": 204, sem corpo. Repetir é idempotente no servidor. */
export const registerPlanInterest = async (plan: PlanId): Promise<void> => {
  await api.post("/plans/interest", { plan });
};

/**
 * Os campos de plano que `GET /users/me` passou a devolver. Declarados aqui,
 * à parte, e não dentro de `UserMe`, para a mudança ficar no fim do arquivo
 * (é a regra desta rodada: o miolo está sendo reescrito em paralelo). Quando
 * a rodada fechar, o natural é mudá-los para dentro de `UserMe`. Todos
 * opcionais porque o servidor pode ser mais velho que o app: sem eles, o app
 * assume gratuito com anúncios.
 */
export interface UserPlanFields {
  plan?: PlanId;
  /** Até quando o Plus vale; `null` no gratuito e no Plus sem prazo. */
  planUntil?: string | null;
  adsEnabled?: boolean;
}

/** O perfil como o servidor NOVO o devolve — é o que `getUserMe` traz na prática. */
export type UserMeWithPlan = UserMe & UserPlanFields;
// ---------------------------------------------------------- Investimentos

/**
 * De onde uma posição veio. As três fontes convivem na mesma lista, e a tela
 * nunca esconde qual é qual: só a MANUAL pode ser editada por aqui — as outras
 * são espelho do banco, e mexer no espelho não muda o que está no banco.
 */
export type InvestmentSource = "CONNECTOR" | "STATEMENT" | "MANUAL";

export type InvestmentType =
  | "FIXED_INCOME"
  | "TREASURY"
  | "FUND"
  | "EQUITY"
  | "ETF"
  | "CRYPTO"
  | "PENSION"
  | "OTHER";

/** Ao que a rentabilidade está atrelada. `NONE` é ativo sem indexador (ação, cripto). */
export type InvestmentIndexer =
  | "CDI"
  | "SELIC"
  | "IPCA"
  | "PREFIXADO"
  | "USD"
  | "NONE";

export interface InvestmentTypeShare {
  type: InvestmentType;
  label: string;
  currentValue: number;
  /** Fração de 0 a 1 do valor atual total. */
  share: number;
}

export interface InvestmentInstitutionShare {
  institution: string;
  currentValue: number;
  share: number;
}

export interface InvestmentIndexerShare {
  indexer: InvestmentIndexer;
  currentValue: number;
  share: number;
}

export interface InvestmentMovementTotals {
  applied: number;
  redeemed: number;
  yield: number;
}

export interface InvestmentSummary {
  totalInvested: number;
  currentValue: number;
  profit: number;
  /** Nulo quando não há base de custo — zero afirmaria "nada rendeu". */
  profitPercent: number | null;
  positionsCount: number;
  byType: InvestmentTypeShare[];
  byInstitution: InvestmentInstitutionShare[];
  byIndexer: InvestmentIndexerShare[];
  updatedAt: string | null;
  /** Quantas posições estão com a data de posição vencida (ver `stale`). */
  stalePositions: number;
  sources: InvestmentSource[];
  /**
   * Códigos das posições manuais em moeda estrangeira: elas só ganham valor
   * em reais quando a cotação do papel chega (`getForeignQuote`).
   */
  needsQuote: string[];
  movements12m: InvestmentMovementTotals & { net: number };
}

export interface InvestmentPosition {
  id: string;
  source: InvestmentSource;
  institution: string | null;
  accountId: string | null;
  name: string;
  /** Ticker ou código do papel; nulo em CDB/fundo sem código negociável. */
  code: string | null;
  type: InvestmentType;
  /** Recorte livre do servidor (CDB, LCI, TESOURO_SELIC, FII...). */
  subtype: string | null;
  indexer: InvestmentIndexer | null;
  /** Taxa na gramática do indexador: 110 (% do CDI), 6.2 (IPCA + 6,2% a.a.). */
  rate: number | null;
  /** ISO 4217; nulo vale BRL. */
  currency: string | null;
  quantity: number | null;
  unitPrice: number | null;
  investedAmount: number | null;
  /** Em reais para tudo que vem do banco; na manual em moeda estrangeira pode vir nulo. */
  currentValue: number | null;
  maturityDate: string | null;
  positionDate: string | null;
  updatedAt: string | null;
  /** A data de posição ficou para trás: o valor é de um dia que já passou. */
  stale: boolean;
}

/** Corpo do cadastro manual. Só `name` e `type` são obrigatórios no servidor. */
export interface InvestmentPositionPayload {
  name: string;
  type: InvestmentType;
  subtype?: string | null;
  code?: string | null;
  indexer?: InvestmentIndexer | null;
  rate?: number | null;
  currency?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  investedAmount?: number | null;
  currentValue?: number | null;
  maturityDate?: string | null;
  institution?: string | null;
}

export type InvestmentMovementKind = "APPLY" | "REDEEM" | "YIELD" | "OTHER";

/** Lançamento do extrato que o servidor reconheceu como movimento de investimento. */
export interface InvestmentMovement {
  transactionId: string;
  date: string;
  kind: InvestmentMovementKind;
  amount: number;
  description: string;
  institution: string | null;
  accountId: string | null;
}

export interface InvestmentMovements {
  items: InvestmentMovement[];
  totals: InvestmentMovementTotals;
  /** Aplicado menos resgatado na janela. */
  netInvested: number;
}

export interface InvestmentSyncResult {
  synced: boolean;
  created: number;
  updated: number;
  itemsRead: number;
  skippedItems: number;
}

export type InvestmentInterestKind = "RATE" | "INDEX" | "CURRENCY" | "TICKER";

/** Um indicador que o usuário acompanha. `market` só faz sentido em TICKER. */
export interface InvestmentInterest {
  kind: InvestmentInterestKind;
  code: string;
  market?: string | null;
}

/**
 * O perfil do investidor, derivado do que ele TEM (posições, movimentos) e
 * do que pediu para acompanhar. É ele que decide quais indicadores aparecem,
 * quais títulos do Tesouro são relevantes e quais tópicos entram no radar.
 * `isDefault` marca o perfil genérico de quem ainda não tem nada.
 */
export interface InvestmentProfile {
  indexers: InvestmentIndexer[];
  watch: InvestmentInterest[];
  topics: string[];
  derivedFrom: {
    positions: number;
    movements: number;
    manualInterests: number;
  };
  isDefault: boolean;
}

export type MacroIndicatorCode =
  | "CDI"
  | "SELIC"
  | "IPCA_MES"
  | "IPCA_12M"
  | "USD_PTAX"
  | "POUPANCA"
  | "IGPM";

export interface MacroIndicator {
  code: MacroIndicatorCode;
  name: string;
  value: number;
  /** "% a.a.", "%" ou "BRL" — decide o formato na tela. */
  unit: string;
  referenceDate: string;
  source: string;
  asOf: string;
  /** O provedor não atualizou hoje: a tela diz de que dia é o número. */
  stale: boolean;
}

export type TreasuryIndexer = "SELIC" | "IPCA" | "PREFIXADO" | "OTHER";

export interface TreasuryBond {
  name: string;
  indexer: TreasuryIndexer;
  maturity: string;
  annualRateBuy: number | null;
  annualRateSell: number | null;
  unitPriceBuy: number | null;
  unitPriceSell: number | null;
  minInvestment: number | null;
  asOf: string;
  source: string;
}

/** Cotação de papel no exterior, já com a conversão para reais quando o servidor tem o câmbio. */
export interface ForeignQuote {
  symbol: string;
  market: string;
  price: number;
  currency: string;
  priceBrl: number | null;
  change: number | null;
  changePercent: number | null;
  date: string;
  source: string;
  asOf: string;
  stale: boolean;
}

export interface NewsTopic {
  id: string;
  label: string;
}

/** Manchete do radar: o mesmo artigo de hoje, com os tópicos que o trouxeram. */
export interface TopicNewsArticle extends NewsArticle {
  topics: string[];
}

export interface TopicNewsResponse {
  status: string;
  totalResults: number;
  articles: TopicNewsArticle[];
  updatedAt: string | null;
}

export const getInvestmentSummary = async (): Promise<InvestmentSummary> => {
  const response = await api.get<InvestmentSummary>("/investments/summary");
  return response.data;
};

export const getInvestmentPositions = async (): Promise<InvestmentPosition[]> => {
  const response = await api.get<InvestmentPosition[]>("/investments/positions");
  return response.data;
};

export const createInvestmentPosition = async (
  payload: InvestmentPositionPayload,
): Promise<InvestmentPosition> => {
  const response = await api.post<InvestmentPosition>(
    "/investments/positions",
    payload,
  );
  return response.data;
};

/** Só posição MANUAL aceita PATCH; as outras respondem 409 no servidor. */
export const updateInvestmentPosition = async (
  id: string,
  patch: Partial<InvestmentPositionPayload>,
): Promise<InvestmentPosition> => {
  const response = await api.patch<InvestmentPosition>(
    `/investments/positions/${id}`,
    patch,
  );
  return response.data;
};

export const deleteInvestmentPosition = async (id: string): Promise<void> => {
  await api.delete(`/investments/positions/${id}`);
};

export const getInvestmentMovements = async (
  months = 12,
): Promise<InvestmentMovements> => {
  const response = await api.get<InvestmentMovements>("/investments/movements", {
    params: { months },
  });
  return response.data;
};

/** 503 quando o conector está desligado — o chamador traduz pelo status. */
export const syncInvestments = async (): Promise<InvestmentSyncResult> => {
  const response = await api.post<InvestmentSyncResult>("/investments/sync");
  return response.data;
};

export const getInvestmentProfile = async (): Promise<InvestmentProfile> => {
  const response = await api.get<InvestmentProfile>("/investments/profile");
  return response.data;
};

/** 204; repetir um interesse já existente é idempotente no servidor. */
export const addInvestmentInterest = async (
  interest: InvestmentInterest,
): Promise<void> => {
  await api.post("/investments/interests", interest);
};

export const removeInvestmentInterest = async (
  kind: InvestmentInterestKind,
  code: string,
): Promise<void> => {
  await api.delete(
    `/investments/interests/${kind}/${encodeURIComponent(code)}`,
  );
};

export const getMacroIndicators = async (): Promise<MacroIndicator[]> => {
  const response = await api.get<MacroIndicator[]>("/indicators/macro");
  return response.data;
};

export const getTreasuryBonds = async (): Promise<TreasuryBond[]> => {
  const response = await api.get<TreasuryBond[]>("/indicators/treasury");
  return response.data;
};

export const getForeignQuote = async (
  symbol: string,
  market = "US",
): Promise<ForeignQuote> => {
  const response = await api.get<ForeignQuote>(
    `/indicators/quote/${encodeURIComponent(symbol)}`,
    { params: { market } },
  );
  return response.data;
};

export const getNewsTopics = async (): Promise<NewsTopic[]> => {
  const response = await api.get<NewsTopic[]>("/news/topics");
  return response.data;
};

/**
 * Manchetes filtradas pelos tópicos do perfil. Os ids vão numa lista
 * separada por vírgula, que é a gramática que o servidor lê.
 */
export const getNewsByTopics = async (
  topics: string[],
  limit = 5,
): Promise<TopicNewsResponse> => {
  const response = await api.get<TopicNewsResponse>("/news/top-headlines", {
    params: { topics: topics.join(","), limit },
  });
  return response.data;
};
