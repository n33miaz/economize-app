import {
  toggleFavoriteWithSnapshot,
  useFavoritesStore,
} from "../favoritesStore";
import { useIndicatorStore } from "../indicatorStore";

import type { Indicator } from "../../services/api";

const ativo = (id: string, code: string, name: string): Indicator =>
  ({
    id,
    type: "stock",
    code,
    name,
    buy: 38.42,
    sell: null,
    variation: 1.2,
  }) as Indicator;

describe("favoritesStore", () => {
  beforeEach(() => {
    useFavoritesStore.setState({ favorites: [] });
    useIndicatorStore.setState({ favoriteSnapshots: [] });
  });

  it("marca e desmarca o mesmo id", () => {
    useFavoritesStore.getState().toggleFavorite("stock_PETR4");
    expect(useFavoritesStore.getState().isFavorite("stock_PETR4")).toBe(true);

    useFavoritesStore.getState().toggleFavorite("stock_PETR4");
    expect(useFavoritesStore.getState().isFavorite("stock_PETR4")).toBe(false);
  });

  it("marcar duas vezes o mesmo id não duplica a lista", () => {
    useFavoritesStore.setState({ favorites: ["stock_PETR4"] });

    useFavoritesStore.getState().toggleFavorite("stock_VALE3");

    expect(useFavoritesStore.getState().favorites).toEqual([
      "stock_PETR4",
      "stock_VALE3",
    ]);
  });

  it("desmarcar tira só o id pedido", () => {
    useFavoritesStore.setState({ favorites: ["a", "b", "c"] });

    useFavoritesStore.getState().toggleFavorite("b");

    expect(useFavoritesStore.getState().favorites).toEqual(["a", "c"]);
  });

  it("favoritar com o objeto em mãos guarda o RETRATO do ativo", () => {
    // Sem o retrato, um favorito vindo da busca remota acendia a estrela mas
    // ficava invisível na faixa do Mercado e no bloco da Home
    toggleFavoriteWithSnapshot(ativo("stock_XPTO3", "XPTO3", "XPTO ON"));

    expect(useFavoritesStore.getState().isFavorite("stock_XPTO3")).toBe(true);
    expect(useIndicatorStore.getState().favoriteSnapshots.map((s) => s.id))
      .toEqual(["stock_XPTO3"]);
  });

  it("desfavoritar descarta o retrato junto", () => {
    const item = ativo("stock_XPTO3", "XPTO3", "XPTO ON");
    toggleFavoriteWithSnapshot(item);

    toggleFavoriteWithSnapshot(item);

    expect(useFavoritesStore.getState().isFavorite("stock_XPTO3")).toBe(false);
    expect(useIndicatorStore.getState().favoriteSnapshots).toEqual([]);
  });

  it("o retrato de um ativo não atropela o de outro", () => {
    toggleFavoriteWithSnapshot(ativo("stock_PETR4", "PETR4", "Petrobras"));
    toggleFavoriteWithSnapshot(ativo("stock_VALE3", "VALE3", "Vale"));

    expect(useIndicatorStore.getState().favoriteSnapshots).toHaveLength(2);
    expect(useFavoritesStore.getState().favorites).toHaveLength(2);
  });
});
