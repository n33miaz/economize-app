import { create } from "zustand";

import {
  addInvestmentInterest,
  createInvestmentPosition,
  deleteInvestmentPosition,
  getApiErrorStatus,
  getForeignQuote,
  getInvestmentMovements,
  getInvestmentPositions,
  getInvestmentProfile,
  getInvestmentSummary,
  getMacroIndicators,
  getNewsByTopics,
  getTreasuryBonds,
  removeInvestmentInterest,
  syncInvestments,
  updateInvestmentPosition,
  type ForeignQuote,
  type InvestmentInterest,
  type InvestmentInterestKind,
  type InvestmentMovements,
  type InvestmentPosition,
  type InvestmentPositionPayload,
  type InvestmentProfile,
  type InvestmentSummary,
  type InvestmentSyncResult,
  type MacroIndicator,
  type TopicNewsArticle,
  type TreasuryBond,
} from "../services/api";
import { DEFAULT_FOREIGN_MARKET } from "../utils/investments";

/**
 * Investimentos consolidados (EC-15x).
 *
 * <p>Oito fatias INDEPENDENTES, cada uma com o próprio `loading/error/
 * fetchedAt`. A razão é a tela: ela tem seis blocos que vêm de seis rotas, e
 * o radar de notícias caindo não pode apagar o resumo que já chegou — uma
 * fatia falha sozinha e o bloco dela mostra "tentar de novo", o resto fica.
 *
 * <p>Cache de cinco minutos por fatia: voltar à aba não rebusca o que acabou
 * de chegar; `force` (puxar para atualizar, sincronizar, cadastrar) ignora o
 * cache. E o servidor uma versão atrás, que responde 404 nestas rotas, vira
 * estado VAZIO honesto (`unavailable`) — nunca o ErrorState vermelho, porque
 * não há nada para "tentar de novo".
 */

export interface Slice<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Momento da última resposta boa (ou do 404); nulo enquanto nunca veio. */
  fetchedAt: number | null;
  /** O servidor respondeu 404: a rota não existe nesta versão dele. */
  unavailable: boolean;
}

export const INVESTMENT_CACHE_TTL_MS = 5 * 60 * 1000;

/** Quantas manchetes o radar pede — cabe num bloco sem virar a tela de Notícias. */
export const RADAR_HEADLINES = 5;

export const emptySlice = <T>(): Slice<T> => ({
  data: null,
  loading: false,
  error: null,
  fetchedAt: null,
  unavailable: false,
});

/** O que a fatia vale quando o servidor não tem a rota: vazio, e explícito. */
export const EMPTY_SUMMARY: InvestmentSummary = {
  totalInvested: 0,
  currentValue: 0,
  profit: 0,
  profitPercent: null,
  positionsCount: 0,
  byType: [],
  byInstitution: [],
  byIndexer: [],
  updatedAt: null,
  stalePositions: 0,
  sources: [],
  needsQuote: [],
  movements12m: { applied: 0, redeemed: 0, yield: 0, net: 0 },
};

export const EMPTY_MOVEMENTS: InvestmentMovements = {
  items: [],
  totals: { applied: 0, redeemed: 0, yield: 0 },
  netInvested: 0,
};

export const EMPTY_PROFILE: InvestmentProfile = {
  indexers: [],
  watch: [],
  topics: [],
  derivedFrom: { positions: 0, movements: 0, manualInterests: 0 },
  isDefault: true,
};

interface Slices {
  summary: Slice<InvestmentSummary>;
  positions: Slice<InvestmentPosition[]>;
  movements: Slice<InvestmentMovements>;
  profile: Slice<InvestmentProfile>;
  macro: Slice<MacroIndicator[]>;
  treasury: Slice<TreasuryBond[]>;
  news: Slice<TopicNewsArticle[]>;
}

type SliceKey = keyof Slices;
type SliceData<K extends SliceKey> = NonNullable<Slices[K]["data"]>;

interface InvestmentState extends Slices {
  /** Cotação por símbolo (maiúsculo). Cada papel carrega e falha sozinho. */
  quotes: Record<string, Slice<ForeignQuote>>;
  syncing: boolean;
  syncError: string | null;

