import { create } from "zustand";

import { type CommitmentsPanel, getCommitments } from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

/**
 * Quanto tempo a resposta vale antes de pedir de novo.
 *
 * `GET /analytics/commitments` varre as parcelas de todo o extrato (a mesma
 * projeção de /installments). A Análise remonta o bloco a cada troca de
 * período, e o painel não depende do período: sem a janela, cada toque no
 * seletor de mês dispararia a varredura de novo.
 */
export const COMMITMENTS_TTL_MS = 5 * 60_000;

interface CommitmentsState {
  panel: CommitmentsPanel | null;
  isLoading: boolean;
  hasLoadedOnce: boolean;
  fetchedAt: number | null;
  error: string | null;

  fetchCommitments: (force?: boolean) => Promise<void>;
  /** Zera tudo. Chamado no fim da sessão. */
  reset: () => void;
}

const emptyState = () => ({
  panel: null as CommitmentsPanel | null,
  isLoading: false,
  hasLoadedOnce: false,
  fetchedAt: null as number | null,
  error: null as string | null,
});

/** Parcelas e compromissos dos próximos meses contra a renda. */
export const useCommitmentsStore = create<CommitmentsState>((set, get) => ({
  ...emptyState(),

  reset: () => set(emptyState()),

  fetchCommitments: async (force = false) => {
    const state = get();
    if (state.isLoading) return;
    const fresca =
      state.fetchedAt != null && Date.now() - state.fetchedAt < COMMITMENTS_TTL_MS;
    if (state.hasLoadedOnce && fresca && !force) return;

    set({ isLoading: true, error: null });
    try {
      const panel = await getCommitments();
      set({
        panel,
        isLoading: false,
        hasLoadedOnce: true,
        fetchedAt: Date.now(),
      });
    } catch (e) {
      // A resposta anterior fica: o painel é leitura adicional, e uma falha
      // passageira não pode apagar o que já estava certo
      const message = describeLoadFailure(
        e,
        "Não foi possível carregar seus compromissos agora.",
      );
      // Frase vazia é sessão encerrada: o reset do fim da sessão já zera tudo
      if (!message) return;
      set({ isLoading: false, error: message });
    }
  },
}));
