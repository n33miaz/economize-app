import { create } from "zustand";

import {
  type CommittedOverview,
  type CreateWishPayload,
  type IncomeOverview,
  type IncomePattern,
  type IncomeSourceKind,
  type PurchasePreferencePayload,
  type UpdateWishPayload,
  type Wish,
  type WishBaseline,
  acceptIncomeSuggestion,
  clearPurchasePreference,
  createIncomeSource,
  createWish,
  deleteIncomeSource,
  deleteWish,
  getCommittedOverview,
  getIncomeOverview,
  getIncomePattern,
  getWishes,
  purchaseWish,
  savePurchasePreference,
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
  /**
   * Quando cada renda cai, em dias úteis, e o melhor dia para as compras
   * (EC-237). `null` enquanto não carregou — e também quando o servidor é
   * de uma versão anterior ao endpoint: as telas tratam os dois casos como
   * "não há o que mostrar", nunca como erro na cara.
   */
  incomePattern: IncomePattern | null;

  isLoading: boolean;
  hasLoadedOnce: boolean;
  isSaving: boolean;
  isIncomeLoading: boolean;
  hasLoadedIncomeOnce: boolean;
  isCommittedLoading: boolean;
  hasLoadedCommittedOnce: boolean;
  isPatternLoading: boolean;
  hasLoadedPatternOnce: boolean;

  error: string | null;
  incomeError: string | null;
  committedError: string | null;
  patternError: string | null;

  fetch: () => Promise<void>;
  fetchIncome: () => Promise<void>;
  fetchCommitted: () => Promise<void>;
  fetchIncomePattern: () => Promise<void>;
  savePurchasePreference: (
    payload: PurchasePreferencePayload,
  ) => Promise<WishOutcome>;
  clearPurchasePreference: () => Promise<WishOutcome>;

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
  incomePattern: null,
  isLoading: false,
  hasLoadedOnce: false,
  isSaving: false,
  isIncomeLoading: false,
  hasLoadedIncomeOnce: false,
  isCommittedLoading: false,
  hasLoadedCommittedOnce: false,
  isPatternLoading: false,
  hasLoadedPatternOnce: false,
  error: null,
  incomeError: null,
  committedError: null,
  patternError: null,
};

export const useWishStore = create<WishState>((set, get) => ({
  ...EMPTY,

  fetch: async () => {
    // Uma busca em voo basta: dois focos no mesmo instante (montagem + volta
    // de uma folha) pediam a mesma lista duas vezes, e na instância gratuita
    // isso é o dobro de trabalho para o mesmo resultado
    if (get().isLoading) return;
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

  fetchIncomePattern: async () => {
    // Home e Previsão pedem o padrão no mesmo foco; a Previsão ainda pede de
    // novo quando a fonte muda. Uma busca em voo por vez — o cálculo do
    // servidor lê as datas de todas as quedas, e é caro na instância gratuita
    if (get().isPatternLoading) return;
    set({ isPatternLoading: true, patternError: null });
    try {
      const data = await getIncomePattern();
      set({
        incomePattern: data,
        isPatternLoading: false,
        hasLoadedPatternOnce: true,
      });
    } catch (e) {
      // Servidor de versão anterior responde 404: não é falha da tela, é
      // ausência da funcionalidade. Fica registrado, mas o padrão anterior
      // (se houver) continua de pé e nada vermelho aparece por causa disto
      set({
        patternError: translateWishError(
          e,
          "Não foi possível calcular o melhor dia para as compras.",
        ),
        isPatternLoading: false,
        hasLoadedPatternOnce: true,
      });
    }
  },

  savePurchasePreference: async (payload) => {
    set({ isSaving: true });
    try {
      await savePurchasePreference(payload);
      // A preferência muda o dia recomendado: sem recarregar, o card ficaria
      // dizendo "mensal" com a pessoa tendo acabado de escolher "semanal"
      await get().fetchIncomePattern();
      set({ isSaving: false });
      return { ok: true, message: "Preferência de compra salva." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(
          e,
          "Não foi possível salvar como você compra.",
        ),
      };
    }
  },

  clearPurchasePreference: async () => {
    set({ isSaving: true });
    try {
      await clearPurchasePreference();
      await get().fetchIncomePattern();
      set({ isSaving: false });
      return { ok: true, message: "O app volta a deduzir do seu extrato." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateWishError(
          e,
          "Não foi possível voltar a deduzir do extrato.",
        ),
      };
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
  // E o melhor dia de compra nasce das mesmas fontes: cadastrar o vale é o
  // que faz o card sair de "não sei" para uma data. Só se alguém já pediu —
  // quem nunca abriu a Previsão não paga o cálculo
  if (get().hasLoadedPatternOnce) await get().fetchIncomePattern();
}
