import axios from "axios";
import Constants from "expo-constants";
import { useAuthStore } from "../store/authStore";

const getBaseUrl = () => {
  if (process.env.API_BASE_URL) {
    return process.env.API_BASE_URL;
  }
  const debuggerHost =
    Constants.expoConfig?.hostUri || Constants.manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(":")[0];
    return `http://${ip}:8080/api`;
  }
  return "https://level-belinda-neemias-8be5fba4.koyeb.app/api";
};

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      useAuthStore.getState().logout();
    } else if (error.code === "ECONNABORTED") {
      console.error("Erro: A conexão demorou muito.");
    } else if (error.message === "Network Error") {
      console.error("Erro de Rede: O celular não consegue alcançar o backend.");
    }
    return Promise.reject(error);
  },
);

export default api;

// --- Interfaces ---
export interface Indicator {
  id: string;
  type: "currency" | "index" | "unknown";
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

export interface HistoricalDataPoint {
  timestamp: string;
  high: number;
}

export interface ConversionResponse {
  currency: string;
  amountBrl: number;
  result: number;
}

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
    console.error(`Erro histórico ${currencyCode}:`, error);
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
    console.error("Erro na conversão:", error);
    return null;
  }
};
