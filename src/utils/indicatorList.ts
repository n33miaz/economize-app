import type { Indicator } from "../services/api";

// Lógica pura da listagem de mercado (busca e ordenação), extraída da tela
// para ser testável sem montar componente.

export type AssetSort =
  | "default"
  | "gainers"
  | "losers"
  | "name-asc"
  | "price-desc"
  | "price-asc";

export interface AssetListFilters {
  sort: AssetSort;
  /** Só produz efeito na aba de moedas; nas demais é ignorado. */
  includeTourism: boolean;
}

export const DEFAULT_ASSET_FILTERS: AssetListFilters = {
  sort: "default",
  includeTourism: false,
};

/**
 * O botão de filtro só ganha badge quando há algo fora do padrão. O toggle de
 * turismo só conta onde ele se aplica (aba de moedas) — senão a aba de índices
 * marcaria filtro ativo por um estado que nem afeta a lista dela.
 */
export function hasActiveFilters(
  filters: AssetListFilters,
  tourismApplies: boolean,
): boolean {
  return (
    filters.sort !== DEFAULT_ASSET_FILTERS.sort ||
    (tourismApplies && filters.includeTourism)
  );
}

/**
 * União do filtro local com a busca remota, deduplicada por `code`. Os locais
 * vêm primeiro e nunca saem do lugar: quem já está na tela não pisca quando a
 * resposta do servidor chega — o remoto só acrescenta o que faltava.
 */
export function mergeSearchResults(
  local: Indicator[],
  remote: Indicator[],
): Indicator[] {
  const seen = new Set(local.map((item) => item.code));
  const merged = [...local];
  for (const item of remote) {
    // a API de busca já devolveu item sem code; não vale uma linha na lista
    if (!item?.code || seen.has(item.code)) continue;
    seen.add(item.code);
    merged.push(item);
  }
  return merged;
}

/**
 * Favoritos renderizáveis de uma superfície: os que estão na lista local
 * (dados frescos em tela) mais os retratos de quem só existe fora dela — o
 * caso do ativo favoritado a partir da busca remota. A lista local vence o
 * retrato, e o dedupe é por code|nome (regra da casa: a API repete o mesmo
 * ativo com ids distintos).
 */
export function favoriteDisplayItems(
  local: Indicator[],
  snapshots: Indicator[],
  favoriteIds: string[],
): Indicator[] {
  const favSet = new Set(favoriteIds);
  const seen = new Set<string>();
  const keyOf = (item: Indicator) =>
    `${item.code}|${item.name.toLowerCase()}`;
  const result: Indicator[] = [];
  for (const item of local) {
    if (!favSet.has(item.id)) continue;
    const key = keyOf(item);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  for (const snap of snapshots) {
    if (!favSet.has(snap.id)) continue;
    const key = keyOf(snap);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(snap);
  }
  return result;
}

// Índice cota em pontos e moeda em compra — o "preço" da ordenação é o mesmo
// valor que o card exibe
const priceOf = (item: Indicator) => item.points ?? item.buy ?? 0;

/**
 * Ordenação da lista conforme o filtro escolhido. "default" preserva a ordem
 * de chegada da API (relevância do mercado); as demais devolvem uma cópia,
 * sem mutar o array de entrada.
 */
export function sortIndicators(
  items: Indicator[],
  sort: AssetSort,
): Indicator[] {
  if (sort === "default") return items;
  const sorted = [...items];
  switch (sort) {
    case "gainers":
      sorted.sort((a, b) => (b.variation ?? 0) - (a.variation ?? 0));
      break;
    case "losers":
      sorted.sort((a, b) => (a.variation ?? 0) - (b.variation ?? 0));
      break;
    case "name-asc":
      sorted.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }),
      );
      break;
    case "price-desc":
      sorted.sort((a, b) => priceOf(b) - priceOf(a));
      break;
    case "price-asc":
      sorted.sort((a, b) => priceOf(a) - priceOf(b));
      break;
  }
  return sorted;
}
