import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  DebtOverview,
  MonthlyAnalytics,
  getAnalyticsMonths,
  getDebtOverview,
  getMonthlyAnalytics,
} from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";
import { getCycleAnchorDay } from "./preferencesStore";
import { useRecurrenceStore } from "./recurrenceStore";
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
  /**
   * Quanto do período é dívida (EC-139). Viaja junto do consolidado porque é o
   * MESMO recorte: buscá-lo à parte abriria espaço para a tela mostrar a
   * quebra de um período e a dívida de outro.
   */
  debt: DebtOverview | null;

  // A Home responde sempre pelo período corrente do usuário; a Análise navega
  // pelo histórico. Consolidação e carregamento separados para que o recorte
  // escolhido numa tela não apareça na outra
  homeData: MonthlyAnalytics | null;
  /**
   * Quando `homeData` foi lido, em ISO. Vai para o disco JUNTO dele: um
   * número guardado só pode voltar para a tela com a data ao lado, e é daqui
   * que a cortina do servidor e o carimbo da Home tiram o "de quando".
   */
  homeDataAt: string | null;
  isHomeLoading: boolean;
  /**
   * Se a consolidação da Home já respondeu NESTA sessão. Não persiste, de
   * propósito: depois de reidratar, `homeData` está cheio mas isto fica falso
   * — é o que separa "o número de agora" do "o número da última visita" para
   * quem precisa saber a diferença sem comparar datas.
   */
  hasHomeLoadedOnce: boolean;

  fetchMonths: () => Promise<void>;
  fetchMonthly: (month?: string) => Promise<void>;
  fetchHomeMonthly: () => Promise<void>;
  /** Zera tudo, inclusive o instantâneo em disco. Chamado no fim da sessão. */
  reset: () => void;
}

/** Chave do instantâneo da Home no armazenamento local. */
export const ANALYTICS_SNAPSHOT_KEY = "@analytics_snapshot";

/** O que vai para o disco: só a consolidação da Home e a sua data. */
type AnalyticsSnapshot = Pick<AnalyticsState, "homeData" | "homeDataAt">;

/**
 * O armazenamento pode devolver qualquer coisa (versão antiga, edição manual,
 * JSON pela metade). Uma consolidação que não tem cara de consolidação não
 * volta para a tela: a Home lê `net`, `totalExpense` e `previous` sem
 * perguntar, e um objeto torto derrubaria a tela inteira no primeiro render.
 */
function looksLikeMonthly(value: unknown): value is MonthlyAnalytics {
  if (typeof value !== "object" || value === null) return false;
  const data = value as Record<string, unknown>;
  return (
    typeof data.start === "string" &&
    typeof data.end === "string" &&
    typeof data.totalIncome === "number" &&
    typeof data.totalExpense === "number" &&
    typeof data.net === "number" &&
    typeof data.previous === "object" &&
    data.previous !== null &&
    Array.isArray(data.categories)
  );
}

// Ids de requisição: as telas buscam na montagem e a cada foco, e nada
// sequencia as chamadas — sem isso vence quem responder por último, ainda que
// seja a resposta mais velha (e a Home cairia no onboarding com dados na mão)
let monthlyRequestId = 0;
let homeRequestId = 0;