  fetchSummary: (force?: boolean) => Promise<void>;
  fetchPositions: (force?: boolean) => Promise<void>;
  fetchMovements: (force?: boolean) => Promise<void>;
  fetchProfile: (force?: boolean) => Promise<void>;
  fetchMacro: (force?: boolean) => Promise<void>;
  fetchTreasury: (force?: boolean) => Promise<void>;
  /** Manchetes dos tópicos do perfil; sem tópico, radar vazio sem ir à rede. */
  fetchNews: (force?: boolean) => Promise<void>;
  fetchQuote: (symbol: string, market?: string, force?: boolean) => Promise<void>;
  /** Cotações dos tickers acompanhados e das posições que precisam de preço. */
  fetchWatchQuotes: (force?: boolean) => Promise<void>;
  /** Tudo em paralelo; uma fatia falhando não impede as outras. */
  fetchAll: (force?: boolean) => Promise<void>;
  /** Puxa do conector e recarrega o que ele muda. `null` em falha (ver `syncError`). */
  sync: () => Promise<InvestmentSyncResult | null>;
  createPosition: (payload: InvestmentPositionPayload) => Promise<InvestmentPosition>;
  updatePosition: (
    id: string,
    patch: Partial<InvestmentPositionPayload>,
  ) => Promise<InvestmentPosition>;
  deletePosition: (id: string) => Promise<void>;
  addInterest: (interest: InvestmentInterest) => Promise<void>;
  removeInterest: (kind: InvestmentInterestKind, code: string) => Promise<void>;
  reset: () => void;
}

// Fábrica, e não constante: `quotes` é um objeto, e uma instância compartilhada
// entre o estado inicial e cada reset seria a mesma referência circulando
const emptyState = () => ({
  summary: emptySlice<InvestmentSummary>(),
  positions: emptySlice<InvestmentPosition[]>(),
  movements: emptySlice<InvestmentMovements>(),
  profile: emptySlice<InvestmentProfile>(),
  macro: emptySlice<MacroIndicator[]>(),
  treasury: emptySlice<TreasuryBond[]>(),
  news: emptySlice<TopicNewsArticle[]>(),
  quotes: {} as Record<string, Slice<ForeignQuote>>,
  syncing: false,
  syncError: null as string | null,
});

/** Dentro da janela e sem erro pendente: erro invalida o cache, como no indicatorStore. */
const isFresh = (slice: Slice<unknown>, now = Date.now()) =>
  slice.fetchedAt !== null &&
  slice.error === null &&
  now - slice.fetchedAt < INVESTMENT_CACHE_TTL_MS;

const loaded = <T>(data: T): Slice<T> => ({
  data,
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  unavailable: false,
});

const unavailable = <T>(empty: T): Slice<T> => ({
  data: empty,
  loading: false,
  error: null,
  fetchedAt: Date.now(),
  unavailable: true,
});

