import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import BalanceForecast from "../BalanceForecast";
import { useBankStore } from "../../store/bankStore";
import { usePlanStore } from "../../store/planStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";

// A linha do tempo (EC-226) busca os parcelamentos na entrada. Aqui ela
// devolve vazio: o que estes testes cobrem e a previsao, e a linha tem
// suite propria em CommitmentTimeline.test.tsx
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getInstallments: jest
    .fn()
    .mockResolvedValue({
      totalSeries: 0,
      openSeries: 0,
      remainingTotal: 0,
      series: [],
    }),
  // Os três cenários da escolha 9 precisam de gasto REAL passado, que a
  // previsão não tem. Sem este mock a chamada vinha `undefined` e o efeito
  // travava a suíte inteira; com zero de gasto, só o cenário "folgado"
  // aparece — que é o comportamento correto sem histórico
  getMonthlyAnalytics: jest.fn().mockResolvedValue({
    month: "2026-08",
    start: "2026-08-01",
    end: "2026-08-31",
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    previous: { totalIncome: 0, totalExpense: 0, net: 0 },
    categories: [],
    pendingReviewCount: 0,
  }),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({
      index: 1,
      routes: [{ name: "Main" }, { name: "Previsao" }],
    }),
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

const PREVISAO = {
  startingBalance: 1200,
  months: [
    {
      month: "2026-10",
      start: "2026-10-01",
      end: "2026-10-31",
      income: 3131.73,
      expense: 1481.73,
      net: 1650,
      endingBalance: 2850,
      items: [],
    },
  ],
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BalanceForecast />
    </SafeAreaProvider>,
  );

describe("Perspectiva de saldo", () => {
  beforeEach(() => {
    useBankStore.setState({
      transactions: [],
      fetchedAt: Date.now(),
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);
    useRecurrenceStore.setState({
      forecast: PREVISAO,
      isForecastLoading: false,
      hasLoadedForecastOnce: true,
      forecastError: null,
      series: [],
      fetchForecast: jest.fn().mockResolvedValue(undefined),
      fetchSeries: jest.fn().mockResolvedValue(undefined),
    } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("abre com a projeção carregada", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Perspectiva de saldo")).toBeTruthy());
  });

  it("sem projeção a tela não fica em branco", async () => {
    useRecurrenceStore.setState({
      forecast: null,
      hasLoadedForecastOnce: true,
    } as never);

    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText("Perspectiva de saldo")).toBeTruthy());
    // EC-231: o vazio é o pote, e o botão de volta continua existindo
    expect(getByText("Ainda não há o que projetar")).toBeTruthy();
    expect(getByLabelText("Voltar para recorrências")).toBeTruthy();
  });

  it("falha ao projetar se explica sem derrubar a tela", async () => {
    useRecurrenceStore.setState({
      forecast: null,
      hasLoadedForecastOnce: true,
      forecastError: "Falha ao calcular a previsão de saldo.",
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Perspectiva de saldo")).toBeTruthy());
  });

  it("pede a projeção ao abrir", async () => {
    const fetchForecast = jest.fn().mockResolvedValue(undefined);
    useRecurrenceStore.setState({
      forecast: null,
      hasLoadedForecastOnce: false,
      fetchForecast,
      series: [],
    } as never);

    montar();

    await waitFor(() => expect(fetchForecast).toHaveBeenCalled());
  });
});
