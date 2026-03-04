import { create } from "zustand";
import api, { Indicator, isCurrencyData, isIndexData } from "../services/api";

interface IndicatorState {
  indicators: Indicator[];
  loading: boolean;
  error: string | null;
  fetchIndicators: () => Promise<void>;
  searchIndicators: (query: string) => Promise<Indicator[]>;
  getCurrencies: () => Indicator[];
  getIndexes: () => Indicator[];
  getGlobalCurrencies: (targetCodes: string[]) => Indicator[];
  lastFetched: number | null;
}

export const useIndicatorStore = create<IndicatorState>((set, get) => ({
  indicators: [],
  loading: false,
  error: null,
  lastFetched: null,

  fetchIndicators: async () => {
    const CACHE_TIME = 5 * 60 * 1000; // 5 minutos
    const now = Date.now();
    const { indicators, error, lastFetched } = get();

    if (
      indicators.length > 0 &&
      !error &&
      lastFetched &&
      now - lastFetched < CACHE_TIME
    ) {
      return;
    }

    set({ loading: true, error: null });
    try {
      const response = await api.get<Indicator[]>("/indicators/all");
      set({ indicators: response.data, loading: false });
    } catch (e: any) {
      console.error("Erro ao buscar indicadores:", e);
      set({
        error: "Não foi possível conectar ao servidor.",
        loading: false,
      });
    }
  },

  searchIndicators: async (query: string) => {
    try {
      const response = await api.get<Indicator[]>("/indicators/search", {
        params: { query },
      });
      return response.data;
    } catch (e) {
      console.error("Erro na busca dinâmica:", e);
      return [];
    }
  },

  getCurrencies: () => {
    return get()
      .indicators.filter(isCurrencyData)
      .filter((item) => !item.name.includes("Turismo"));
  },
  getIndexes: () => {
    return get().indicators.filter(isIndexData);
  },

  getGlobalCurrencies: (targetCodes: string[]) => {
    return get()
      .indicators.filter(isCurrencyData)
      .filter((item) => targetCodes.includes(item.code));
  },
}));
