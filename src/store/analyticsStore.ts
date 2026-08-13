import { create } from "zustand";
import {
  MonthlyAnalytics,
  getAnalyticsMonths,
  getMonthlyAnalytics,
} from "../services/api";

interface AnalyticsState {
  data: MonthlyAnalytics | null;
  months: string[];
  selectedMonth: string | null;
  isLoading: boolean;
  error: string | null;

  // A Home responde sempre pelo mês corrente do usuário; a Análise navega pelo
  // histórico. Consolidação e carregamento separados para que o mês escolhido
  // numa tela não apareça na outra
  homeData: MonthlyAnalytics | null;
  isHomeLoading: boolean;

  fetchMonths: () => Promise<void>;
  fetchMonthly: (month?: string) => Promise<void>;
  fetchHomeMonthly: () => Promise<void>;
}

// Ids de requisição: as telas buscam na montagem e a cada foco, e nada
// sequencia as chamadas — sem isso vence quem responder por último, ainda que
// seja a resposta mais velha (e a Home cairia no onboarding com dados na mão)
let monthlyRequestId = 0;
let homeRequestId = 0;

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  data: null,
  months: [],
  selectedMonth: null,
  isLoading: false,
  error: null,
  homeData: null,
  isHomeLoading: false,

  fetchMonths: async () => {
    try {
      const months = await getAnalyticsMonths();
      set({ months });
      // primeiro acesso: cai no mês mais recente com movimento
      if (!get().selectedMonth && months.length > 0) {
        set({ selectedMonth: months[0] });
      }
    } catch {
      // o seletor fica vazio, mas a consolidação do mês atual ainda funciona
    }
  },

  fetchMonthly: async (month) => {
    const target = month ?? get().selectedMonth ?? undefined;
    const requestId = ++monthlyRequestId;
    set({ isLoading: true, error: null, selectedMonth: target ?? null });
    try {
      const data = await getMonthlyAnalytics(target);
      if (requestId !== monthlyRequestId) return;
      set({ data, isLoading: false, selectedMonth: data.month });
    } catch {
      if (requestId !== monthlyRequestId) return;
      set({ error: "Falha ao carregar a análise do mês.", isLoading: false });
    }
  },

  fetchHomeMonthly: async () => {
    const requestId = ++homeRequestId;
    set({ isHomeLoading: true });
    try {
      // mês mais recente com movimento; sem histórico nenhum, a ausência de
      // mês faz o servidor resolver pelo mês atual
      const months = await getAnalyticsMonths().catch(() => get().months);
      if (requestId !== homeRequestId) return;
      if (months.length > 0) set({ months });
      const data = await getMonthlyAnalytics(months[0]);
      if (requestId !== homeRequestId) return;
      set({ homeData: data, isHomeLoading: false });
    } catch {
      // a Home segue com a última consolidação boa em vez de zerar a tela
      if (requestId !== homeRequestId) return;
      set({ isHomeLoading: false });
    }
  },
}));
