import { useIndicatorStore } from "../indicatorStore";
import { DEFAULT_ASSET_FILTERS } from "../../utils/indicatorList";
import type { Indicator } from "../../services/api";

const make = (
  id: string,
  code: string,
  name: string,
  type: Indicator["type"] = "currency",
): Indicator => ({
  id,
  type,
  code,
  name,
  buy: 1,
  sell: null,
  variation: 0,
});

describe("indicatorStore — filtros por aba", () => {
  beforeEach(() => {
    useIndicatorStore.setState({
      indicators: [],
      filters: {
        currencies: { ...DEFAULT_ASSET_FILTERS },
        indexes: { ...DEFAULT_ASSET_FILTERS },
      },
    });
  });

  it("guarda a ordenação de cada aba sem vazar para a outra", () => {
    useIndicatorStore.getState().setFilters("currencies", { sort: "gainers" });

    const { filters } = useIndicatorStore.getState();
    expect(filters.currencies.sort).toBe("gainers");
    expect(filters.indexes.sort).toBe("default");
  });

  it("resetFilters restaura só a aba pedida", () => {
    useIndicatorStore.getState().setFilters("currencies", {
      sort: "name-asc",
      includeTourism: true,
    });
    useIndicatorStore.getState().setFilters("indexes", { sort: "losers" });

    useIndicatorStore.getState().resetFilters("currencies");

    const { filters } = useIndicatorStore.getState();
    expect(filters.currencies).toEqual(DEFAULT_ASSET_FILTERS);
    expect(filters.indexes.sort).toBe("losers");
  });

  it("getCurrencies esconde turismo por padrão e o inclui com o toggle", () => {
    useIndicatorStore.setState({
      indicators: [
        make("usd-1", "USD", "Dólar Americano/Real"),
        make("usd-turismo", "USD", "Dólar Turismo/Real"),
        make("ibov", "IBOV", "IBOVESPA", "index"),
      ],
    });

    const before = useIndicatorStore.getState().getCurrencies();
    expect(before.map((i) => i.id)).toEqual(["usd-1"]);

    useIndicatorStore
      .getState()
      .setFilters("currencies", { includeTourism: true });

    // a variante turismo repete o code da comercial: o dedupe não pode engoli-la
    const after = useIndicatorStore.getState().getCurrencies();
    expect(after.map((i) => i.id)).toEqual(["usd-1", "usd-turismo"]);
  });

  it("getCurrencies continua deduplicando o mesmo ativo repetido pela API", () => {
    useIndicatorStore.setState({
      indicators: [
        make("usd-1", "USD", "Dólar Americano/Real"),
        make("usd-2", "USD", "Dólar Americano/Real"),
      ],
    });

    const result = useIndicatorStore.getState().getCurrencies();
    expect(result.map((i) => i.id)).toEqual(["usd-1"]);
  });
});
