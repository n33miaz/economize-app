import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api, { Indicator, isCurrencyData, isIndexData } from "../services/api";
import {
  AssetListFilters,
  DEFAULT_ASSET_FILTERS,
} from "../utils/indicatorList";

// A API repete o mesmo ativo com ids distintos — fica só a primeira ocorrência
const dedupeBy = (items: Indicator[], keyOf: (item: Indicator) => string) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const dedupeByCode = (items: Indicator[]) => dedupeBy(items, (i) => i.code);

// Chave de cada aba do Mercado: os filtros são independentes por aba
export type AssetTab = "currencies" | "indexes";

interface IndicatorState {
  indicators: Indicator[];
  loading: boolean;
  error: string | null;
  // Em memória de propósito: ordenação é ajuste de sessão, não preferência —
  // reabrir o app volta ao padrão do mercado
  filters: Record<AssetTab, AssetListFilters>;
  // Retrato do indicador no momento em que foi favoritado. Existe porque a
  // busca remota (/indicators/search) devolve ativos que não entram em
  // `indicators`: sem o retrato, favoritar um resultado de busca acendia a
  // estrela mas o ativo não aparecia em nenhuma superfície de favoritos
  // (faixa do Mercado, bloco da Home). Persistido para sobreviver ao restart.
  favoriteSnapshots: Indicator[];
  upsertFavoriteSnapshot: (indicator: Indicator) => void;
  removeFavoriteSnapshot: (id: string) => void;
  setFilters: (tab: AssetTab, patch: Partial<AssetListFilters>) => void;
  resetFilters: (tab: AssetTab) => void;
  fetchIndicators: () => Promise<void>;
  searchIndicators: (query: string) => Promise<Indicator[]>;
  getCurrencies: () => Indicator[];
  getIndexes: () => Indicator[];
  getGlobalCurrencies: (targetCodes: string[]) => Indicator[];
  lastFetched: number | null;
}

// Chave de identidade de exibição (regra da casa): a API repete o mesmo ativo
// com ids distintos, então o retrato casa com o dado fresco por code|nome
const displayKeyOf = (item: Indicator) =>
  `${item.code}|${item.name.toLowerCase()}`;

// Dado fresco vence retrato: cada snapshot cujo code|nome aparece na lista
// recém-buscada é substituído pela versão atual (preço/variação do dia)
const refreshSnapshots = (
  snapshots: Indicator[],
  fresh: Indicator[],
): Indicator[] => {
  if (snapshots.length === 0) return snapshots;
  const freshByKey = new Map(fresh.map((item) => [displayKeyOf(item), item]));
  return snapshots.map((snap) => {
    const updated = freshByKey.get(displayKeyOf(snap));
    // O id original do retrato é preservado: é ele que está no favoritesStore
    return updated ? { ...updated, id: snap.id } : snap;
  });
};

export const useIndicatorStore = create<IndicatorState>()(
  persist(
    (set, get) => ({
      indicators: [],
      loading: false,
      error: null,
      lastFetched: null,
      filters: {
        currencies: { ...DEFAULT_ASSET_FILTERS },
        indexes: { ...DEFAULT_ASSET_FILTERS },
      },
      favoriteSnapshots: [],

      upsertFavoriteSnapshot: (indicator) =>
        set((state) => ({
          favoriteSnapshots: [
            ...state.favoriteSnapshots.filter(
              (snap) =>
                snap.id !== indicator.id &&
                displayKeyOf(snap) !== displayKeyOf(indicator),
            ),
            indicator,
          ],
        })),

      removeFavoriteSnapshot: (id) =>
        set((state) => ({
          favoriteSnapshots: state.favoriteSnapshots.filter(
            (snap) => snap.id !== id,
          ),
        })),

      setFilters: (tab, patch) =>
        set((state) => ({
          filters: {
            ...state.filters,
            [tab]: { ...state.filters[tab], ...patch },
          },
        })),

      resetFilters: (tab) =>
        set((state) => ({
          filters: { ...state.filters, [tab]: { ...DEFAULT_ASSET_FILTERS } },
        })),

      fetchIndicators: async () => {
        const CACHE_TIME = 5 * 60 * 1000; // 5 minutos
        const now = Date.now();
        const { indicators, error, lastFetched } = get();

        if (
          indicators.length > 0 &&
          !error &&
          lastFetched &&
          now - lastFetched < CACHE_TIME
        ) {
          return;
        }

        set({ loading: true, error: null });
        try {
          const response = await api.get<Indicator[]>("/indicators/all");
          set({
            indicators: response.data,
            // Retratos acompanham o mercado: preço/variação atualizados
            // sempre que a lista principal chega
            favoriteSnapshots: refreshSnapshots(
              get().favoriteSnapshots,
              response.data,
            ),
            loading: false,
          });
        } catch (e: any) {
          console.error("Erro ao buscar indicadores:", e);
          set({
            error: "Não foi possível conectar ao servidor.",
            loading: false,
          });
        }
      },

      searchIndicators: async (query: string) => {
        try {
          const response = await api.get<Indicator[]>("/indicators/search", {
            params: { query },
          });
          return response.data;
        } catch (e) {
          console.error("Erro na busca dinâmica:", e);
          return [];
        }
      },

      getCurrencies: () => {
        // Turismo fica de fora por padrão (duplicaria dólar/euro na lista),
        // mas o filtro da aba pode reincluí-lo para quem vai viajar. A
        // variante turismo repete o `code` da comercial, então aqui o dedupe
        // considera também o nome — só por code, o toggle ligado continuaria
        // sem mostrar nada novo.
        const { includeTourism } = get().filters.currencies;
        return dedupeBy(
          get()
            .indicators.filter(isCurrencyData)
            .filter(
              (item) =>
                includeTourism || !item.name.toLowerCase().includes("turismo"),
            ),
          (item) => `${item.code}|${item.name.toLowerCase()}`,
        );
      },
      getIndexes: () => {
        return dedupeByCode(get().indicators.filter(isIndexData));
      },

      getGlobalCurrencies: (targetCodes: string[]) => {
        return get()
          .indicators.filter(isCurrencyData)
          .filter((item) => targetCodes.includes(item.code));
      },
    }),
    {
      name: "@favorite_snapshots",
      storage: createJSONStorage(() => AsyncStorage),
      // Só os retratos persistem: cotações, filtros e loading são de sessão
      partialize: (state) =>
        ({ favoriteSnapshots: state.favoriteSnapshots }) as IndicatorState,
    },
  ),
);
