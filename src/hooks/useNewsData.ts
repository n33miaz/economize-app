import { useCallback, useEffect, useMemo } from "react";

import { type NewsArticle } from "../services/api";
import {
  type NewsQuery,
  newsCacheKey,
  useNewsStore,
} from "../store/newsStore";

type UseNewsDataParams = NewsQuery;

interface UseNewsData {
  articles: NewsArticle[];
  loading: boolean;
  error: string | null;
  /** Hora do último ciclo bom do agregador no servidor; null em boot frio. */
  updatedAt: string | null;
  /** Puxar para atualizar: ignora o TTL. */
  fetchNews: () => Promise<void>;
}

/**
 * Manchetes de um recorte, vindas do store compartilhado.
 *
 * Antes cada componente guardava a própria lista em `useState` e buscava no
 * `useEffect`: Home, carrossel e a tela de Notícias pediam a MESMA resposta
 * três vezes no boot, e trocar de aba refazia tudo. Agora o recorte tem uma
 * entrada só, com TTL de dez minutos — o mesmo passo do agendador que monta o
 * agregado no servidor, então pedir antes disso devolveria lista idêntica.
 */
export default function useNewsData(
  params: UseNewsDataParams = {},
): UseNewsData {
  const { region, category, q, limit } = params;
  const topicsKey = params.topics?.length
    ? [...params.topics].sort().join(",")
    : "";

  // O objeto do recorte é recriado a cada render; a identidade tem de vir dos
  // valores, senão o `useEffect` dispararia uma busca por render
  const query = useMemo<NewsQuery>(
    () => ({
      region,
      category,
      topics: topicsKey ? topicsKey.split(",") : undefined,
      q,
      limit,
    }),
    [region, category, topicsKey, q, limit],
  );

  const key = newsCacheKey(query);

  const entry = useNewsStore((s) => s.entries[key]);
  const isLoading = useNewsStore((s) => s.loading[key] ?? false);
  const error = useNewsStore((s) => s.errors[key] ?? null);
  const fetch = useNewsStore((s) => s.fetch);

  const fetchNews = useCallback(() => fetch(query, true), [fetch, query]);

  useEffect(() => {
    fetch(query);
  }, [fetch, query]);

  return {
    articles: entry?.articles ?? [],
    // Esqueleto só enquanto NÃO há nada guardado: com lista em mão, a
    // renovação silenciosa não pode apagar a tela que o usuário já está lendo
    loading: isLoading && !entry,
    error,
    updatedAt: entry?.updatedAt ?? null,
    fetchNews,
  };
}