const createAnalyticsState: StateCreator<AnalyticsState> = (set, get) => ({
  data: null,
  months: [],
  selectedMonth: null,
  isLoading: false,
  error: null,
  debt: null,
  homeData: null,
  homeDataAt: null,
  isHomeLoading: false,
  hasHomeLoadedOnce: false,

  /**
   * Fim de sessão. Os ids de requisição avançam para que uma busca em voo,
   * pedida com o token que acabou de morrer, não regrave a Home da conta
   * anterior depois do reset — e o `set` é o que apaga o instantâneo do disco,
   * para o próximo login neste aparelho não ver o mês de outra pessoa na
   * cortina do servidor.
   */
  reset: () => {
    monthlyRequestId++;
    homeRequestId++;
    set({
      data: null,
      months: [],
      selectedMonth: null,
      isLoading: false,
      error: null,
      debt: null,
      homeData: null,
      homeDataAt: null,
      isHomeLoading: false,
      hasHomeLoadedOnce: false,
    });
  },

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
      const range = analysisRangeForMonth(anchorDay, target);
      // Em paralelo porque são duas LEITURAS do mesmo recorte, sem ordem entre
      // si — diferente do caso em que uma escrita precisa terminar antes da
      // leitura. A quebra de dívida falhando sozinha não pode derrubar a tela:
      // por isso ela vem com `catch` próprio devolvendo null
      const [data, debt] = await Promise.all([
        getMonthlyAnalytics(range),
        // O `catch` mora DENTRO de uma função assíncrona, e não pendurado na
        // promise: assim nem uma falha síncrona daqui escapa antes de o
        // `Promise.all` pendurar tratador na primeira chamada — quando isso
        // acontecia, a rejeição do consolidado ficava órfã e derrubava o
        // processo em vez de virar o erro tratado da tela
        (async () => {
          try {
            return await getDebtOverview(range);
          } catch {
            return null;
          }
        })(),
      ]);
      if (requestId !== monthlyRequestId) return;
      // `selectedMonth` não é reescrito com `data.month`: em modo janela ele
      // volta null e a seleção do chip se perderia
      set({ data, debt, isLoading: false });
    } catch (e) {
      if (requestId !== monthlyRequestId) return;
      set({
        error: describeLoadFailure(e, "Falha ao carregar a análise do período."),
        isLoading: false,
      });
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
      // A data é a de AGORA, e não a do servidor: o que ela responde é "quando
      // este aparelho leu", que é o que a legenda de dado velho precisa dizer
      set({
        homeData: data,
        homeDataAt: new Date().toISOString(),
        isHomeLoading: false,
        hasHomeLoadedOnce: true,
      });
    } catch {
      // a Home segue com a última consolidação boa em vez de zerar a tela
      if (requestId !== homeRequestId) return;
      set({ isHomeLoading: false });
    }
  },
});

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(createAnalyticsState, {
    name: ANALYTICS_SNAPSHOT_KEY,
    storage: createJSONStorage(() => AsyncStorage),
    // Só o mês da Home persiste. A Análise navega pelo histórico e o recorte
    // escolhido lá é da sessão; `isHomeLoading` e os erros também. E
    // `hasHomeLoadedOnce` fica de fora DE PROPÓSITO (ver a interface): é ele
    // que faz a Home buscar de novo depois de reidratar
    partialize: (state): AnalyticsSnapshot => ({
      homeData: state.homeData,
      homeDataAt: state.homeDataAt,
    }),
    merge: (persisted, current) => {
      const snapshot = persisted as Partial<AnalyticsSnapshot> | undefined;
      const homeData = looksLikeMonthly(snapshot?.homeData)
        ? snapshot.homeData
        : null;
      return {
        ...current,
        homeData,
        // Data sem número não diz nada; número sem data não pode ser mostrado
        homeDataAt:
          homeData && typeof snapshot?.homeDataAt === "string"
            ? snapshot.homeDataAt
            : null,
      };
    },
  }),
);

/**
 * Recarrega tudo que depende da âncora. Um lugar só, porque a âncora se troca
 * de três telas diferentes e a que não recarregasse mostraria o recorte velho
 * com o rótulo novo.
 */
export async function reloadAnalyticsForAnchorChange(): Promise<void> {
  const store = useAnalyticsStore.getState();
  // A previsão de saldo também é recortada pela âncora (EC-116), mas não dá
  // para recalculá-la daqui: o saldo base nasce do extrato dentro da tela de
  // previsão. Esquecê-la é o honesto — a Home só alerta "saldo negativo" com
  // projeção calculada nesta sessão, e a próxima abertura da tela refaz a conta
  useRecurrenceStore.getState().invalidateForecast();
  // Voltar para o dia 1 encolhe a régua de chips (o ciclo extra, que cobre os
  // primeiros dias do histórico, deixa de existir). Sem reancorar, o mês
  // selecionado sumia da régua e a Análise ficava com dados na tela e nenhum
  // chip marcado
  const keys = cycleMonthKeys(getCycleAnchorDay(), store.months);
  const selected = store.selectedMonth;
  const target = selected && keys.includes(selected) ? selected : keys[0];
  await Promise.all([store.fetchMonthly(target), store.fetchHomeMonthly()]);
}
