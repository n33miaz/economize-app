import axios, { AxiosError } from "axios";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { useToastStore } from "../store/toastStore";
import { healthUrlFrom, waitForServer } from "../store/serverStore";

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
  description: string;
  date: string;
  categoryId: string | null;
  reviewStatus: ReviewStatus;
  categorizedBy: CategorizedBy | null;
  confidence: number | null;
  normalizedDescription: string | null;
  uploadId: string | null;
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
  normalizedDescription: string | null;
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
  month: string;
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
  month: string;
  totalIncome: number;
  totalExpense: number;
  net: number;
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

export const getTransactions = async (params?: {
  month?: string;
  status?: ReviewStatus;
  categoryId?: string;
}): Promise<BankTransaction[]> => {
  const response = await api.get<BankTransaction[]>("/transactions", {
    params,
  });
  return response.data;
};

// --- Análise mensal ---
export const getMonthlyAnalytics = async (
  month?: string,
): Promise<MonthlyAnalytics> => {
  const response = await api.get<MonthlyAnalytics>("/analytics/monthly", {
    params: month ? { month } : undefined,
  });
  return response.data;
};

export const getAnalyticsMonths = async (): Promise<string[]> => {
  const response = await api.get<string[]>("/analytics/months");
  return response.data;
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
