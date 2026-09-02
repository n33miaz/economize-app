import { create } from "zustand";

import {
  type ForecastResponse,
  type RecurringSeries,
  createRecurrence,
  deleteRecurrence,
  detectRecurrences,
  getRecurrenceForecast,
  getRecurrences,
  updateRecurrence,
} from "../services/api";
import { getCycleAnchorDay } from "./preferencesStore";
import {
  type AnalysisRange,
  analysisRangeForMonth,
  cycleMonthKeyContaining,
  todayIso,
} from "../utils/cycleWindow";
import {
  type CreateRecurrencePayload,
  type SeriesMonthState,
  type UpdateRecurrencePayload,
  describeConflict,
  describeDetection,
  deriveMonthState,
  translateRecurrenceError,
} from "../utils/recurrence";

/** Janelas que o servidor aceita na previsão. */
export const FORECAST_WINDOWS = [1, 3, 6, 12] as const;
export type ForecastWindow = (typeof FORECAST_WINDOWS)[number];

/**
 * Resultado de salvar: o 409 não é "erro" para a tela — é o convite a editar a
 * série que já existe, e por isso viaja com o id em vez de virar mensagem solta.
 */
export type SaveOutcome =
  | { status: "saved"; series: RecurringSeries }
  | { status: "conflict"; message: string; seriesId: string | null }
  | { status: "error"; message: string };

interface RecurrenceState {
  /** Séries ativas e não descartadas (o que o servidor devolve sem filtro) */
  series: RecurringSeries[];
  /** Inativas, inclusive as descartadas — só carregadas sob demanda */
  dismissed: RecurringSeries[];
  /** Estado do mês corrente por série: previsto × já liquidado */
  monthState: Record<string, SeriesMonthState>;
  forecast: ForecastResponse | null;

  isLoading: boolean;
  hasLoadedOnce: boolean;
  isLoadingDismissed: boolean;
  isDetecting: boolean;
  isSaving: boolean;
  isForecastLoading: boolean;
  hasLoadedForecastOnce: boolean;

  error: string | null;
  /** Falha ao buscar as descartadas: sem ela, erro de rede virava "nada descartado" */
  dismissedError: string | null;
  forecastError: string | null;

  fetchSeries: () => Promise<void>;
  fetchDismissed: () => Promise<void>;
  fetchMonthState: () => Promise<void>;
  runDetection: () => Promise<{ ok: boolean; message: string }>;
  createSeries: (payload: CreateRecurrencePayload) => Promise<SaveOutcome>;
  updateSeries: (
    id: string,
    payload: UpdateRecurrencePayload,
  ) => Promise<SaveOutcome>;
  discardSeries: (id: string) => Promise<{ ok: boolean; message: string }>;
  reactivateSeries: (id: string) => Promise<{ ok: boolean; message: string }>;
  fetchForecast: (
    months: ForecastWindow,
    startingBalance: number,
  ) => Promise<void>;
  /**
   * Esquece a projeção calculada com a âncora anterior. Chamado por quem
   * recarrega o que depende da âncora (`reloadAnalyticsForAnchorChange`): a
   * Home lê `forecast` para o alerta de saldo negativo, e sem isto ela
   * mostraria o recorte velho até alguém reabrir a tela de previsão.
   */
  invalidateForecast: () => void;
  byId: (id: string | null | undefined) => RecurringSeries | undefined;
}

// Id de requisição da previsão: trocar 1 → 12 meses dispara duas chamadas e a
// mais velha pode responder depois. Sem isto, a janela exibida discordava do
// botão marcado (mesmo remédio do analyticsStore).
let forecastRequestId = 0;

/**
 * Recorte do período corrente na gramática de `/analytics/monthly`: o ciclo que
 * contém hoje, traduzido pela MESMA função que a Análise e a Home usam (EC-116).
 * Antes a projeção ia sem recorte e o servidor projetava por mês do calendário
 * — com âncora fora do dia 1 a Home ficava com duas réguas de "mês" na mesma
 * tela. Os períodos seguintes o servidor encadeia a partir deste.
 */
function currentCycleRange(): AnalysisRange {
  const anchorDay = getCycleAnchorDay();
  return analysisRangeForMonth(
    anchorDay,
    cycleMonthKeyContaining(anchorDay, todayIso()),
  );
}

