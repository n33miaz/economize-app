import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import BalanceForecast from "../BalanceForecast";
import { useBankStore } from "../../store/bankStore";
import { usePlanStore } from "../../store/planStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";
import { useWishStore } from "../../store/wishStore";
import type { IncomePattern } from "../../services/api";

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
  // Melhor dia de compra (EC-237): o padrão vem do store, não daqui — mas o
  // jest.mock precisa existir para o servidor "antigo" (404) não sujar o
  // console quando o store real chama a função de verdade
  getIncomePattern: jest.fn().mockResolvedValue(null),
  savePurchasePreference: jest.fn(),
  clearPurchasePreference: jest.fn(),
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

const PADRAO_READY: IncomePattern = {
  status: "READY",
  message: null,
  today: "2026-09-15",
  sources: [],
  preference: null,
  inferred: null,
  advice: {
    cadence: "MONTHLY",
    cadenceOrigin: "MEASURED",
    paymentMode: "CASH",
    bestDay: "2026-10-03",
    bestDayWeekday: "SATURDAY",
    fundingSource: null,
    fundingDate: null,
    mustLastUntil: "2026-11-09",
    daysToCover: 37,
    card: null,
    weeklyDay: null,
    nextDates: [],
    confidence: "MEDIUM",
    explanation: { headline: "Melhor dia para as compras: sáb 03/10", lines: [] },
    basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" },
  },
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
    useWishStore.setState({
      incomePattern: null,
      fetchIncomePattern: jest.fn().mockResolvedValue(undefined),
    } as never);
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

  /**
   * EC-237: o padrão de renda existe mesmo sem série de despesa nenhuma —
   * por isso o card fica FORA do bloco `!hasProjection` e aparece assim que
   * o store tem alguma coisa (qualquer status que não seja "sem renda
   * nenhuma cadastrada").
   */
  it("busca o melhor dia de compra ao abrir", async () => {
    const fetchIncomePattern = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({ incomePattern: null, fetchIncomePattern } as never);

    montar();

    await waitFor(() => expect(fetchIncomePattern).toHaveBeenCalled());
  });

  it("mostra o card do melhor dia de compra quando o padrão está pronto", async () => {
    useWishStore.setState({
      incomePattern: PADRAO_READY,
      fetchIncomePattern: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Melhor dia para as compras")).toBeTruthy(),
    );
    expect(getByText("sáb 03/10")).toBeTruthy();
  });

  it("sem renda nenhuma cadastrada (NO_INCOME), o card não aparece nesta tela", async () => {
    useWishStore.setState({
      incomePattern: { ...PADRAO_READY, status: "NO_INCOME", advice: null },
      fetchIncomePattern: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Perspectiva de saldo")).toBeTruthy());
    expect(queryByText("Melhor dia para as compras")).toBeNull();
  });

  it("sem padrão nenhum no store (servidor antigo ou ainda não buscou), o card não aparece", async () => {
    useWishStore.setState({
      incomePattern: null,
      fetchIncomePattern: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Perspectiva de saldo")).toBeTruthy());
    expect(queryByText("Melhor dia para as compras")).toBeNull();
  });
});
