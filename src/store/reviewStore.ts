import { create } from "zustand";
import {
  ReviewApplyItem,
  ReviewGroup,
  applyReview,
  confirmAllReview,
  getReviewQueue,
} from "../services/api";

interface ReviewState {
  groups: ReviewGroup[];
  // escopo atual da fila: uma importação específica ou tudo que está pendente
  uploadId: string | null;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;

  fetchQueue: (uploadId?: string) => Promise<void>;
  apply: (items: ReviewApplyItem[]) => Promise<number>;
  confirmAll: () => Promise<number>;
  pendingTransactionsCount: () => number;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  groups: [],
  uploadId: null,
  isLoading: false,
  isApplying: false,
  error: null,

  fetchQueue: async (uploadId) => {
    set({ isLoading: true, error: null, uploadId: uploadId ?? null });
    try {
      const groups = await getReviewQueue(uploadId);
      set({ groups, isLoading: false });
    } catch {
      set({ error: "Falha ao carregar a fila de revisão.", isLoading: false });
    }
  },

  apply: async (items) => {
    set({ isApplying: true, error: null });
    try {
      const outcome = await applyReview(items);
      // remove localmente o que foi decidido — a fila responde na hora
      const decided = new Set(items.flatMap((i) => i.transactionIds));
      const groups = get()
        .groups.map((g) => ({
          ...g,
          transactions: g.transactions.filter((t) => !decided.has(t.id)),
        }))
        .filter((g) => g.transactions.length > 0);
      set({ groups, isApplying: false });
      return outcome.confirmed;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || "Falha ao aplicar revisão.", isApplying: false });
      return 0;
    }
  },

  confirmAll: async () => {
    set({ isApplying: true, error: null });
    try {
      const scope = get().uploadId ?? undefined;
      const outcome = await confirmAllReview(scope);
      if (outcome.confirmed === 0) {
        // o servidor não confirmou nada: podar a lista aqui esvaziaria a tela
        // em silêncio, escondendo o que continua pendente de verdade
        set({ isApplying: false });
        await get().fetchQueue(scope);
        return 0;
      }
      // ficam só os grupos sem categoria (que precisam de ajuda do usuário)
      set({
        groups: get().groups.filter((g) => !g.suggestedCategoryId),
        isApplying: false,
      });
      return outcome.confirmed;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || "Falha ao confirmar tudo.", isApplying: false });
      return 0;
    }
  },

  pendingTransactionsCount: () =>
    get().groups.reduce((sum, g) => sum + g.transactions.length, 0),
}));
