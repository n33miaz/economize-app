import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import IncomeSettings from "../IncomeSettings";
import { useWishStore } from "../../store/wishStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Renda" }] }),
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

const RENDA = {
  sources: [
    {
      id: "i1",
      label: "Salário",
      kind: "SALARY",
      amount: 2628,
      anchorDay: 5,
      active: true,
      confirmedAt: "2026-08-05T00:00:00Z",
      seriesId: null,
    },
  ],
  workProfile: { hoursPerWeek: 44, daysPerWeek: 5 },
  // `suggestions` é o que o motor propõe a partir das séries recorrentes;
  // a tela lê `.length` direto, então ausente quebraria o render
  suggestions: [],
};

const BASE = {
  income: RENDA,
  committed: null,
  isIncomeLoading: false,
  hasLoadedIncomeOnce: true,
  incomeError: null,
  hasLoadedCommittedOnce: true,
  isSaving: false,
  fetchIncome: jest.fn().mockResolvedValue(undefined),
  fetchCommitted: jest.fn().mockResolvedValue(undefined),
  addIncome: jest.fn(),
  editIncome: jest.fn(),
  removeIncome: jest.fn(),
  acceptSuggestion: jest.fn(),
  saveJourney: jest.fn(),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <IncomeSettings />
    </SafeAreaProvider>,
  );

describe("Renda e jornada", () => {
  beforeEach(() => {
    useWishStore.setState(BASE as never);
  });

  it("abre com a fonte de renda cadastrada", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Renda e jornada")).toBeTruthy());
  });

  it("sem renda cadastrada a tela convida a cadastrar", async () => {
    useWishStore.setState({
      ...BASE,
      income: { sources: [], workProfile: null, suggestions: [] },
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Renda e jornada")).toBeTruthy());
  });

  it("busca a renda ao abrir", async () => {
    const fetchIncome = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({
      ...BASE,
      hasLoadedIncomeOnce: false,
      fetchIncome,
    } as never);

    montar();

    await waitFor(() => expect(fetchIncome).toHaveBeenCalled());
  });
});
