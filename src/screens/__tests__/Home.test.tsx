import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Home from "../Home";
import { useAnalyticsStore } from "../../store/analyticsStore";
import { useAuthStore } from "../../store/authStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useIndicatorStore } from "../../store/indicatorStore";
import { useNewsStore } from "../../store/newsStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";
import { useReviewStore } from "../../store/reviewStore";
import { useUserStore } from "../../store/userStore";
import { useWalletStore } from "../../store/walletStore";
import { useWishStore } from "../../store/wishStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: { articles: [] } }) },
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => false,
    getState: () => ({ index: 0, routes: [{ name: "Principal" }] }),
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

const MES = {
  month: "2026-08",
  start: "2026-08-01",
  end: "2026-08-31",
  totalIncome: 5423.68,
  totalExpense: 6862.7,
  net: -1439.02,
  previous: {
    month: "2026-07",
    start: "2026-07-01",
    end: "2026-07-31",
    totalIncome: 5256.31,
    totalExpense: 4391.99,
    net: 864.32,
  },
  categories: [],
  pendingReviewCount: 0,
  caveats: [],
  lastTransactionDate: "2026-08-31",
};

function prepararStores() {
  useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
  useAnalyticsStore.setState({
    homeData: MES,
    isHomeLoading: false,
    months: ["2026-08"],
    fetchHomeMonthly: jest.fn().mockResolvedValue(undefined),
  } as never);
  useIndicatorStore.setState({
    indicators: [],
    loading: false,
    favoriteSnapshots: {},
    fetchIndicators: jest.fn().mockResolvedValue(undefined),
  } as never);
  useWalletStore.setState({
    transactions: [],
    fetchedAt: Date.now(),
    fetchTransactions: jest.fn().mockResolvedValue(undefined),
  } as never);
  useFavoritesStore.setState({ favorites: [] } as never);
  useReviewStore.setState({
    pendingCount: 0,
    fetchPendingCount: jest.fn().mockResolvedValue(undefined),
  } as never);
  useRecurrenceStore.setState({
    series: [],
    forecast: null,
    fetchSeries: jest.fn().mockResolvedValue(undefined),
  } as never);
  useWishStore.setState({
    committed: null,
    income: null,
    fetchCommitted: jest.fn().mockResolvedValue(undefined),
    fetchIncome: jest.fn().mockResolvedValue(undefined),
  } as never);
  usePreferencesStore.setState({
    hideBalance: false,
    potAnnouncementSeen: true,
    mealVoucherPromptDismissedFor: "always",
    cycleAnchorDay: 1,
    hasHydrated: true,
    sessionCount: 1,
  } as never);
  useUserStore.setState({ me: null } as never);
  usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  useNewsStore.getState().reset();
}

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Home />
    </SafeAreaProvider>,
  );

describe("Início", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prepararStores();
  });

  it("abre com o mês respondido", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("pede a CONTAGEM da revisão, nunca a fila inteira", async () => {
    const fetchPendingCount = jest.fn().mockResolvedValue(undefined);
    const fetchQueue = jest.fn().mockResolvedValue(undefined);
    useReviewStore.setState({
      pendingCount: 0,
      fetchPendingCount,
      fetchQueue,
    } as never);

    montar();

    // A Home escreve "N esperando você" e não desenha nenhuma linha: buscar a
    // fila agrupada custava 92 KB e 2,1 s a cada abertura
    await waitFor(() => expect(fetchPendingCount).toHaveBeenCalled());
    expect(fetchQueue).not.toHaveBeenCalled();
  });

  it("com revisão pendente, o bloco convida a revisar", async () => {
    useReviewStore.setState({
      pendingCount: 253,
      fetchPendingCount: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("253 transações esperando você")).toBeTruthy(),
    );
  });

  it("sem nada pendente, o bloco de revisão não ocupa espaço", async () => {
    const { queryByText } = montar();

    await waitFor(() => expect(queryByText(/esperando você/)).toBeNull());
  });

  it("busca o mês e as recorrências ao ganhar foco", async () => {
    const fetchHomeMonthly = jest.fn().mockResolvedValue(undefined);
    const fetchSeries = jest.fn().mockResolvedValue(undefined);
    useAnalyticsStore.setState({ fetchHomeMonthly } as never);
    useRecurrenceStore.setState({ fetchSeries } as never);

    montar();

    await waitFor(() => expect(fetchHomeMonthly).toHaveBeenCalled());
    expect(fetchSeries).toHaveBeenCalled();
  });

  it("com o olhinho fechado, o valor não aparece nem para o leitor de tela", async () => {
    usePreferencesStore.setState({ hideBalance: true } as never);

    const { queryByText } = montar();

    // Falar o número que a tela esconde seria furar a própria preferência
    await waitFor(() => expect(queryByText("R$ 5.423,68")).toBeNull());
  });
});
