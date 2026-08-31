import { create } from "zustand";

import {
  type CommittedOverview,
  type CreateWishPayload,
  type IncomeOverview,
  type IncomeSourceKind,
  type UpdateWishPayload,
  type Wish,
  type WishBaseline,
  acceptIncomeSuggestion,
  createIncomeSource,
  createWish,
  deleteIncomeSource,
  deleteWish,
  getCommittedOverview,
  getIncomeOverview,
  getWishes,
  purchaseWish,
  saveWorkProfile,
  updateIncomeSource,
  updateWish,
} from "../services/api";
import { translateWishError } from "../utils/wishes";

/** Toda ação devolve isto: a tela decide o que dizer, o store não fala. */
export interface WishOutcome {
  ok: boolean;
  message: string;
}

interface WishState {
  /** Retrato financeiro compartilhado por todos os desejos da lista. */
  baseline: WishBaseline | null;
  wishes: Wish[];
  income: IncomeOverview | null;
  /** O que já tem dono do próximo salário (EC-136). */
  committed: CommittedOverview | null;

  isLoading: boolean;
  hasLoadedOnce: boolean;
  isSaving: boolean;
  isIncomeLoading: boolean;
  hasLoadedIncomeOnce: boolean;
  isCommittedLoading: boolean;
  hasLoadedCommittedOnce: boolean;

  error: string | null;
  incomeError: string | null;
  committedError: string | null;

  fetch: () => Promise<void>;
  fetchIncome: () => Promise<void>;
  fetchCommitted: () => Promise<void>;

  create: (payload: CreateWishPayload) => Promise<WishOutcome>;
  update: (id: string, payload: UpdateWishPayload) => Promise<WishOutcome>;
  remove: (id: string) => Promise<WishOutcome>;
  purchase: (
    id: string,
    payload?: { purchasedAt?: string; transactionId?: string },
  ) => Promise<WishOutcome>;

  saveJourney: (payload: {
    daysPerWeek: number;
    hoursPerDay: number;
  }) => Promise<WishOutcome>;
  addIncome: (payload: {
    kind: IncomeSourceKind;
    name: string;
    expectedAmount?: number | null;
    anchorDay?: number | null;
  }) => Promise<WishOutcome>;
  acceptSuggestion: (seriesId: string) => Promise<WishOutcome>;
  editIncome: (
    id: string,
    payload: {
      name?: string;
      expectedAmount?: number | null;
      anchorDay?: number | null;
      confirmed?: boolean;
      active?: boolean;
    },
  ) => Promise<WishOutcome>;
  removeIncome: (id: string) => Promise<WishOutcome>;

  reset: () => void;
}

const EMPTY = {
  baseline: null,
  wishes: [],
  income: null,
  committed: null,
  isLoading: false,
  hasLoadedOnce: false,
  isSaving: false,
  isIncomeLoading: false,
  hasLoadedIncomeOnce: false,
  isCommittedLoading: false,
  hasLoadedCommittedOnce: false,
  error: null,
  incomeError: null,
  committedError: null,
};

