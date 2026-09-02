import { create } from "zustand";

import {
  type FamilyAnalyticsResponse,
  type FamilyInvite,
  type FamilyResponse,
  type FamilySharing,
  type FamilyTransaction,
  createFamily,
  createFamilyInvite,
  deleteFamily,
  getFamily,
  getFamilyAnalytics,
  getFamilyTransactions,
  joinFamily,
  removeFamilyMember,
  renameFamily,
  updateFamilySharing,
} from "../services/api";
import type { AnalysisRange } from "../utils/cycleWindow";
import {
  INVALID_INVITE_MESSAGE,
  translateFamilyError,
} from "../utils/family";

/** Toda ação devolve isto: a tela decide o que dizer, o store não fala. */
export interface FamilyOutcome {
  ok: boolean;
  message: string;
}

/**
 * De quem é a tela: "me" é o extrato e a análise de sempre; "family" é a
 * visão da casa. Vive em memória de propósito — abrir o app começa sempre em
 * "Eu", porque a visão pessoal é a que a pessoa espera ao destravar o celular
 * e a compartilhada é a exceção que ela escolhe olhar.
 */
export type FamilyScope = "me" | "family";

interface FamilyState {
  /** Nulo tanto antes da primeira busca quanto para quem não tem casa. */
  family: FamilyResponse | null;
  /** Derivado de `family`, guardado para as telas lerem sem repetir a conta. */
  hasFamily: boolean;
  hasLoadedOnce: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  scope: FamilyScope;
  setScope: (scope: FamilyScope) => void;

  /**
   * O código emitido NESTA sessão: é a única vez que ele aparece (o `GET` só
   * devolve a validade), então fica aqui até a tela fechar ou outro ser
   * emitido. Morre no `reset()`, como tudo.
   */
  lastInvite: FamilyInvite | null;

  analytics: FamilyAnalyticsResponse | null;
  isAnalyticsLoading: boolean;
  analyticsError: string | null;

  transactions: FamilyTransaction[];
  hasLoadedTransactionsOnce: boolean;
  isTransactionsLoading: boolean;
  transactionsError: string | null;

  fetchFamily: () => Promise<void>;
  create: (name?: string) => Promise<FamilyOutcome>;
  rename: (name: string) => Promise<FamilyOutcome>;
  destroy: () => Promise<FamilyOutcome>;
  emitInvite: () => Promise<FamilyOutcome>;
  join: (code: string) => Promise<FamilyOutcome>;
  removeMember: (memberId: string) => Promise<FamilyOutcome>;
  leave: () => Promise<FamilyOutcome>;
  saveSharing: (sharing: FamilySharing) => Promise<FamilyOutcome>;

  fetchAnalytics: (range: AnalysisRange) => Promise<void>;
  fetchTransactions: (params: {
    range: AnalysisRange;
    memberId?: string;
    categoryId?: string;
  }) => Promise<void>;

  reset: () => void;
}

const EMPTY = {
  family: null as FamilyResponse | null,
  hasFamily: false,
  hasLoadedOnce: false,
  isLoading: false,
  isSaving: false,
  error: null as string | null,
  scope: "me" as FamilyScope,
  lastInvite: null as FamilyInvite | null,
  analytics: null as FamilyAnalyticsResponse | null,
  isAnalyticsLoading: false,
  analyticsError: null as string | null,
  transactions: [] as FamilyTransaction[],
  hasLoadedTransactionsOnce: false,
  isTransactionsLoading: false,
  transactionsError: null as string | null,
};

// Ids de requisição, como no analyticsStore: as telas buscam a cada foco e a
// cada troca de chip, e nada sequencia as chamadas — sem isso vence quem
// responder por último, ainda que seja o recorte que o usuário já abandonou
let familyRequestId = 0;
let analyticsRequestId = 0;
let transactionsRequestId = 0;

// Chave do pedido em voo, como no accountsStore: repetir o pedido IDÊNTICO que
// ainda não voltou não faz nada (a montagem e o foco da tela pedem o mesmo
// recorte a um quadro de distância), mas o pedido de OUTRO recorte sai — e aí
// quem desempata é o id de requisição acima
let analyticsInFlight: string | null = null;
let transactionsInFlight: string | null = null;

