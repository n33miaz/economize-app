import axios, { AxiosError } from "axios";
import Constants from "expo-constants";
import * as DocumentPicker from "expo-document-picker";
import { useToastStore } from "../store/toastStore";

const getBaseUrl = () => {
  const envUrl = (process.env as Record<string, string | undefined>)
    .API_BASE_URL;
  if (envUrl) return envUrl;

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(":")[0];
    return `http://${ip}:8080/api`;
  }

  return "https://level-belinda-neemias-8be5fba4.koyeb.app/api";
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000, 
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

    const isNetworkOrServerError =
      !error.response || error.response.status >= 500;

    if (
      isNetworkOrServerError &&
      originalRequest &&
      !originalRequest._retryCount
    ) {
      originalRequest._retryCount = 0;
    }

    if (isNetworkOrServerError && originalRequest._retryCount < 2) {
      originalRequest._retryCount += 1;

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

export interface BankTransaction {
  id: string;
  transactionId: string;
  type: "CREDIT" | "DEBIT";
  amount: number;
  description: string;
  date: string;
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
  const fileToUpload = {
    uri: file.uri,
    name: file.name,
    type: file.mimeType || "application/octet-stream",
  } as any;

  formData.append("file", fileToUpload);

  try {
    const response = await api.post("/bank-statements/upload", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const getBankTransactions = async (): Promise<BankTransaction[]> => {
  try {
    const response = await api.get<BankTransaction[]>("/bank-statements");
    return response.data;
  } catch (error) {
    return [];
  }
};