export const useRecurrenceStore = create<RecurrenceState>((set, get) => ({
  series: [],
  dismissed: [],
  monthState: {},
  forecast: null,

  isLoading: false,
  hasLoadedOnce: false,
  isLoadingDismissed: false,
  isDetecting: false,
  isSaving: false,
  isForecastLoading: false,
  hasLoadedForecastOnce: false,

  error: null,
  dismissedError: null,
  forecastError: null,

  fetchSeries: async () => {
    set({ isLoading: true, error: null });
    try {
      const series = await getRecurrences();
      set({ series, isLoading: false, hasLoadedOnce: true });
    } catch (e) {
      set({
        error: translateRecurrenceError(e, "Falha ao carregar suas recorrências."),
        isLoading: false,
        hasLoadedOnce: true,
      });
    }
  },

  fetchDismissed: async () => {
    set({ isLoadingDismissed: true, dismissedError: null });
    try {
      const dismissed = await getRecurrences({ active: false });
      set({ dismissed, isLoadingDismissed: false });
    } catch (e) {
      // lista secundária: falhar aqui não derruba a tela principal, mas a aba
      // precisa dizer que falhou — o vazio silencioso afirmava "nada descartado"
      set({
        isLoadingDismissed: false,
        dismissedError: translateRecurrenceError(
          e,
          "Falha ao carregar as recorrências descartadas.",
        ),
      });
    }
  },

  fetchMonthState: async () => {
    try {
      // Janela de 1 período e saldo inicial zero de propósito: aqui só interessa
      // a flag `settled` de cada série no período corrente, que não depende do
      // saldo. O recorte vai junto para "corrente" ser o ciclo do usuário, e
      // não o mês do calendário
      const forecast = await getRecurrenceForecast(1, 0, currentCycleRange());
      set({ monthState: deriveMonthState(forecast.months[0]) });
    } catch {
      // sem o estado do mês a lista ainda funciona — cada série aparece como
      // prevista, que é o default honesto
      set({ monthState: {} });
    }
  },

  runDetection: async () => {
    if (get().isDetecting) {
      return { ok: false, message: "A varredura já está rodando." };
    }
    set({ isDetecting: true });
    try {
      const summary = await detectRecurrences();
      // a varredura muda séries e vínculos: recarregar as duas listas é o que
      // faz o resultado anunciado bater com o que fica na tela
      await Promise.all([get().fetchSeries(), get().fetchMonthState()]);
      set({ isDetecting: false });
      return { ok: true, message: describeDetection(summary) };
    } catch (e) {
      set({ isDetecting: false });
      return {
        ok: false,
        message: translateRecurrenceError(
          e,
          "Não foi possível varrer o extrato agora.",
        ),
      };
    }
  },

  createSeries: async (payload) => {
    // dois toques no mesmo frame passam pelo disabled do botão (que depende de
    // re-render); a trava aqui é a mesma do runDetection
    if (get().isSaving) {
      return { status: "error", message: "Ainda estamos salvando — um instante." };
    }
    set({ isSaving: true });
    try {
      const series = await createRecurrence(payload);
      set({ series: [...get().series, series], isSaving: false });
      return { status: "saved", series };
    } catch (e) {
      set({ isSaving: false });
      const conflict = describeConflict(e);
      if (conflict) {
        return {
          status: "conflict",
          message: conflict.message,
          seriesId: conflict.seriesId,
        };
      }
      return {
        status: "error",
        message: translateRecurrenceError(e, "Não foi possível agendar."),
      };
    }
  },

  updateSeries: async (id, payload) => {
    // mesma trava de dupla submissão do createSeries
    if (get().isSaving) {
      return { status: "error", message: "Ainda estamos salvando — um instante." };
    }
    set({ isSaving: true });
    try {
      const series = await updateRecurrence(id, payload);
      set({
        series: get().series.map((item) => (item.id === id ? series : item)),
        dismissed: get().dismissed.map((item) =>
          item.id === id ? series : item,
        ),
        isSaving: false,
      });
      return { status: "saved", series };
    } catch (e) {
      set({ isSaving: false });
      return {
        status: "error",
        message: translateRecurrenceError(e, "Não foi possível salvar."),
      };
    }
  },

  discardSeries: async (id) => {
    try {
      const result = await deleteRecurrence(id);
      set({ series: get().series.filter((item) => item.id !== id) });
      // descarte de série detectada preserva o histórico e continua acessível
      // na lista de descartadas; a agendada sem vínculo sai de vez
      if (result.deactivated) get().fetchDismissed();
      return {
        ok: true,
        message: result.deleted
          ? "Agendamento excluído."
          : "Recorrência descartada — ela não volta na próxima varredura.",
      };
    } catch (e) {
      return {
        ok: false,
        message: translateRecurrenceError(e, "Não foi possível descartar."),
      };
    }
  },

  reactivateSeries: async (id) => {
    // `active: true` também desfaz o descarte no servidor, então basta um PATCH
    const outcome = await get().updateSeries(id, { active: true });
    if (outcome.status !== "saved") {
      return {
        ok: false,
        message:
          outcome.status === "error"
            ? outcome.message
            : "Não foi possível reativar.",
      };
    }
    // O GET padrão esconde séries INTERNAL: devolvê-la à lista local faria a
    // recorrência "sumir sozinha" no próximo carregamento — melhor avisar
    const isInternal = outcome.series.flow === "INTERNAL";
    set({
      dismissed: get().dismissed.filter((item) => item.id !== id),
      series: isInternal
        ? get().series.filter((item) => item.id !== id)
        : [...get().series.filter((item) => item.id !== id), outcome.series],
    });
    return {
      ok: true,
      message: isInternal
        ? "Recorrência reativada. Transferências entre suas contas não aparecem na lista, mas voltam a ser acompanhadas."
        : "Recorrência reativada.",
    };
  },

  fetchForecast: async (months, startingBalance) => {
    const requestId = ++forecastRequestId;
    set({ isForecastLoading: true, forecastError: null });
    try {
      const forecast = await getRecurrenceForecast(
        months,
        startingBalance,
        currentCycleRange(),
      );
      if (requestId !== forecastRequestId) return;
      set({
        forecast,
        isForecastLoading: false,
        hasLoadedForecastOnce: true,
      });
    } catch (e) {
      if (requestId !== forecastRequestId) return;
      set({
        forecastError: translateRecurrenceError(
          e,
          "Falha ao calcular a previsão de saldo.",
        ),
        isForecastLoading: false,
        hasLoadedForecastOnce: true,
      });
    }
  },

  invalidateForecast: () => {
    // avança o id para uma resposta em voo, pedida com a âncora velha, ser
    // descartada pela mesma guarda do fetchForecast em vez de repovoar a tela
    forecastRequestId += 1;
    set({
      forecast: null,
      forecastError: null,
      isForecastLoading: false,
      hasLoadedForecastOnce: false,
    });
  },

  byId: (id) => (id ? get().series.find((item) => item.id === id) : undefined),
}));
