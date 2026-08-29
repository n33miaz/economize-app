import { create } from "zustand";
import {
  MonthlyAnalytics,
  getAnalyticsMonths,
  getMonthlyAnalytics,
} from "../services/api";
import { getCycleAnchorDay } from "./preferencesStore";
import {
  analysisRangeForMonth,
  cycleMonthKeyContaining,
  cycleMonthKeys,
  homeReferenceDate,
  shiftMonthKey,
  todayIso,
} from "../utils/cycleWindow";

/**
 * "Este recorte teve movimento?" — pergunta diferente de "existe extrato?",
 * que se responde com `months`. Separar as duas é o que impede a Home de
 * mandar importar extrato para quem só está num ciclo parado.
 *
 * Boolean simples de propósito, e não type guard: `false` aqui NÃO quer dizer
 * `null` — o caso mais interessante é justamente a consolidação carregada e
 * zerada (ciclo parado), que um predicado estreitaria para `null` e apagaria a
 * janela que a tela precisa mostrar.
 */
export function hasMovement(data: MonthlyAnalytics | null): boolean {
  return data !== null && (data.totalIncome > 0 || data.totalExpense > 0);
}

interface AnalyticsState {
  data: MonthlyAnalytics | null;
  months: string[];
  /**
   * Mês em que começa o ciclo selecionado. Continua sendo um `yyyy-MM` mesmo em
   * modo janela: é a identidade do recorte na lista de chips, e a resposta não
   * pode ditá-la porque `month` volta null quando o recorte é uma janela.
   */
  selectedMonth: string | null;
  isLoading: boolean;
  error: string | null;

  // A Home responde sempre pelo período corrente do usuário; a Análise navega
  // pelo histórico. Consolidação e carregamento separados para que o recorte
  // escolhido numa tela não apareça na outra
  homeData: MonthlyAnalytics | null;
  isHomeLoading: boolean;

  fetchMonths: () => Promise<void>;
  fetchMonthly: (month?: string) => Promise<void>;
  fetchHomeMonthly: () => Promise<void>;
}

// Ids de requisição: as telas buscam na montagem e a cada foco, e nada
// sequencia as chamadas — sem isso vence quem responder por último, ainda que
// seja a resposta mais velha (e a Home cairia no onboarding com dados na mão)
let monthlyRequestId = 0;
let homeRequestId = 0;

export const useAnalyticsStore = create<AnalyticsState>((set, get) => ({
  data: null,
  months: [],
  selectedMonth: null,
  isLoading: false,
  error: null,
  homeData: null,
  isHomeLoading: false,

  fetchMonths: async () => {
    try {
      const months = await getAnalyticsMonths();
      set({ months });
      // Primeiro acesso: o alvo é o ciclo que contém hoje — a MESMA regra da
      // Home. Com `months[0]` (o mês de calendário mais recente) e âncora no
      // dia 12, abrir a Análise num dia 5 caía no ciclo 12/08→11/09, que ainda
      // nem começou: tela vazia, e a Home mostrando outro período no mesmo
      // instante. As duas telas não podem discordar sobre onde o usuário está
      if (!get().selectedMonth && months.length > 0) {
        set({
          selectedMonth: cycleMonthKeyContaining(
            getCycleAnchorDay(),
            homeReferenceDate(months, todayIso()),
          ),
        });
      }
    } catch {
      // o seletor fica vazio, mas a consolidação do período atual ainda funciona
    }
  },

  fetchMonthly: async (month) => {
    const anchorDay = getCycleAnchorDay();
    // Sem seleção ainda, o alvo é o ciclo que contém hoje. Antes a ausência de
    // mês deixava o servidor resolver; com âncora fora do dia 1 quem sabe o
    // recorte é o cliente, então ele passou a ser sempre explícito
    const target =
      month ??
      get().selectedMonth ??
      cycleMonthKeyContaining(anchorDay, todayIso());
    const requestId = ++monthlyRequestId;
    set({ isLoading: true, error: null, selectedMonth: target });
    try {
      const data = await getMonthlyAnalytics(
        analysisRangeForMonth(anchorDay, target),
      );
      if (requestId !== monthlyRequestId) return;
      // `selectedMonth` não é reescrito com `data.month`: em modo janela ele
      // volta null e a seleção do chip se perderia
      set({ data, isLoading: false });
    } catch {
      if (requestId !== monthlyRequestId) return;
      set({ error: "Falha ao carregar a análise do período.", isLoading: false });
    }
  },

  fetchHomeMonthly: async () => {
    const requestId = ++homeRequestId;
    set({ isHomeLoading: true });
    try {
      const months = await getAnalyticsMonths().catch(() => get().months);
      if (requestId !== homeRequestId) return;
      if (months.length > 0) set({ months });
      const anchorDay = getCycleAnchorDay();
      const monthKey = cycleMonthKeyContaining(
        anchorDay,
        homeReferenceDate(months, todayIso()),
      );
      let data = await getMonthlyAnalytics(
        analysisRangeForMonth(anchorDay, monthKey),
      );
      if (requestId !== homeRequestId) return;
      // Desempate do viés do `homeReferenceDate`: o servidor só informa MESES
      // com movimento, e um mês cai em dois ciclos quando a âncora não é o dia
      // 1 — com âncora 12, o movimento de 01–11/05 vive no ciclo que começou em
      // abril. Se a janela apostada volta vazia E existe extrato, recuar um
      // ciclo é o desempate que a função pura não tem como fazer. Uma tentativa
      // só, e nenhuma em modo mês (lá a aposta nunca erra)
      if (!hasMovement(data) && months.length > 0) {
        const previous = await getMonthlyAnalytics(
          analysisRangeForMonth(anchorDay, shiftMonthKey(monthKey, -1)),
        );
        if (requestId !== homeRequestId) return;
        if (hasMovement(previous)) data = previous;
      }
      set({ homeData: data, isHomeLoading: false });
    } catch {
      // a Home segue com a última consolidação boa em vez de zerar a tela
      if (requestId !== homeRequestId) return;
      set({ isHomeLoading: false });
    }
  },
}));

/**
 * Recarrega tudo que depende da âncora. Um lugar só, porque a âncora se troca
 * de três telas diferentes e a que não recarregasse mostraria o recorte velho
 * com o rótulo novo.
 */
export async function reloadAnalyticsForAnchorChange(): Promise<void> {
  const store = useAnalyticsStore.getState();
  // Voltar para o dia 1 encolhe a régua de chips (o ciclo extra, que cobre os
  // primeiros dias do histórico, deixa de existir). Sem reancorar, o mês
  // selecionado sumia da régua e a Análise ficava com dados na tela e nenhum
  // chip marcado
  const keys = cycleMonthKeys(getCycleAnchorDay(), store.months);
  const selected = store.selectedMonth;
  const target = selected && keys.includes(selected) ? selected : keys[0];
  await Promise.all([store.fetchMonthly(target), store.fetchHomeMonthly()]);
}
