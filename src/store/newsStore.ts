import { create } from "zustand";

import api, { type NewsArticle } from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

/**
 * Recorte de notícias pedido por uma tela. Todos os campos são opcionais: sem
 * nenhum, é o radar inteiro que a Home e a tela de Notícias mostram.
 */
export interface NewsQuery {
  region?: string;
  category?: string;
  topics?: string[];
  q?: string;
  limit?: number;
}

interface NewsResponsePayload {
  articles: NewsArticle[];
  /** Último ciclo bom do agregador no servidor; null em boot frio. */
  updatedAt?: string | null;
}

/** Uma resposta boa guardada, com a hora em que ela chegou. */
export interface NewsEntry {
  articles: NewsArticle[];
  updatedAt: string | null;
  /** `Date.now()` da resposta — é o que o TTL compara. */
  fetchedAt: number;
}

interface NewsState {
  /** Uma entrada por recorte; recortes diferentes não se atropelam. */
  entries: Record<string, NewsEntry>;
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;

  /**
   * Busca o recorte se ele estiver vencido (ou `force`, que é o puxar para
   * atualizar). Dentro do TTL não sai requisição nenhuma.
   */
  fetch: (query?: NewsQuery, force?: boolean) => Promise<void>;
  reset: () => void;
}

/**
 * Dez minutos: o agregador do servidor roda a cada dez, então pedir de novo
 * antes disso devolveria exatamente a mesma lista. O TTL existe porque as três
 * telas que mostram notícias (Home, carrossel do Mercado e a tela de Notícias)
 * ficam montadas depois da primeira visita e cada volta refazia a busca — a
 * Home sozinha pedia manchetes três vezes no boot.
 */
export const NEWS_TTL_MS = 10 * 60 * 1000;

/**
 * Chave estável do recorte. Ordem alfabética e tópicos ordenados de propósito:
 * `["cambio","bolsa"]` e `["bolsa","cambio"]` são o mesmo pedido e não podem
 * virar duas entradas (nem duas requisições).
 */
export function newsCacheKey(query: NewsQuery = {}): string {
  const topics = query.topics?.length
    ? [...query.topics].sort().join(",")
    : "";
  return [
    query.region ?? "",
    query.category ?? "",
    topics,
    query.q ?? "",
    query.limit != null ? String(query.limit) : "",
  ].join("|");
}

/**
 * Requisições em voo por chave. Duas telas que montam no mesmo frame pedem o
 * mesmo recorte — sem isto seriam dois round-trips para a mesma resposta, que
 * é justamente o desperdício que este store existe para eliminar. Fica fora do
 * estado do zustand porque promessa não é dado de tela.
 */
const inFlight = new Map<string, Promise<void>>();

function paramsFor(query: NewsQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {};
  if (query.region) params.region = query.region;
  if (query.category) params.category = query.category;
  if (query.topics?.length) params.topics = query.topics.join(",");
  if (query.q) params.q = query.q;
  if (query.limit != null) params.limit = query.limit;
  return params;
}

export const useNewsStore = create<NewsState>((set, get) => ({
  entries: {},
  loading: {},
  errors: {},

  fetch: async (query = {}, force = false) => {
    const key = newsCacheKey(query);

    const cached = get().entries[key];
    if (!force && cached && Date.now() - cached.fetchedAt < NEWS_TTL_MS) return;

    const running = inFlight.get(key);
    if (running) return running;

    const request = (async () => {
      set((state) => ({
        loading: { ...state.loading, [key]: true },
        errors: { ...state.errors, [key]: null },
      }));
      try {
        const response = await api.get<NewsResponsePayload>(
          "/news/top-headlines",
          { params: paramsFor(query) },
        );
        set((state) => ({
          entries: {
            ...state.entries,
            [key]: {
              articles: response.data.articles ?? [],
              updatedAt: response.data.updatedAt ?? null,
              fetchedAt: Date.now(),
            },
          },
          loading: { ...state.loading, [key]: false },
        }));
      } catch (e) {
        // A lista anterior FICA: notícia de dez minutos atrás vale mais que um
        // bloco vazio, e a tela mostra o aviso ao lado do que já está lá
        set((state) => ({
          loading: { ...state.loading, [key]: false },
          errors: {
            ...state.errors,
            [key]: describeLoadFailure(
              e,
              "Não foi possível carregar as notícias.",
            ),
          },
        }));
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, request);
    return request;
  },

  reset: () => {
    // As promessas em voo também vão: uma resposta pedida com a sessão antiga
    // repovoaria o cache depois do logout
    inFlight.clear();
    set({ entries: {}, loading: {}, errors: {} });
  },
}));
