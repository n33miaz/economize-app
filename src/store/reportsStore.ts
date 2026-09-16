import { create } from "zustand";
import api from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

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
  /** `true` quando o servidor confirmou a exclusão; a tela decide o que dizer. */
  remove: (id: string) => Promise<boolean>;
}

/**
 * Número da última busca pedida.
 *
 * <p><b>Por que sequência e não uma guarda de "já tem uma em voo".</b> Esta
 * busca tem PARÂMETRO: trocar o período dispara outra. Uma guarda de em-voo
 * descartaria o pedido NOVO e a tela ficaria no período velho — o contrário do
 * que o usuário acabou de pedir. Aqui todo pedido sai; só o mais recente pode
 * escrever.
 *
 * <p>O defeito que isto fecha: tocar "Mensal" e depois "Anual" num intervalo
 * curto, com a instância gratuita lenta, deixava a resposta de "Mensal"
 * chegando DEPOIS e sobrescrevendo a lista — a tela mostrava relatórios
 * mensais sob o rótulo "Anual", sem nenhum erro em lugar nenhum.
 *
 * <p>Fora do store de propósito: é contador de processo, não estado de tela.
 * Dentro do estado ele viraria mais um campo para todo componente re-renderizar
 * a cada busca.
 */
let ultimaBusca = 0;

export const useReportsStore = create<ReportsState>((set, get) => ({
  items: [],
  isLoading: false,
  isGenerating: false,
  error: null,

  fetch: async (period) => {
    const minhaVez = ++ultimaBusca;
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<{ content: Report[] }>("/reports", {
        params: { period, page: 0, size: 20 },
      });
      // Resposta atrasada de um período que já não está na tela é descartada
      if (minhaVez !== ultimaBusca) return;
      set({ items: response.data?.content ?? [], isLoading: false });
    } catch (e) {
      if (minhaVez !== ultimaBusca) return;
      set({
        error: describeLoadFailure(e, "Falha ao carregar relatórios"),
        isLoading: false,
      });
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
    } catch {
      set({ error: "Falha ao gerar relatório", isGenerating: false });
      return null;
    }
  },

  remove: async (id) => {
    try {
      await api.delete(`/reports/${id}`);
      // Limpar o erro no sucesso não é detalhe: sem isso, uma falha antiga
      // ficava grudada no estado e qualquer tela que lesse `error` para decidir
      // o que dizer continuava anunciando fracasso depois de dar certo
      set({ items: get().items.filter((r) => r.id !== id), error: null });
      return true;
    } catch {
      set({ error: "Falha ao remover relatório" });
      return false;
    }
  },
}));
