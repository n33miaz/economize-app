import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Recurrences from "../Recurrences";
import { useCategoriesStore } from "../../store/categoriesStore";
import { usePlanStore } from "../../store/planStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  // O caça-assinaturas (EC-203) é leitura adicional: a tela tem de montar
  // igual com ele recusando, e é isso que o mock rejeitado prova
  getSubscriptions: jest.fn().mockRejectedValue(new Error("sem rede")),
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Recorrencias" }] }),
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

const serie = (id: string, nome: string) =>
  ({
    id,
    merchantKey: nome.toLowerCase(),
    displayName: nome,
    categoryId: null,
    flow: "EXPENSE",
    cadence: "MONTHLY",
    anchorDay: 5,
    dayTolerance: 3,
    amountType: "FIXED",
    expectedAmount: -129.9,
    occurrences: 8,
    firstSeenAt: "2026-01-05T00:00:00Z",
    lastSeenAt: "2026-08-05T00:00:00Z",
    nextExpectedDate: "2026-09-05",
    active: true,
    dismissedAt: null,
  }) as never;

const BASE = {
  series: [],
  dismissed: [],
  monthState: {},
  forecast: null,
  isLoading: false,
  hasLoadedOnce: true,
  isLoadingDismissed: false,
  isDetecting: false,
  isSaving: false,
  isForecastLoading: false,
  hasLoadedForecastOnce: true,
  error: null,
  dismissedError: null,
  forecastError: null,
  fetchSeries: jest.fn().mockResolvedValue(undefined),
  fetchDismissed: jest.fn().mockResolvedValue(undefined),
  fetchMonthState: jest.fn().mockResolvedValue(undefined),
  runDetection: jest.fn().mockResolvedValue({ ok: true, message: "" }),
  byId: () => undefined,
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Recurrences />
    </SafeAreaProvider>,
  );

describe("Recorrências", () => {
  beforeEach(() => {
    useRecurrenceStore.setState(BASE as never);
    useCategoriesStore.setState({
      items: [],
      byId: () => undefined,
    } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("lista a série detectada", async () => {
    useRecurrenceStore.setState({
      ...BASE,
      series: [serie("s1", "Netflix")],
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Netflix")).toBeTruthy());
  });

  it("sem série nenhuma a tela monta sem quebrar", async () => {
    // É aba superior dentro de Finanças: não tem cabeçalho próprio, então o
    // que se verifica é que o render inteiro passa com a lista vazia
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("falha ao carregar se explica na tela, sem derrubá-la", async () => {
    useRecurrenceStore.setState({
      ...BASE,
      series: [],
      error: "Falha ao carregar suas recorrências.",
    } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Falha ao carregar suas recorrências.")).toBeTruthy(),
    );
  });

  it("busca as séries ao ganhar foco", async () => {
    const fetchSeries = jest.fn().mockResolvedValue(undefined);
    useRecurrenceStore.setState({ ...BASE, fetchSeries } as never);

    montar();

    await waitFor(() => expect(fetchSeries).toHaveBeenCalled());
  });
});
