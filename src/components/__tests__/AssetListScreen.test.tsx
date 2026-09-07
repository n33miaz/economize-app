import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import AssetListScreen from "../AssetListScreen";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useIndicatorStore } from "../../store/indicatorStore";

import type { Indicator } from "../../services/api";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => false,
    getState: () => ({ index: 0, routes: [{ name: "Moedas" }] }),
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

const moeda = (code: string, nome: string, valor: number | null): Indicator =>
  ({
    id: `currency_${code}`,
    type: "currency",
    code,
    name: nome,
    buy: valor,
    sell: null,
    variation: 0.42,
    points: null,
  }) as unknown as Indicator;

const FILTROS = { sort: "name", onlyFavorites: false, query: "" };

const montar = (dados: Indicator[]) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <AssetListScreen
        data={dados}
        emptyMessage="Nenhuma moeda encontrada."
        symbol="R$"
        tab="currencies"
      />
    </SafeAreaProvider>,
  );

describe("Lista de ativos", () => {
  beforeEach(() => {
    useIndicatorStore.setState({
      loading: false,
      error: null,
      indicators: [],
      favoriteSnapshots: [],
      filters: { currencies: FILTROS, indexes: FILTROS, crypto: FILTROS },
      fetchIndicators: jest.fn().mockResolvedValue(undefined),
    } as never);
    useFavoritesStore.setState({
      favorites: [],
      isFavorite: () => false,
      toggleFavoriteWithSnapshot: jest.fn(),
    } as never);
  });

  it("lista o ativo recebido", async () => {
    const { getByText } = montar([moeda("USD", "Dólar Americano", 5.12)]);

    await waitFor(() => expect(getByText("Dólar Americano")).toBeTruthy());
  });

  it("preço nulo não vira R$ 0,00", async () => {
    // Achado do EC-151 no extrato real: o servidor manda `null` e o app
    // testava `!== undefined`; o null passava e a lista mostrava zero com a
    // variação certa ao lado, que é o pior tipo de erro — parece certo
    const { queryByText, getByText } = montar([moeda("EUR", "Euro", null)]);

    await waitFor(() => expect(getByText("Euro")).toBeTruthy());
    expect(queryByText("R$ 0,00")).toBeNull();
  });

  it("lista vazia mostra a mensagem que a aba definiu", async () => {
    const { getByText } = montar([]);

    await waitFor(() =>
      expect(getByText("Nenhuma moeda encontrada.")).toBeTruthy(),
    );
  });

  it("falha ao carregar oferece tentar de novo", async () => {
    useIndicatorStore.setState({
      error: "Falha ao carregar os indicadores.",
    } as never);

    const { getByText } = montar([]);

    await waitFor(() => expect(getByText("Tentar de novo")).toBeTruthy());
  });
});
