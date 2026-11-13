import { create } from "zustand";
import {
  BankTransaction,
  ReviewApplyItem,
  ReviewGroup,
  ReviewUploadScope,
  applyReview,
  confirmAllReview,
  getReviewCount,
  getReviewQueue,
  recategorizePending,
} from "../services/api";
import {
  describeLoadFailure,
  describeSaveFailure,
} from "../services/requestFailure";
import { applyTransactionToGroups } from "../utils/transactions";

/**
 * Grupos por requisição no salvamento em massa.
 *
 * Vinte e cinco porque o servidor faz, por grupo, uma consulta de categoria,
 * uma busca das transações, um `saveAll` e o upsert da regra aprendida — em
 * 0,1 CPU, quarenta grupos numa só requisição passam do tempo do proxy e a
 * resposta é perdida junto com o trabalho. Em levas, o que entrou fica.
 */
export const REVIEW_APPLY_CHUNK = 25;

interface ReviewState {
  groups: ReviewGroup[];
  // escopo atual da fila: uma importação específica ou tudo que está pendente
  uploadId: string | null;
  // uploads da sincronização; uploadId fica para o estado e cliente antigos
  uploadIds: string[] | null;
  isLoading: boolean;
  isApplying: boolean;
  error: string | null;

  /**
   * Contagem de pendentes vinda do servidor, para quem só mostra o número.
   * `null` = ainda não perguntamos.
   */
  pendingCount: number | null;

  /**
   * Quantos grupos já foram gravados na leva em andamento, e de quantos.
   * `null` fora de uma leva — é o que o botão usa para dizer "12 de 40".
   */
  applyProgress: { done: number; total: number } | null;

  fetchQueue: (uploadIds?: ReviewUploadScope) => Promise<void>;
  /** Só o número (Home). Não toca em `groups` nem no estado de carga da fila. */
  fetchPendingCount: () => Promise<void>;
  apply: (items: ReviewApplyItem[]) => Promise<number>;
  /**
   * Grava MUITOS grupos de uma vez, em levas pequenas e sequenciais.
   * Devolve o que foi gravado e o que sobrou — leva que falha não apaga o
   * trabalho das anteriores.
   */
  applyMany: (
    items: ReviewApplyItem[],
  ) => Promise<{ confirmed: number; failedItems: ReviewApplyItem[] }>;
  /**
   * Pede ao servidor para reexaminar a fila com o motor atual e recarrega.
   * Devolve quantas ganharam sugestão, para a tela dizer o que mudou.
   */
  recategorize: () => Promise<{ ok: boolean; resolved: number; message: string }>;
  confirmAll: () => Promise<number>;
  /** Aplica a versão que o servidor devolveu (ex.: rename) na fila carregada. */
  applyTransaction: (updated: BankTransaction) => void;
  pendingTransactionsCount: () => number;
  /** Fim de sessão: apaga a fila e a contagem. */
  reset: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  groups: [],
  uploadId: null,
  uploadIds: null,
  pendingCount: null,
  applyProgress: null,
  isLoading: false,
  isApplying: false,
  error: null,

  fetchQueue: async (scope) => {
    const uploadIds = !scope ? null : typeof scope === "string" ? [scope] : scope;
    set({
      isLoading: true,
      error: null,
      uploadId: uploadIds?.[0] ?? null,
      uploadIds,
    });
    try {
      const groups = await getReviewQueue(scope);
      // A fila em mão é a contagem mais fresca que existe — quem já a tem não
      // precisa perguntar de novo
      set({
        groups,
        isLoading: false,
        pendingCount: groups.reduce((sum, g) => sum + g.transactions.length, 0),
      });
    } catch (e) {
      const message = describeLoadFailure(
        e,
        "Falha ao carregar a fila de revisão.",
      );
      if (!message) return;
      set({
        error: message,
        isLoading: false,
      });
    }
  },

  fetchPendingCount: async () => {
    try {
      set({ pendingCount: await getReviewCount() });
    } catch {
      // Sem o número, o bloco da Home simplesmente não aparece. Errar para
      // menos aqui é melhor que um "0 pendentes" que não é verdade
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
      // O número da Home acompanha a poda local: quem revisou aqui e voltou
      // não pode continuar vendo a contagem de antes
      set({
        groups,
        isApplying: false,
        pendingCount: groups.reduce((sum, g) => sum + g.transactions.length, 0),
      });
      return outcome.confirmed;
    } catch (e) {
      const message = describeSaveFailure(e, "Falha ao aplicar revisão.");
      if (!message) return 0;
      set({
        error: message,
        isApplying: false,
      });
      return 0;
    }
  },

