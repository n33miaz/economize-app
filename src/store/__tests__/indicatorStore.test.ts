import api from "../../services/api";
import { useIndicatorStore } from "../indicatorStore";

import type { Indicator } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  isCurrencyData: (item: { type: string }) => item.type === "currency",
  isIndexData: (item: { type: string }) => item.type === "index",
}));

const mockGet = (api as unknown as { get: jest.Mock }).get;

const ind = (over: Partial<Indicator>): Indicator =>
  ({
    id: `id-${over.code}-${over.name}`,
    type: "currency",
    code: "USD",
    name: "Dólar Comercial",
    buy: 5.18,
    sell: null,
    variation: -0.03,
    ...over,
  }) as Indicator;

const ESTADO_LIMPO = {
  indicators: [] as Indicator[],
  loading: false,
  error: null,
  lastFetched: null,
  favoriteSnapshots: [] as Indicator[],
};

describe("indicatorStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useIndicatorStore.setState({ ...ESTADO_LIMPO });
  });

  it("carrega a lista de indicadores", async () => {
    mockGet.mockResolvedValue({ data: [ind({}), ind({ code: "EUR", name: "Euro" })] });

    await useIndicatorStore.getState().fetchIndicators();

    expect(useIndicatorStore.getState().indicators).toHaveLength(2);
    expect(useIndicatorStore.getState().loading).toBe(false);
    expect(useIndicatorStore.getState().lastFetched).not.toBeNull();
  });

  it("dentro do cache, não vai à rede de novo", async () => {
    useIndicatorStore.setState({
      indicators: [ind({})],
      lastFetched: Date.now(),
      error: null,
    });

    await useIndicatorStore.getState().fetchIndicators();

    // Cinco minutos: cada tela que abre pediria a lista inteira de novo
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("cache vencido busca de novo", async () => {
    useIndicatorStore.setState({
      indicators: [ind({})],
      lastFetched: Date.now() - 6 * 60 * 1000,
      error: null,
    });
    mockGet.mockResolvedValue({ data: [ind({})] });

    await useIndicatorStore.getState().fetchIndicators();

    expect(mockGet).toHaveBeenCalled();
  });

  it("erro anterior invalida o cache: tenta de novo mesmo dentro da janela", async () => {
    useIndicatorStore.setState({
      indicators: [ind({})],
      lastFetched: Date.now(),
      error: "falhou antes",
    });
    mockGet.mockResolvedValue({ data: [ind({})] });

    await useIndicatorStore.getState().fetchIndicators();

    // Ficar preso no cache com erro deixaria a tela em falha até o app reiniciar
    expect(mockGet).toHaveBeenCalled();
  });

  it("falha na busca vira mensagem de tela", async () => {
    mockGet.mockRejectedValue(new Error("offline"));

    await useIndicatorStore.getState().fetchIndicators();

    expect(useIndicatorStore.getState().error).toMatch(/servidor/i);
    expect(useIndicatorStore.getState().loading).toBe(false);
  });

  it("dado fresco atualiza o RETRATO do favorito, preservando o id original", async () => {
    const retrato = ind({ id: "favorito-antigo", buy: 5.0, variation: 0 });
    useIndicatorStore.setState({ favoriteSnapshots: [retrato], lastFetched: null });
    mockGet.mockResolvedValue({ data: [ind({ id: "id-novo", buy: 5.18, variation: -0.03 })] });

    await useIndicatorStore.getState().fetchIndicators();

    const [atualizado] = useIndicatorStore.getState().favoriteSnapshots;
    expect(atualizado.buy).toBe(5.18);
    // O id do retrato é o que está no favoritesStore: trocá-lo apagaria a estrela
    expect(atualizado.id).toBe("favorito-antigo");
  });

  it("busca remota devolve o que veio, e lista vazia quando falha", async () => {
    mockGet.mockResolvedValueOnce({ data: [ind({ code: "PETR4" })] });
    await expect(useIndicatorStore.getState().searchIndicators("PETR4"))
      .resolves.toHaveLength(1);

    mockGet.mockRejectedValueOnce(new Error("offline"));
    // A tela de busca não pode quebrar por falta de resultado
    await expect(useIndicatorStore.getState().searchIndicators("XPTO"))
      .resolves.toEqual([]);
  });

  it("moedas escondem o turismo por padrão", () => {
    useIndicatorStore.setState({
      indicators: [
        ind({ code: "USD", name: "Dólar Comercial" }),
        ind({ code: "USD", name: "Dólar Turismo" }),
        ind({ code: "EUR", name: "Euro" }),
      ],
    });

    const moedas = useIndicatorStore.getState().getCurrencies();

    // Turismo duplicaria dólar e euro na lista de quem não vai viajar
    expect(moedas.map((m) => m.name)).toEqual(["Dólar Comercial", "Euro"]);
  });

  it("com o filtro de turismo ligado, as duas variantes aparecem", () => {
    useIndicatorStore.setState({
      indicators: [
        ind({ code: "USD", name: "Dólar Comercial" }),
        ind({ code: "USD", name: "Dólar Turismo" }),
      ],
    });
    useIndicatorStore.getState().setFilters("currencies", { includeTourism: true });

    const moedas = useIndicatorStore.getState().getCurrencies();

    // O dedupe considera code E nome: só por code, ligar o filtro não
    // mostraria nada novo, porque turismo repete o code da comercial
    expect(moedas).toHaveLength(2);
  });

  it("índices saem sem repetição", () => {
    useIndicatorStore.setState({
      indicators: [
        ind({ type: "index", code: "IBOVESPA", name: "Ibovespa" }),
        ind({ type: "index", code: "IBOVESPA", name: "Ibovespa (2)" }),
        ind({ type: "currency", code: "USD", name: "Dólar" }),
      ],
    });

    expect(useIndicatorStore.getState().getIndexes()).toHaveLength(1);
  });

  it("moedas globais devolvem só os códigos pedidos", () => {
    useIndicatorStore.setState({
      indicators: [
        ind({ code: "USD", name: "Dólar" }),
        ind({ code: "EUR", name: "Euro" }),
        ind({ code: "GBP", name: "Libra" }),
      ],
    });

    const escolhidas = useIndicatorStore.getState().getGlobalCurrencies(["USD", "GBP"]);

    expect(escolhidas.map((m) => m.code)).toEqual(["USD", "GBP"]);
  });

  it("retrato de favorito não duplica quando o mesmo ativo é regravado", () => {
    const item = ind({ id: "f1", code: "PETR4", name: "Petrobras" });
    useIndicatorStore.getState().upsertFavoriteSnapshot(item);
    useIndicatorStore.getState().upsertFavoriteSnapshot({ ...item, buy: 40 });

    const retratos = useIndicatorStore.getState().favoriteSnapshots;
    expect(retratos).toHaveLength(1);
    expect(retratos[0].buy).toBe(40);
  });

  it("remover o retrato tira só o id pedido", () => {
    useIndicatorStore.getState().upsertFavoriteSnapshot(ind({ id: "f1", code: "A", name: "A" }));
    useIndicatorStore.getState().upsertFavoriteSnapshot(ind({ id: "f2", code: "B", name: "B" }));

    useIndicatorStore.getState().removeFavoriteSnapshot("f1");

    expect(useIndicatorStore.getState().favoriteSnapshots.map((s) => s.id)).toEqual(["f2"]);
  });
});
