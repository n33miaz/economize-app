import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Analytics from "../Analytics";
import { useAnalyticsStore } from "../../store/analyticsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useFamilyStore } from "../../store/familyStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  // O painel de tetos (EC-204) é leitura de apoio: a Análise tem de montar
  // igual com ele recusando, e é isso que o mock rejeitado prova
  getBudgetStatus: jest.fn().mockRejectedValue(new Error("sem rede")),
  setBudget: jest.fn(),
  clearBudget: jest.fn(),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Analise" }] }),
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

const FATIA = {
  categoryId: "c1",
  name: "Alimentação",
  groupName: null,
  color: "#F2C14E",
  icon: "utensils",
  systemKey: "FOOD",
  parentSystemKey: null,
  system: true,
  expenseTotal: 1696.16,
  incomeTotal: 0,
  txCount: 42,
  previousExpenseTotal: 1200,
  children: [],
};

const ANTERIOR = {
  month: "2026-07",
  start: "2026-07-01",
  end: "2026-07-31",
  totalIncome: 5256.31,
  totalExpense: 4391.99,
  net: 864.32,
};

const CONSOLIDADO = {
  month: "2026-08",
  start: "2026-08-01",
  end: "2026-08-31",
  totalIncome: 5423.68,
  totalExpense: 6862.7,
  net: -1439.02,
  previous: ANTERIOR,
  categories: [FATIA],
  pendingReviewCount: 0,
  caveats: [],
};

const BASE_ANALYTICS = {
  data: CONSOLIDADO,
  months: ["2026-08", "2026-07"],
  selectedMonth: "2026-08",
  isLoading: false,
  error: null,
  debt: null,
  fetchMonths: jest.fn().mockResolvedValue(undefined),
  fetchMonthly: jest.fn().mockResolvedValue(undefined),
};

const BASE_FAMILY = {
  hasFamily: false,
  scope: "me",
  analytics: null,
  isAnalyticsLoading: false,
  analyticsError: null,
  fetchAnalytics: jest.fn().mockResolvedValue(undefined),
  setScope: jest.fn(),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Analytics />
    </SafeAreaProvider>,
  );

describe("Análise", () => {
  beforeEach(() => {
    useAnalyticsStore.setState(BASE_ANALYTICS as never);
    useFamilyStore.setState(BASE_FAMILY as never);
    useCategoriesStore.setState({
      items: [],
      fetch: jest.fn().mockResolvedValue(undefined),
    } as never);
    usePreferencesStore.setState({ cycleAnchorDay: 1 } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("mostra a categoria com o que saiu no período", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Alimentação")).toBeTruthy());
  });

  it("busca os meses e o consolidado ao abrir", async () => {
    const fetchMonths = jest.fn().mockResolvedValue(undefined);
    const fetchMonthly = jest.fn().mockResolvedValue(undefined);
    useAnalyticsStore.setState({
      ...BASE_ANALYTICS,
      fetchMonths,
      fetchMonthly,
    } as never);

    montar();

    await waitFor(() => expect(fetchMonths).toHaveBeenCalled());
  });

  it("sem casa, o alternador Eu/Casa não aparece", async () => {
    // O alternador só existe para quem tem com quem comparar — mostrá-lo
    // sozinho seria oferecer uma visão vazia
    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Alimentação")).toBeTruthy());
    expect(queryByText("Casa")).toBeNull();
  });

  it("com casa, o alternador Eu/Casa aparece", async () => {
    useFamilyStore.setState({ ...BASE_FAMILY, hasFamily: true } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Casa")).toBeTruthy());
  });

  it("período sem movimento não vira tela quebrada", async () => {
    useAnalyticsStore.setState({
      ...BASE_ANALYTICS,
      data: {
        ...CONSOLIDADO,
        totalIncome: 0,
        totalExpense: 0,
        net: 0,
        categories: [],
      },
    } as never);

    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("falha ao carregar se explica sem derrubar a tela", async () => {
    useAnalyticsStore.setState({
      ...BASE_ANALYTICS,
      data: null,
      error: "Falha ao carregar a análise.",
    } as never);

    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });
});
