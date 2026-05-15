import { create } from "zustand";
import api from "../services/api";

export type ReportPeriod = "WEEKLY" | "MONTHLY" | "YEARLY";

export interface Report {
  id: string;
  period: ReportPeriod;
  startDate: string;
  endDate: string;
  totalIncome: number;
  totalExpense: number;
  dominantCategory: string | null;
  summary: string | null;
  categoriesJson: string | null;
  createdAt: string;
}

interface ReportsState {
  items: Report[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  fetch: (period?: ReportPeriod) => Promise<void>;
  generate: (
    period: ReportPeriod,
    startDate: string,
    endDate: string,
  ) => Promise<Report | null>;
  remove: (id: string) => Promise<void>;
}

export const useReportsStore = create<ReportsState>((set, get) => ({
  items: [],
  isLoading: false,
  isGenerating: false,
  error: null,

  fetch: async (period) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ content: Report[] }>("/reports", {
        params: { period, page: 0, size: 20 },
      });
      set({ items: response.data?.content ?? [], isLoading: false });
    } catch (e: any) {
      set({ error: "Falha ao carregar relatórios", isLoading: false });
    }
  },

  generate: async (period, startDate, endDate) => {
    set({ isGenerating: true, error: null });
    try {
      const response = await api.post<Report>("/reports", {
        period,
        startDate,
        endDate,
      });
      set({
        items: [response.data, ...get().items],
        isGenerating: false,
      });
      return response.data;
    } catch (e: any) {
      set({ error: "Falha ao gerar relatório", isGenerating: false });
      return null;
    }
  },

  remove: async (id) => {
    try {
      await api.delete(`/reports/${id}`);
      set({ items: get().items.filter((r) => r.id !== id) });
    } catch (e: any) {
      set({ error: "Falha ao remover relatório" });
    }
  },
}));
