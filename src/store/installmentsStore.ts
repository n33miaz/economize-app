import { create } from "zustand";

import { type InstallmentOverview, getInstallments } from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

/**
 * Quanto tempo uma resposta vale antes de a Home pedir de novo ao ganhar foco.
 *
 * `GET /analytics/installments` varre TODAS as transações da pessoa a cada
 * chamada — e a Home a disparava a cada foco, mais a Previsão por conta
 * própria. Em servidor de 0,1 CPU isso é o tipo de chamada que faz a tela
 * inteira esperar por um bloco secundário. Cinco minutos cobre o vai-e-volta
 * entre abas sem deixar uma importação nova invisível por muito tempo; o
 * puxar-para-atualizar passa `force` e ignora a janela.
 */
export const INSTALLMENTS_TTL_MS = 5 * 60_000;

interface InstallmentsState {
  overview: InstallmentOverview | null;
  isLoading: boolean;
  /** Separa "ainda não perguntei" de "perguntei e não há parcelamento". */
  hasLoadedOnce: boolean;
  fetchedAt: number | null;
  error: string | null;

  fetchInstallments: (force?: boolean) => Promise<void>;
  /** Zera tudo. Chamado no fim da sessão pelo `authStore`. */
  reset: () => void;
}

const emptyState = () => ({
  overview: null as InstallmentOverview | null,
  isLoading: false,
  hasLoadedOnce: false,
  fetchedAt: null as number | null,
  error: null as string | null,
});

/**
 * Cache compartilhado dos parcelamentos (EC-213/EC-217).
 *
 * <p>Existe para que Home e Previsão leiam a MESMA resposta em vez de cada
 * uma pedir a sua — duas chamadas pesadas para um número só, e a chance de as
 * duas telas discordarem sobre quantas parcelas faltam.
 */
export const useInstallmentsStore = create<InstallmentsState>((set, get) => ({
  ...emptyState(),

  reset: () => set(emptyState()),

  fetchInstallments: async (force = false) => {
    const state = get();
    if (state.isLoading) return;
    const fresca =
      state.fetchedAt != null && Date.now() - state.fetchedAt < INSTALLMENTS_TTL_MS;
    if (state.hasLoadedOnce && fresca && !force) return;

    set({ isLoading: true, error: null });
    try {
      const overview = await getInstallments();
      set({
        overview,
        isLoading: false,
        hasLoadedOnce: true,
        fetchedAt: Date.now(),
      });
    } catch (e) {
      // A resposta anterior fica na tela: parcelamento é leitura adicional, e
      // um 500 passageiro não pode apagar o bloco que já estava certo.
      // `hasLoadedOnce` não é marcado na falha pelo mesmo motivo do
      // accountsStore: falha não é resposta, e o próximo foco tenta de novo
      set({
        isLoading: false,
        error: describeLoadFailure(
          e,
          "Não foi possível carregar seus parcelamentos agora.",
        ),
      });
    }
  },
}));
