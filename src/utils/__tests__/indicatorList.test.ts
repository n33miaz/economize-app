import type { Indicator } from "../../services/api";
import {
  DEFAULT_ASSET_FILTERS,
  favoriteDisplayItems,
  hasActiveFilters,
  mergeSearchResults,
  sortIndicators,
} from "../indicatorList";

// Fábrica mínima: cada teste sobrescreve só o que importa para o caso
const make = (
  code: string,
  overrides: Partial<Indicator> = {},
): Indicator => ({
  id: `id-${code}`,
  type: "currency",
  code,
  name: code,
  buy: 1,
  sell: null,
  variation: 0,
  ...overrides,
});

describe("mergeSearchResults", () => {
  it("appends remote items after the local ones, preserving order", () => {
    const local = [make("USD"), make("EUR")];
    const remote = [make("GBP"), make("JPY")];

    const merged = mergeSearchResults(local, remote);

    expect(merged.map((i) => i.code)).toEqual(["USD", "EUR", "GBP", "JPY"]);
  });

  it("dedupes by code keeping the local occurrence", () => {
    const local = [make("USD", { name: "Dólar (local)" })];
    const remote = [make("USD", { name: "Dólar (remoto)" }), make("BTC")];

    const merged = mergeSearchResults(local, remote);

    expect(merged.map((i) => i.code)).toEqual(["USD", "BTC"]);
    expect(merged[0].name).toBe("Dólar (local)");
  });

  it("dedupes repeated codes inside the remote payload", () => {
    const remote = [make("BTC"), make("BTC"), make("ETH")];

    const merged = mergeSearchResults([], remote);

    expect(merged.map((i) => i.code)).toEqual(["BTC", "ETH"]);
  });

  it("skips remote items without a code", () => {
    const broken = make("", { name: "sem código" });

    const merged = mergeSearchResults([make("USD")], [broken, make("ETH")]);

    expect(merged.map((i) => i.code)).toEqual(["USD", "ETH"]);
  });

  it("handles empty sides and does not mutate the inputs", () => {
    const local = [make("USD")];
    const remote = [make("BTC")];

    expect(mergeSearchResults([], remote).map((i) => i.code)).toEqual(["BTC"]);
    expect(mergeSearchResults(local, []).map((i) => i.code)).toEqual(["USD"]);

    mergeSearchResults(local, remote);
    expect(local).toHaveLength(1);
    expect(remote).toHaveLength(1);
  });
});

describe("sortIndicators", () => {
  const items = [
    make("USD", { name: "Dólar", buy: 5.4, variation: -0.8 }),
    make("BTC", { name: "Bitcoin", buy: 350000, variation: 2.5 }),
    make("IBOV", {
      name: "IBOVESPA",
      type: "index",
      buy: 0,
      points: 120000,
      variation: 1.2,
    }),
    make("EUR", { name: "Euro", buy: 6.1, variation: 0.3 }),
  ];

  it("keeps the original order on default sort", () => {
    const sorted = sortIndicators(items, "default");
    expect(sorted.map((i) => i.code)).toEqual(["USD", "BTC", "IBOV", "EUR"]);
  });

  it("sorts by biggest gain first", () => {
    const sorted = sortIndicators(items, "gainers");
    expect(sorted.map((i) => i.code)).toEqual(["BTC", "IBOV", "EUR", "USD"]);
  });

  it("sorts by biggest loss first", () => {
    const sorted = sortIndicators(items, "losers");
    expect(sorted.map((i) => i.code)).toEqual(["USD", "EUR", "IBOV", "BTC"]);
  });

  it("sorts by name ignoring case and accents (pt-BR)", () => {
    const named = [
      make("A3", { name: "Ágio Máximo" }),
      make("A1", { name: "zebra" }),
      make("A2", { name: "Abacate" }),
    ];
    const sorted = sortIndicators(named, "name-asc");
    expect(sorted.map((i) => i.name)).toEqual([
      "Abacate",
      "Ágio Máximo",
      "zebra",
    ]);
  });

  it("sorts by price using points when present, buy otherwise", () => {
    const desc = sortIndicators(items, "price-desc");
    expect(desc.map((i) => i.code)).toEqual(["BTC", "IBOV", "EUR", "USD"]);

    const asc = sortIndicators(items, "price-asc");
    expect(asc.map((i) => i.code)).toEqual(["USD", "EUR", "IBOV", "BTC"]);
  });

  it("does not mutate the input array", () => {
    const input = [make("B", { variation: 1 }), make("A", { variation: 9 })];
    sortIndicators(input, "gainers");
    expect(input.map((i) => i.code)).toEqual(["B", "A"]);
  });
});

describe("favoriteDisplayItems (favoritos renderizáveis)", () => {
  it("mostra só os favoritos presentes na lista local", () => {
    const local = [make("USD"), make("EUR"), make("BTC")];
    const result = favoriteDisplayItems(local, [], ["id-USD", "id-BTC"]);
    expect(result.map((i) => i.code)).toEqual(["USD", "BTC"]);
  });

  it("completa com o retrato quando o favorito não vive na lista local", () => {
    const local = [make("USD")];
    const snapshots = [make("PETR4", { name: "Petrobras PN" })];
    const result = favoriteDisplayItems(local, snapshots, [
      "id-USD",
      "id-PETR4",
    ]);
    expect(result.map((i) => i.code)).toEqual(["USD", "PETR4"]);
  });

  it("dado local fresco vence o retrato no dedupe por code|nome", () => {
    const local = [make("USD", { name: "Dólar", buy: 5.5 })];
    const snapshots = [make("USD", { name: "Dólar", buy: 5.1 })];
    const result = favoriteDisplayItems(local, snapshots, ["id-USD"]);
    expect(result).toHaveLength(1);
    expect(result[0].buy).toBe(5.5);
  });

  it("retrato de quem foi desfavoritado não entra", () => {
    const snapshots = [make("PETR4"), make("VALE3")];
    const result = favoriteDisplayItems([], snapshots, ["id-VALE3"]);
    expect(result.map((i) => i.code)).toEqual(["VALE3"]);
  });

  it("sem favoritos devolve vazio mesmo com listas cheias", () => {
    expect(favoriteDisplayItems([make("USD")], [make("BTC")], [])).toEqual([]);
  });

  it("dedupa ativos repetidos da própria lista local (ids distintos)", () => {
    const local = [
      make("USD", { id: "id-USD-a", name: "Dólar" }),
      make("USD", { id: "id-USD-b", name: "Dólar" }),
    ];
    const result = favoriteDisplayItems(local, [], ["id-USD-a", "id-USD-b"]);
    expect(result).toHaveLength(1);
  });
});

describe("hasActiveFilters", () => {
  it("is inactive on defaults", () => {
    expect(hasActiveFilters(DEFAULT_ASSET_FILTERS, true)).toBe(false);
    expect(hasActiveFilters(DEFAULT_ASSET_FILTERS, false)).toBe(false);
  });

  it("activates on any non-default sort", () => {
    expect(
      hasActiveFilters({ sort: "gainers", includeTourism: false }, false),
    ).toBe(true);
  });

  it("counts tourism only where the toggle applies", () => {
    const withTourism = { sort: "default" as const, includeTourism: true };
    expect(hasActiveFilters(withTourism, true)).toBe(true);
    // na aba de índices o toggle não muda a lista — não pode acender o badge
    expect(hasActiveFilters(withTourism, false)).toBe(false);
  });
});
