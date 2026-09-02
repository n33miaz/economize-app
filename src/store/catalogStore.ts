import { create } from "zustand";

import {
  getCatalog,
  type CatalogItem,
  type CatalogPageInfo,
  type CatalogQuery,
} from "../services/api";

/**
 * O catálogo ampliado em lista infinita (EC-099, metade de app).
 *
 * <p>A metade de API já entregava paginação por cursor com a ordem CONGELADA
 * por janela (`rankEpoch`): páginas da mesma janela são fatias da mesma ordem,
 * e é isso que impede a rolagem de repetir ou pular item. Faltava o lado que
 * rola.
 *
 * <p>Store própria, e não um campo novo no `indicatorStore`: aquele guarda a
 * lista curta e cacheada que alimenta a Home, a faixa de favoritos e as abas
 * curadas de Moedas e Índices. Misturar a rolagem profunda ali significaria
 * quatro telas dependendo do estado de paginação de uma quinta.
 */

/** Página pedida ao servidor. Acima do teto dele, é reduzida no servidor. */
const ITENS_POR_PAGINA = 20;

export interface CatalogFilters {
  /** Segmento único (acoes, fiis, ...) ou vazio para todos. */
  segment: string;
  /** Busca textual; o servidor ignora acento e caixa. */
  q: string;
  sort: "trending" | "name" | "code";
}

export const DEFAULT_CATALOG_FILTERS: CatalogFilters = {
  segment: "",
  q: "",
  sort: "trending",
};

interface CatalogState {
  items: CatalogItem[];
  page: CatalogPageInfo | null;
  filters: CatalogFilters;

  /** Primeira página (ou recomeço): a lista fica em esqueleto. */
  isLoading: boolean;
  /** Página seguinte: a lista continua na tela, com rodapé de carregamento. */
  isLoadingMore: boolean;
  error: string | null;

  setFilters: (patch: Partial<CatalogFilters>) => void;
  /** Recomeça do primeiro item com os filtros atuais. */
  fetch: (favorites?: string[]) => Promise<void>;
  /** Próxima página; ignorada quando não há mais nada ou já está buscando. */
  fetchMore: (favorites?: string[]) => Promise<void>;
  reset: () => void;
}

/**
 * Guarda de resposta velha. Trocar o filtro dispara uma busca nova, e a
 * resposta da anterior pode chegar depois: sem isto, ela sobrescreveria a
 * lista do filtro que o usuário está vendo.
 */
let requestId = 0;

/** A API repete o mesmo ativo com ids distintos — a página nova não duplica. */
const semRepetir = (atuais: CatalogItem[], novos: CatalogItem[]) => {
  const vistos = new Set(atuais.map((item) => item.id));
  return novos.filter((item) => {
    if (vistos.has(item.id)) return false;
    vistos.add(item.id);
    return true;
  });
};

const queryDe = (
  filters: CatalogFilters,
  favorites: string[] | undefined,
  cursor?: string,
): CatalogQuery => {
  const query: CatalogQuery = { limit: ITENS_POR_PAGINA, sort: filters.sort };
  if (filters.segment) query.segment = filters.segment;
  if (filters.q.trim()) query.q = filters.q.trim();
  if (favorites && favorites.length > 0) query.favorites = favorites.join(",");
  // O cursor carrega os filtros da consulta que o gerou: mandá-lo junto com
  // filtro diferente é 400 no servidor, de propósito
  if (cursor) query.cursor = cursor;
  return query;
};

export const useCatalogStore = create<CatalogState>((set, get) => ({
  items: [],
  page: null,
  filters: { ...DEFAULT_CATALOG_FILTERS },
  isLoading: false,
  isLoadingMore: false,
  error: null,

  setFilters: (patch) =>
    set((state) => ({ filters: { ...state.filters, ...patch } })),

  fetch: async (favorites) => {
    const id = ++requestId;
    set({ isLoading: true, error: null });
    try {
      const data = await getCatalog(queryDe(get().filters, favorites));
      if (id !== requestId) return;
      set({
        items: data.items,
        page: data.page,
        isLoading: false,
        // O rodapé de "carregando mais" pode estar ligado de uma rolagem que
        // este recomeço acabou de invalidar
        isLoadingMore: false,
      });
    } catch {
      if (id !== requestId) return;
      set({ error: "Não foi possível carregar o catálogo.", isLoading: false });
    }
  },

  fetchMore: async (favorites) => {
    const { page, isLoading, isLoadingMore, items, filters } = get();
    // Fim da lista, ou já há uma busca em curso: `onEndReached` do FlatList
    // dispara várias vezes na mesma rolagem
    if (isLoading || isLoadingMore) return;
    if (!page || !page.hasMore || !page.nextCursor) return;

    const id = ++requestId;
    set({ isLoadingMore: true, error: null });
    try {
      const data = await getCatalog(
        queryDe(filters, favorites, page.nextCursor),
      );
      if (id !== requestId) return;

      // Ordem recalculada no servidor: continuar emendando páginas de janelas
      // diferentes é o que faz item repetir e item desaparecer. Recomeçar é a
      // única saída honesta — e é barato, porque só acontece quando a janela
      // vira no meio de uma rolagem
      if (data.page.rankEpoch !== page.rankEpoch) {
        set({ items: data.items, page: data.page, isLoadingMore: false });
        return;
      }

      set({
        items: [...items, ...semRepetir(items, data.items)],
        page: data.page,
        isLoadingMore: false,
      });
    } catch {
      if (id !== requestId) return;
      // A lista que já está na tela continua válida: o erro é só da próxima
      // página, e some na próxima tentativa de rolagem
      set({
        error: "Não foi possível carregar mais itens.",
        isLoadingMore: false,
      });
    }
  },

  reset: () => {
    // Invalida qualquer resposta em voo: sem isto, uma página que chegasse
    // depois do reset repovoaria a lista que o usuário mandou limpar
    requestId += 1;
    set({
      items: [],
      page: null,
      filters: { ...DEFAULT_CATALOG_FILTERS },
      isLoading: false,
      isLoadingMore: false,
      error: null,
    });
  },
}));