export const useInvestmentStore = create<InvestmentState>((set, get) => {
  // Tipado pelo DADO da fatia, e não por `Slices[K]`: com a chave genérica o
  // compilador reduz `Slices[K]` à interseção de todas as fatias, e nenhuma
  // fatia concreta satisfaz as sete ao mesmo tempo
  const setSlice = <K extends SliceKey>(key: K, slice: Slice<SliceData<K>>) =>
    set((state) => ({ ...state, [key]: slice }));

  const setQuote = (symbol: string, slice: Slice<ForeignQuote>) =>
    set((state) => ({ quotes: { ...state.quotes, [symbol]: slice } }));

  /**
   * O ciclo de uma fatia. Em voo, ignora a repetição; no cache, devolve na
   * hora; 404 vira vazio honesto; qualquer outra falha guarda a mensagem e
   * PRESERVA o dado anterior — a tela continua mostrando o que tinha, com o
   * aviso de que a atualização não veio.
   */
  const load = async <K extends SliceKey>(
    key: K,
    loader: () => Promise<SliceData<K>>,
    empty: SliceData<K>,
    failure: string,
    force: boolean,
  ): Promise<void> => {
    const current = get()[key] as Slice<SliceData<K>>;
    if (current.loading) return;
    if (!force && isFresh(current)) return;

    setSlice(key, { ...current, loading: true, error: null });
    try {
      setSlice(key, loaded(await loader()));
    } catch (e) {
      if (getApiErrorStatus(e) === 404) {
        setSlice(key, unavailable(empty));
        return;
      }
      setSlice(key, { ...current, loading: false, error: failure });
    }
  };

  /** O que um cadastro ou sincronização muda além da própria lista. */
  const reloadDerived = async () => {
    await Promise.allSettled([get().fetchSummary(true), get().fetchProfile(true)]);
    await Promise.allSettled([get().fetchNews(true), get().fetchWatchQuotes(true)]);
  };

  return {
    ...emptyState(),

    fetchSummary: (force = false) =>
      load(
        "summary",
        getInvestmentSummary,
        EMPTY_SUMMARY,
        "Não foi possível carregar o resumo dos investimentos.",
        force,
      ),

    fetchPositions: (force = false) =>
      load(
        "positions",
        getInvestmentPositions,
        [],
        "Não foi possível carregar suas posições.",
        force,
      ),

    fetchMovements: (force = false) =>
      load(
        "movements",
        () => getInvestmentMovements(12),
        EMPTY_MOVEMENTS,
        "Não foi possível carregar as movimentações.",
        force,
      ),

    fetchProfile: (force = false) =>
      load(
        "profile",
        getInvestmentProfile,
        EMPTY_PROFILE,
        "Não foi possível carregar seu perfil de investidor.",
        force,
      ),

    fetchMacro: (force = false) =>
      load(
        "macro",
        getMacroIndicators,
        [],
        "Não foi possível carregar os indicadores.",
        force,
      ),

    fetchTreasury: (force = false) =>
      load(
        "treasury",
        getTreasuryBonds,
        [],
        "Não foi possível carregar os títulos do Tesouro.",
        force,
      ),

    fetchNews: async (force = false) => {
      const topics = get().profile.data?.topics ?? [];
      if (topics.length === 0) {
        // Sem tópico não há pergunta a fazer: o radar vazio É a resposta, e
        // ir à rede por ela devolveria manchetes de ninguém
        if (!force && isFresh(get().news)) return;
        setSlice("news", loaded<TopicNewsArticle[]>([]));
        return;
      }
      await load(
        "news",
        async () => (await getNewsByTopics(topics, RADAR_HEADLINES)).articles,
        [],
        "Não foi possível carregar o radar.",
        force,
      );
    },

    fetchQuote: async (symbol, market = DEFAULT_FOREIGN_MARKET, force = false) => {
      const key = symbol.trim().toUpperCase();
      if (!key) return;
      const current = get().quotes[key] ?? emptySlice<ForeignQuote>();
      if (current.loading) return;
      if (!force && isFresh(current)) return;

      setQuote(key, { ...current, loading: true, error: null });
      try {
        setQuote(key, loaded(await getForeignQuote(key, market)));
      } catch (e) {
        // 404 aqui é também "papel desconhecido": para a tela dá o mesmo —
        // cotação indisponível, sem botão de tentar de novo
        if (getApiErrorStatus(e) === 404) {
          setQuote(key, {
            data: null,
            loading: false,
            error: null,
            fetchedAt: Date.now(),
            unavailable: true,
          });
          return;
        }
        setQuote(key, {
          ...current,
          loading: false,
          error: "Cotação indisponível agora.",
        });
      }
    },

    fetchWatchQuotes: async (force = false) => {
      const wanted = new Map<string, string>();
      (get().profile.data?.watch ?? [])
        .filter((watch) => watch.kind === "TICKER")
        .forEach((watch) =>
          wanted.set(
            watch.code.toUpperCase(),
            watch.market || DEFAULT_FOREIGN_MARKET,
          ),
        );
      // A posição manual em dólar precisa do preço mesmo que o usuário não
      // tenha pedido para acompanhar o ticker
      (get().summary.data?.needsQuote ?? []).forEach((code) => {
        const key = code.toUpperCase();
        if (!wanted.has(key)) wanted.set(key, DEFAULT_FOREIGN_MARKET);
      });
      await Promise.all(
        [...wanted].map(([symbol, market]) =>
          get().fetchQuote(symbol, market, force),
        ),
      );
    },

    fetchAll: async (force = false) => {
      const state = get();
      // Radar e cotações dependem do perfil (tópicos, tickers) e do resumo
      // (posições sem preço): encadeados atrás dos dois, e os dois em paralelo
      // com todo o resto. `allSettled` por disciplina — cada fatia já engole
      // a própria falha, mas nenhuma pode derrubar as irmãs
      const dependent = Promise.all([
        state.fetchProfile(force),
        state.fetchSummary(force),
      ]).then(() =>
        Promise.all([state.fetchNews(force), state.fetchWatchQuotes(force)]),
      );
      await Promise.allSettled([
        dependent,
        state.fetchPositions(force),
        state.fetchMovements(force),
        state.fetchMacro(force),
        state.fetchTreasury(force),
      ]);
    },

    sync: async () => {
      if (get().syncing) return null;
      set({ syncing: true, syncError: null });
      try {
        const result = await syncInvestments();
        set({ syncing: false });
        // A sincronização é o momento em que posições e movimentos mudam de
        // verdade: recarrega os dois e tudo que deriva deles
        await Promise.allSettled([
          get().fetchPositions(true),
          get().fetchMovements(true),
        ]);
        await reloadDerived();
        return result;
      } catch (e) {
        const status = getApiErrorStatus(e);
        set({
          syncing: false,
          syncError:
            status === 503
              ? "O conector do banco está desligado neste servidor."
              : status === 404
                ? "Este servidor ainda não sincroniza investimentos."
                : "Não foi possível sincronizar agora.",
        });
        return null;
      }
    },

    createPosition: async (payload) => {
      const created = await createInvestmentPosition(payload);
      set((state) => ({
        positions: {
          ...loaded([...(state.positions.data ?? []), created]),
        },
      }));
      await reloadDerived();
      return created;
    },

    updatePosition: async (id, patch) => {
      const updated = await updateInvestmentPosition(id, patch);
      set((state) => ({
        positions: loaded(
          (state.positions.data ?? []).map((position) =>
            position.id === id ? updated : position,
          ),
        ),
      }));
      await reloadDerived();
      return updated;
    },

    deletePosition: async (id) => {
      await deleteInvestmentPosition(id);
      set((state) => ({
        positions: loaded(
          (state.positions.data ?? []).filter((position) => position.id !== id),
        ),
      }));
      await reloadDerived();
    },

    addInterest: async (interest) => {
      await addInvestmentInterest(interest);
      // O perfil é quem diz o que aparece: sem recarregá-lo o cartão novo só
      // apareceria daqui a cinco minutos
      await get().fetchProfile(true);
      await Promise.allSettled([get().fetchNews(true), get().fetchWatchQuotes(true)]);
    },

    removeInterest: async (kind, code) => {
      await removeInvestmentInterest(kind, code);
      await get().fetchProfile(true);
      await get().fetchNews(true);
    },

    reset: () => set(emptyState()),
  };
});

// --- Seletores puros ---

/** Dólar PTAX do bloco macro, para converter posição manual sem `priceBrl`. */
export function selectUsdBrl(state: Pick<InvestmentState, "macro">): number | null {
  const ptax = state.macro.data?.find((item) => item.code === "USD_PTAX");
  return ptax && Number.isFinite(ptax.value) ? ptax.value : null;
}

/** Só as cotações que chegaram, no formato que `positionCurrentValue` lê. */
export function selectQuotes(
  state: Pick<InvestmentState, "quotes">,
): Record<string, ForeignQuote | undefined> {
  const result: Record<string, ForeignQuote | undefined> = {};
  Object.entries(state.quotes).forEach(([symbol, slice]) => {
    if (slice.data) result[symbol] = slice.data;
  });
  return result;
}

/**
 * O servidor desta sessão não tem o módulo: resumo E posições responderam
 * 404. A tela troca o convite "conecte ou cadastre" por um aviso — cadastrar
 * também daria 404.
 */
export function selectServerLacksInvestments(
  state: Pick<InvestmentState, "summary" | "positions">,
): boolean {
  return state.summary.unavailable && state.positions.unavailable;
}
