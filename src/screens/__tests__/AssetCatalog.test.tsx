import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AssetCatalog from "../AssetCatalog";
import { useCatalogStore } from "../../store/catalogStore";
import { useFavoritesStore } from "../../store/favoritesStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Catalogo" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const ITEM = {
  id: "stock_PETR4",
  type: "stock",
  code: "PETR4",
  name: "Petrobras PN",
  buy: 38.42,
  sell: null,
  variation: 1.24,
  points: null,
  segment: "acoes",
  quoteStatus: "LIVE",
};

const BASE = {
  items: [ITEM],
  page: {
    limit: 20,
    returned: 1,
    hasMore: false,
    nextCursor: null,
    totalMatched: 1,
    catalogVersion: "v1",
  },
  filters: { segment: "acoes", q: "", sort: "trending" },
  isLoading: false,
  isLoadingMore: false,
  error: null,
  setFilters: jest.fn(),
  fetch: jest.fn().mockResolvedValue(undefined),
  loadMore: jest.fn().mockResolvedValue(undefined),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AssetCatalog />
    </SafeAreaProvider>,
  );

describe("Catálogo de ativos", () => {
  beforeEach(() => {
    useCatalogStore.setState(BASE as never);
    useFavoritesStore.setState({
      favorites: [],
      isFavorite: () => false,
      toggleFavoriteWithSnapshot: jest.fn(),
    } as never);
  });

  it("lista o ativo que veio da página", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Petrobras PN")).toBeTruthy());
  });

  it("catálogo vazio não vira tela quebrada", async () => {
    useCatalogStore.setState({ ...BASE, items: [] } as never);

    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("falha ao carregar não some com a tela", async () => {
    useCatalogStore.setState({
      ...BASE,
      items: [],
      error: "Falha ao carregar o catálogo.",
    } as never);

    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });
});
