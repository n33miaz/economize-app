import { getCatalog } from "../../services/api";
import { useCatalogStore } from "../catalogStore";

import type { CatalogItem, CatalogPage, CatalogPageInfo } from "../../services/api";

jest.mock("../../services/api", () => ({
  getCatalog: jest.fn(),
}));

const mockGetCatalog = getCatalog as jest.MockedFunction<typeof getCatalog>;

const item = (id: string): CatalogItem => ({
  id,
  type: "stock",
  code: id.toUpperCase(),
  name: `Ativo ${id}`,
  buy: 10,
  sell: null,
  variation: 1.2,
  segment: "acoes",
  quoteStatus: "LIVE",
});

const pageInfo = (over: Partial<CatalogPageInfo> = {}): CatalogPageInfo => ({
  limit: 20,
  returned: 2,
  hasMore: true,
  nextCursor: "cursor-2",
  totalMatched: 100,
  catalogVersion: "v1",
  rankEpoch: 1000,
  quoteBudgetRemaining: 400,
  ...over,
});

const página = (items: CatalogItem[], over: Partial<CatalogPageInfo> = {}): CatalogPage => ({
  items,
  page: pageInfo({ returned: items.length, ...over }),
});

describe("catalogStore — rolagem infinita (EC-099)", () => {
  beforeEach(() => {
    useCatalogStore.getState().reset();
    mockGetCatalog.mockReset();
  });

  it("a primeira página substitui a lista", async () => {
    mockGetCatalog.mockResolvedValue(página([item("a"), item("b")]));

    await useCatalogStore.getState().fetch();

    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual(["a", "b"]);
    expect(useCatalogStore.getState().isLoading).toBe(false);
  });

  it("a página seguinte EMENDA no fim, sem trocar a lista", async () => {
    mockGetCatalog.mockResolvedValueOnce(página([item("a"), item("b")]));
    await useCatalogStore.getState().fetch();

    mockGetCatalog.mockResolvedValueOnce(página([item("c"), item("d")]));
    await useCatalogStore.getState().fetchMore();

    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("manda o cursor da página anterior, e não começa do zero", async () => {
    mockGetCatalog.mockResolvedValueOnce(
      página([item("a")], { nextCursor: "abc123" }),
    );
    await useCatalogStore.getState().fetch();

    mockGetCatalog.mockResolvedValueOnce(página([item("b")]));
    await useCatalogStore.getState().fetchMore();

    expect(mockGetCatalog).toHaveBeenLastCalledWith(
      expect.objectContaining({ cursor: "abc123" }),
    );
  });

  it("no fim da lista não pede mais nada", async () => {
    mockGetCatalog.mockResolvedValueOnce(
      página([item("a")], { hasMore: false, nextCursor: null }),
    );
    await useCatalogStore.getState().fetch();
    mockGetCatalog.mockClear();

    await useCatalogStore.getState().fetchMore();

    // `onEndReached` do FlatList dispara várias vezes na mesma rolagem: sem a
    // guarda, o fim da lista viraria uma sequência de chamadas iguais
    expect(mockGetCatalog).not.toHaveBeenCalled();
  });

  it("rolagem que chega enquanto outra está em voo não duplica chamada", async () => {
    mockGetCatalog.mockResolvedValueOnce(página([item("a")]));
    await useCatalogStore.getState().fetch();

    let liberar: (p: CatalogPage) => void = () => {};
    mockGetCatalog.mockImplementationOnce(
      () => new Promise<CatalogPage>((resolve) => {
        liberar = resolve;
      }),
    );

    const primeira = useCatalogStore.getState().fetchMore();
    await useCatalogStore.getState().fetchMore(); // ignorada: já há uma em curso
    liberar(página([item("b")]));
    await primeira;

    // duas de verdade: a inicial e UMA de continuação
    expect(mockGetCatalog).toHaveBeenCalledTimes(2);
    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual(["a", "b"]);
  });

  it("item repetido entre páginas entra uma vez só", async () => {
    mockGetCatalog.mockResolvedValueOnce(página([item("a"), item("b")]));
    await useCatalogStore.getState().fetch();

    // A API repete o mesmo ativo com ids distintos; quando o id É o mesmo, a
    // culpa é da borda da página e a lista não pode mostrar duas linhas iguais
    mockGetCatalog.mockResolvedValueOnce(página([item("b"), item("c")]));
    await useCatalogStore.getState().fetchMore();

    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("ordem recalculada no servidor recomeça a lista em vez de emendar", async () => {
    mockGetCatalog.mockResolvedValueOnce(
      página([item("a"), item("b")], { rankEpoch: 1000 }),
    );
    await useCatalogStore.getState().fetch();

    // Janela nova: emendar páginas de ordens diferentes é o que faz item
    // repetir e item desaparecer no meio da rolagem
    mockGetCatalog.mockResolvedValueOnce(
      página([item("x"), item("y")], { rankEpoch: 2000 }),
    );
    await useCatalogStore.getState().fetchMore();

    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual(["x", "y"]);
    expect(useCatalogStore.getState().page?.rankEpoch).toBe(2000);
  });

  it("resposta de filtro antigo não sobrescreve a lista do filtro novo", async () => {
    let liberarAntiga: (p: CatalogPage) => void = () => {};
    mockGetCatalog.mockImplementationOnce(
      () => new Promise<CatalogPage>((resolve) => {
        liberarAntiga = resolve;
      }),
    );
    const antiga = useCatalogStore.getState().fetch();

    useCatalogStore.getState().setFilters({ segment: "fiis" });
    mockGetCatalog.mockResolvedValueOnce(página([item("fii1")]));
    await useCatalogStore.getState().fetch();

    liberarAntiga(página([item("velho")]));
    await antiga;

    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual(["fii1"]);
  });

  it("o filtro vai para o servidor, que é quem ordena e recorta", async () => {
    useCatalogStore.getState().setFilters({ segment: "fiis", q: " petro ", sort: "name" });
    mockGetCatalog.mockResolvedValue(página([item("a")]));

    await useCatalogStore.getState().fetch(["stock_PETR4"]);

    expect(mockGetCatalog).toHaveBeenCalledWith(
      expect.objectContaining({
        segment: "fiis",
        q: "petro",
        sort: "name",
        favorites: "stock_PETR4",
      }),
    );
  });

  it("filtro vazio não vira parâmetro vazio na URL", async () => {
    mockGetCatalog.mockResolvedValue(página([item("a")]));

    await useCatalogStore.getState().fetch();

    const query = mockGetCatalog.mock.calls[0][0];
    expect(query).not.toHaveProperty("segment");
    expect(query).not.toHaveProperty("q");
    expect(query).not.toHaveProperty("favorites");
  });

  it("falha na primeira página é erro de tela; falha na seguinte preserva o que já rolou", async () => {
    mockGetCatalog.mockRejectedValueOnce(new Error("offline"));
    await useCatalogStore.getState().fetch();
    expect(useCatalogStore.getState().error).toMatch(/catálogo/i);
    expect(useCatalogStore.getState().items).toEqual([]);

    mockGetCatalog.mockResolvedValueOnce(página([item("a")]));
    await useCatalogStore.getState().fetch();

    mockGetCatalog.mockRejectedValueOnce(new Error("offline"));
    await useCatalogStore.getState().fetchMore();

    expect(useCatalogStore.getState().items.map((i) => i.id)).toEqual(["a"]);
    expect(useCatalogStore.getState().error).toMatch(/mais itens/i);
    expect(useCatalogStore.getState().isLoadingMore).toBe(false);
  });

  it("reset invalida resposta em voo", async () => {
    let liberar: (p: CatalogPage) => void = () => {};
    mockGetCatalog.mockImplementationOnce(
      () => new Promise<CatalogPage>((resolve) => {
        liberar = resolve;
      }),
    );
    const emVoo = useCatalogStore.getState().fetch();

    useCatalogStore.getState().reset();
    liberar(página([item("a")]));
    await emVoo;

    expect(useCatalogStore.getState().items).toEqual([]);
  });
});