export const useWishStore = create<WishState>((set, get) => ({
  ...EMPTY,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getWishes();
      set({
        baseline: data.baseline,
        wishes: data.wishes,
        isLoading: false,
        hasLoadedOnce: true,
      });
    } catch (e) {
      set({
        error: translateWishError(e, "Não foi possível carregar seus desejos."),
        isLoading: false,
      });
    }
  },

  fetchIncome: async () => {
    set({ isIncomeLoading: true, incomeError: null });
    try {
      const data = await getIncomeOverview();
      set({
        income: data,
        isIncomeLoading: false,
        hasLoadedIncomeOnce: true,
      });
    } catch (e) {
      set({
        incomeError: translateWishError(
          e,
          "Não foi possível carregar suas fontes de renda.",
        ),
        isIncomeLoading: false,
      });
    }
  },

  fetchCommitted: async () => {
    set({ isCommittedLoading: true, committedError: null });
    try {
      const data = await getCommittedOverview();
      set({
        committed: data,
        isCommittedLoading: false,
        hasLoadedCommittedOnce: true,
      });
    } catch (e) {
      set({
        committedError: translateWishError(
          e,
          "Não foi possível ver o que já está comprometido.",
        ),
        isCommittedLoading: false,
      });
    }
  },

  create: async (payload) => {
    set({ isSaving: true });
    try {
      const wish = await createWish(payload);
      // O desejo novo entra na frente porque a listagem do servidor é por
      // criação decrescente — inserir no fim deixaria a tela discordando do
      // que o próximo fetch vai trazer
      set((state) => ({
        wishes: [wish, ...state.wishes],
        isSaving: false,
        error: null,
      }));
      return { ok: true, message: "Desejo criado." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível criar o desejo."),
      };
    }
  },

  update: async (id, payload) => {
    set({ isSaving: true });
    try {
      const wish = await updateWish(id, payload);
      set((state) => ({
        wishes: state.wishes.map((w) => (w.id === id ? wish : w)),
        isSaving: false,
        error: null,
      }));
      return { ok: true, message: "Desejo atualizado." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível salvar o desejo."),
      };
    }
  },

  remove: async (id) => {
    try {
      await deleteWish(id);
      // Sucesso limpa o erro anterior: sem isso, uma falha antiga fica grudada
      // na tela anunciando fracasso logo depois de a exclusão dar certo
      set((state) => ({
        wishes: state.wishes.filter((w) => w.id !== id),
        error: null,
      }));
      return { ok: true, message: "Desejo excluído." };
    } catch (e) {
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível excluir o desejo."),
      };
    }
  },

  purchase: async (id, payload) => {
    set({ isSaving: true });
    try {
      const wish = await purchaseWish(id, payload);
      set((state) => ({
        wishes: state.wishes.map((w) => (w.id === id ? wish : w)),
        isSaving: false,
        error: null,
      }));
      return { ok: true, message: "Compra registrada." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível registrar a compra."),
      };
    }
  },

  saveJourney: async (payload) => {
    set({ isSaving: true });
    try {
      await saveWorkProfile(payload);
      await refreshAfterIncomeChange(get);
      set({ isSaving: false });
      return { ok: true, message: "Jornada salva." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível salvar a jornada."),
      };
    }
  },

  addIncome: async (payload) => {
    set({ isSaving: true });
    try {
      await createIncomeSource(payload);
      await refreshAfterIncomeChange(get);
      set({ isSaving: false });
      return { ok: true, message: "Fonte de renda cadastrada." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível cadastrar a renda."),
      };
    }
  },

  acceptSuggestion: async (seriesId) => {
    set({ isSaving: true });
    try {
      await acceptIncomeSuggestion(seriesId);
      await refreshAfterIncomeChange(get);
      set({ isSaving: false });
      return { ok: true, message: "Renda confirmada." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível confirmar a renda."),
      };
    }
  },

  editIncome: async (id, payload) => {
    set({ isSaving: true });
    try {
      await updateIncomeSource(id, payload);
      await refreshAfterIncomeChange(get);
      set({ isSaving: false });
      return { ok: true, message: "Fonte de renda atualizada." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível salvar a renda."),
      };
    }
  },

  removeIncome: async (id) => {
    set({ isSaving: true });
    try {
      await deleteIncomeSource(id);
      await refreshAfterIncomeChange(get);
      set({ isSaving: false });
      return { ok: true, message: "Fonte de renda removida." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(e, "Não foi possível remover a renda."),
      };
    }
  },

  reset: () => set({ ...EMPTY }),
}));

/**
 * Mexer na renda ou na jornada muda o VALOR DA HORA — e portanto a projeção de
 * todos os desejos. Recarregar só o painel de renda deixaria a tela dizendo
 * "709 h" ao lado de um salário que acabou de mudar.
 *
 * <p>As duas chamadas são SERIAIS de propósito: em paralelo, a listagem de
 * desejos podia partir antes de o servidor terminar de gravar a fonte e voltar
 * com a projeção antiga — a mesma corrida que já mordeu a conexão de bancos.
 */
async function refreshAfterIncomeChange(get: () => WishState): Promise<void> {
  await get().fetchIncome();
  await get().fetch();
  // A âncora e o valor do salário decidem "quando cai" e "quanto sobra": sem
  // esta terceira recarga, o cartão do salário ficaria falando da fonte antiga
  if (get().hasLoadedCommittedOnce) await get().fetchCommitted();
}