  applyMany: async (items) => {
    if (items.length === 0) return { confirmed: 0, failedItems: [] };
    set({ isApplying: true, error: null, applyProgress: { done: 0, total: items.length } });

    let confirmed = 0;
    const failedItems: ReviewApplyItem[] = [];
    const decided = new Set<string>();

    // Em levas, e não numa requisição só: o servidor de produção tem 0,1 CPU e
    // 512 MB, e uma requisição gigante que estoura o tempo perderia TUDO. Cada
    // leva commita sozinha (o serviço não abre transação por chamada), então o
    // que já entrou fica — e o que falhou volta nomeado para a tela.
    for (let i = 0; i < items.length; i += REVIEW_APPLY_CHUNK) {
      const chunk = items.slice(i, i + REVIEW_APPLY_CHUNK);
      try {
        const outcome = await applyReview(chunk);
        confirmed += outcome.confirmed;
        chunk.forEach((item) =>
          item.transactionIds.forEach((id) => decided.add(id)),
        );
      } catch (e) {
        failedItems.push(...chunk);
        // Não interrompe: uma leva ruim (uma categoria apagada no meio) não é
        // razão para desistir das outras vinte que iriam passar
        const message = describeLoadFailure(
          e,
          "Parte das escolhas não foi salva.",
        );
        // Sessão encerrada: as levas seguintes seriam de quem já saiu
        if (!message) return { confirmed, failedItems };
        set({ error: message });
      }
      set({
        applyProgress: {
          done: Math.min(i + REVIEW_APPLY_CHUNK, items.length),
          total: items.length,
        },
      });
    }

    // Poda local só do que realmente entrou
    const groups = get()
      .groups.map((g) => ({
        ...g,
        transactions: g.transactions.filter((t) => !decided.has(t.id)),
      }))
      .filter((g) => g.transactions.length > 0);

    set({
      groups,
      isApplying: false,
      applyProgress: null,
      pendingCount: groups.reduce((sum, g) => sum + g.transactions.length, 0),
    });

    return { confirmed, failedItems };
  },

  recategorize: async () => {
    set({ isApplying: true, error: null });
    try {
      const outcome = await recategorizePending();
      // Recarrega a fila: as linhas que ganharam sugestão têm de aparecer com a
      // categoria na tela, senão o número anunciado não se confirma em nada
      await get().fetchQueue(get().uploadIds ?? get().uploadId ?? undefined);
      set({ isApplying: false });
      return {
        ok: true,
        resolved: outcome.resolved,
        // Dizer QUANTAS vieram do modelo não é vaidade: sugestão de IA tem
        // confiança menor e merece um olhar mais atento antes de aprovar
        message:
          outcome.resolved > 0
            ? `${outcome.resolved} de ${outcome.reviewed} ganharam sugestão${
                outcome.resolvedByAi > 0
                  ? ` (${outcome.resolvedByAi} pela IA)`
                  : ""
              }. Confira e aprove.`
            : "Nada novo: o motor não reconheceu nenhuma das que faltam.",
      };
    } catch (e) {
      const message = describeLoadFailure(
        e,
        "Não foi possível reexaminar a fila.",
      );
      if (!message) return { ok: false, resolved: 0, message: "" };
      set({
        isApplying: false,
        error: message,
      });
      return {
        ok: false,
        resolved: 0,
        message: "Não foi possível reexaminar a fila agora.",
      };
    }
  },

  confirmAll: async () => {
    set({ isApplying: true, error: null });
    try {
      const scope = get().uploadIds ?? get().uploadId ?? undefined;
      const outcome = await confirmAllReview(scope);
      if (outcome.confirmed === 0) {
        // o servidor não confirmou nada: podar a lista aqui esvaziaria a tela
        // em silêncio, escondendo o que continua pendente de verdade
        set({ isApplying: false });
        await get().fetchQueue(scope);
        return 0;
      }
      // ficam só os grupos sem categoria (que precisam de ajuda do usuário)
      const remaining = get().groups.filter((g) => !g.suggestedCategoryId);
      set({
        groups: remaining,
        isApplying: false,
        pendingCount: remaining.reduce(
          (sum, g) => sum + g.transactions.length,
          0,
        ),
      });
      return outcome.confirmed;
    } catch (e) {
      const message = describeSaveFailure(e, "Falha ao confirmar tudo.");
      if (!message) return 0;
      set({
        error: message,
        isApplying: false,
      });
      return 0;
    }
  },

  applyTransaction: (updated) =>
    set({ groups: applyTransactionToGroups(get().groups, updated) }),

  pendingTransactionsCount: () =>
    get().groups.reduce((sum, g) => sum + g.transactions.length, 0),

  // Fim de sessão: a fila de revisão é o extrato em outro recorte, e a
  // contagem alimenta o bloco "N para revisar" da Home — que apareceria para
  // a conta nova com o número da anterior
  reset: () =>
    set({
      groups: [],
      uploadId: null,
      uploadIds: null,
      pendingCount: null,
      applyProgress: null,
      isLoading: false,
      isApplying: false,
      error: null,
    }),
}));