function rangeKey(range: AnalysisRange): string {
  return range.kind === "month"
    ? `m:${range.month}`
    : `w:${range.start}:${range.end}`;
}

/** O grupo e tudo que depende dele, num set só, para os dois nunca divergirem. */
function withFamily(family: FamilyResponse | null) {
  return { family, hasFamily: family !== null };
}

/**
 * Sair ou apagar desfaz a casa PARA ESTA TELA: além do grupo, morrem a visão
 * compartilhada em memória e o escopo volta para "Eu" — deixar a Análise em
 * "Casa" sem casa seria uma tela em branco sem explicação.
 */
function withoutFamily() {
  return {
    ...withFamily(null),
    scope: "me" as FamilyScope,
    lastInvite: null,
    analytics: null,
    analyticsError: null,
    transactions: [] as FamilyTransaction[],
    hasLoadedTransactionsOnce: false,
    transactionsError: null,
  };
}

export const useFamilyStore = create<FamilyState>((set, get) => ({
  ...EMPTY,

  setScope: (scope) => {
    // "Casa" sem casa não existe: uma troca atrasada (a pessoa saiu do grupo
    // com o dedo ainda no controle) não pode deixar a tela num escopo vazio
    if (scope === "family" && !get().hasFamily) return;
    set({ scope });
  },

  fetchFamily: async () => {
    const requestId = ++familyRequestId;
    set({ isLoading: true, error: null });
    try {
      // 404 já virou `null` no cliente: sem casa é resposta, não erro
      const family = await getFamily();
      if (requestId !== familyRequestId) return;
      set({
        ...withFamily(family),
        isLoading: false,
        hasLoadedOnce: true,
        // Quem perdeu a casa entre duas buscas (o dono apagou) volta para "Eu"
        ...(family === null ? { scope: "me" as FamilyScope } : null),
      });
    } catch (e) {
      if (requestId !== familyRequestId) return;
      set({
        error: translateFamilyError(e, "Não foi possível carregar sua casa."),
        isLoading: false,
      });
    }
  },

  create: async (name) => {
    set({ isSaving: true });
    try {
      const family = await createFamily(name);
      set({ ...withFamily(family), isSaving: false, error: null, hasLoadedOnce: true });
      return { ok: true, message: "Sua casa foi criada." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível criar a casa."),
      };
    }
  },

  rename: async (name) => {
    set({ isSaving: true });
    try {
      const family = await renameFamily(name);
      set({ ...withFamily(family), isSaving: false, error: null });
      return { ok: true, message: "Nome da casa atualizado." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível renomear a casa."),
      };
    }
  },

  destroy: async () => {
    set({ isSaving: true });
    try {
      await deleteFamily();
      set({ ...withoutFamily(), isSaving: false, error: null });
      return { ok: true, message: "A casa foi desfeita." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível apagar a casa."),
      };
    }
  },

  emitInvite: async () => {
    set({ isSaving: true });
    try {
      const invite = await createFamilyInvite();
      set((state) => ({
        lastInvite: invite,
        // O `GET` seguinte traria a mesma validade; espelhar aqui poupa a ida
        // e deixa a tela dizer "há um convite vivo" no mesmo quadro
        family: state.family
          ? { ...state.family, invite: { code: null, expiresAt: invite.expiresAt } }
          : state.family,
        isSaving: false,
      }));
      return { ok: true, message: "Código gerado. Ele vale por 7 dias." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível gerar o convite."),
      };
    }
  },

  join: async (code) => {
    set({ isSaving: true });
    try {
      const family = await joinFamily(code);
      set({ ...withFamily(family), isSaving: false, error: null, hasLoadedOnce: true });
      return { ok: true, message: `Você entrou em "${family.name}".` };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível entrar na casa.", {
          404: INVALID_INVITE_MESSAGE,
        }),
      };
    }
  },

  removeMember: async (memberId) => {
    set({ isSaving: true });
    try {
      await removeFamilyMember(memberId);
      // Tirar da lista local em vez de rebuscar: a resposta é 204 e a lista
      // é a única coisa que mudou. A visão compartilhada em memória fica
      // velha (tem números da pessoa que saiu) — zerá-la força a próxima
      // tela a recarregar em vez de mostrar um total que já não é o da casa
      set((state) => ({
        family: state.family
          ? {
              ...state.family,
              members: state.family.members.filter((m) => m.id !== memberId),
            }
          : state.family,
        analytics: null,
        transactions: [],
        hasLoadedTransactionsOnce: false,
        isSaving: false,
      }));
      return { ok: true, message: "Pessoa removida da casa." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível remover.", {
          404: "Essa pessoa já não está na casa.",
        }),
      };
    }
  },

  leave: async () => {
    set({ isSaving: true });
    try {
      await removeFamilyMember("me");
      set({ ...withoutFamily(), isSaving: false, error: null });
      return { ok: true, message: "Você saiu da casa." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(e, "Não foi possível sair da casa."),
      };
    }
  },

  saveSharing: async (sharing) => {
    set({ isSaving: true });
    try {
      const mySharing = await updateFamilySharing(sharing);
      set((state) => ({
        family: state.family
          ? {
              ...state.family,
              mySharing,
              // O escopo também aparece na minha linha da lista de membros;
              // sem espelhar, "mostra só totais" ficaria velho até o refetch
              members: state.family.members.map((m) =>
                m.isMe ? { ...m, shareScope: mySharing.shareScope } : m,
              ),
            }
          : state.family,
        isSaving: false,
      }));
      return { ok: true, message: "Pronto. A casa vê só o que você escolheu." };
    } catch (e) {
      set({ isSaving: false });
      return {
        ok: false,
        message: translateFamilyError(
          e,
          "Não foi possível salvar o que você compartilha.",
        ),
      };
    }
  },

  fetchAnalytics: async (range) => {
    const key = rangeKey(range);
    if (get().isAnalyticsLoading && analyticsInFlight === key) return;
    const requestId = ++analyticsRequestId;
    analyticsInFlight = key;
    set({ isAnalyticsLoading: true, analyticsError: null });
    try {
      const analytics = await getFamilyAnalytics(range);
      if (requestId !== analyticsRequestId) return;
      analyticsInFlight = null;
      set({ analytics, isAnalyticsLoading: false });
    } catch (e) {
      if (requestId !== analyticsRequestId) return;
      analyticsInFlight = null;
      set({
        analyticsError: translateFamilyError(
          e,
          "Não foi possível carregar a análise da casa.",
        ),
        isAnalyticsLoading: false,
      });
    }
  },

  fetchTransactions: async (params) => {
    const key = `${rangeKey(params.range)}|${params.memberId ?? ""}|${params.categoryId ?? ""}`;
    if (get().isTransactionsLoading && transactionsInFlight === key) return;
    const requestId = ++transactionsRequestId;
    transactionsInFlight = key;
    set({ isTransactionsLoading: true, transactionsError: null });
    try {
      const transactions = await getFamilyTransactions(params);
      if (requestId !== transactionsRequestId) return;
      transactionsInFlight = null;
      set({
        transactions,
        isTransactionsLoading: false,
        hasLoadedTransactionsOnce: true,
      });
    } catch (e) {
      if (requestId !== transactionsRequestId) return;
      transactionsInFlight = null;
      set({
        transactionsError: translateFamilyError(
          e,
          "Não foi possível carregar o extrato da casa.",
        ),
        isTransactionsLoading: false,
      });
    }
  },

  /**
   * Fim de sessão zera tudo (a lição da entrada 45 do registro): a casa
   * guarda nome e números de OUTRAS pessoas, e o `hasLoadedOnce` faria a
   * próxima conta logada ver a casa da anterior até alguém refazer o fetch.
   * Chamado pelo `logout()` e pelo `clearLocalData`.
   *
   * Os ids de requisição avançam junto: uma busca que ainda estava em voo na
   * hora do logout volta com a casa da conta ANTERIOR, e sem isto ela
   * gravaria por cima do estado limpo — o mesmo vazamento, por outra porta.
   */
  reset: () => {
    familyRequestId += 1;
    analyticsRequestId += 1;
    transactionsRequestId += 1;
    analyticsInFlight = null;
    transactionsInFlight = null;
    set({ ...EMPTY });
  },
}));
