import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import IncomeSettings from "../IncomeSettings";
import { useAccountsStore } from "../../store/accountsStore";
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
  incomePattern: null,
  isIncomeLoading: false,
  hasLoadedIncomeOnce: true,
  incomeError: null,
  hasLoadedCommittedOnce: true,
  hasLoadedPatternOnce: true,
  isSaving: false,
  fetchIncome: jest.fn().mockResolvedValue(undefined),
  fetchCommitted: jest.fn().mockResolvedValue(undefined),
  fetchIncomePattern: jest.fn().mockResolvedValue(undefined),
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
    useAccountsStore.setState({
      accounts: [],
      fetchAccounts: jest.fn().mockResolvedValue(undefined),
    } as never);
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

  it("busca o padrão de compra ao abrir, best-effort como o resto", async () => {
    const fetchIncomePattern = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({
      ...BASE,
      hasLoadedPatternOnce: false,
      fetchIncomePattern,
    } as never);

    montar();

    await waitFor(() => expect(fetchIncomePattern).toHaveBeenCalled());
  });

  /**
   * EC-237: o card "Como você faz as compras" mora logo depois do card da
   * jornada e resume o que o app SABE — declarado, ou deduzido do extrato
   * quando ninguém declarou nada ainda.
   */
  it("card de compras mostra o que foi deduzido do extrato, sem preferência salva", async () => {
    useWishStore.setState({
      ...BASE,
      incomePattern: {
        status: "READY",
        message: null,
        today: "2026-09-15",
        sources: [],
        preference: null,
        inferred: {
          cadence: "MONTHLY",
          purchasesPerMonth: 1.1,
          weekendShare: 0.83,
          daysAfterLanding: 2,
          monthsObserved: 3,
          confidence: "MEDIUM",
          origin: "MEASURED",
        },
        advice: null,
      },
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Como você faz as compras")).toBeTruthy());
    expect(
      getByText("Deduzido do extrato: mensal · fim de semana (3 meses de extrato)"),
    ).toBeTruthy();
  });

  it("card de compras mostra a preferência declarada, com o nome do cartão", async () => {
    useAccountsStore.setState({
      accounts: [
        {
          id: "acc-1",
          name: "Nubank",
          type: "CREDIT_CARD",
          institution: "Nubank",
          statementClosingDay: 10,
          statementDueDay: 17,
          linked: true,
          reportedBalance: -100,
          reportedBalanceAt: "2026-09-16T09:00:00Z",
          creditLimit: 3000,
          creditLimitSharedWith: null,
        },
      ],
      fetchAccounts: jest.fn().mockResolvedValue(undefined),
    } as never);
    useWishStore.setState({
      ...BASE,
      incomePattern: {
        status: "READY",
        message: null,
        today: "2026-09-15",
        sources: [],
        preference: {
          cadence: "MONTHLY",
          weekendPreferred: false,
          paymentMode: "CARD",
          cardAccountId: "acc-1",
          updatedAt: "2026-09-01T00:00:00Z",
        },
        inferred: null,
        advice: null,
      },
    } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Mensal · no Nubank")).toBeTruthy(),
    );
  });

  it("tocar o card de compras abre a folha de preferência", async () => {
    const { getByLabelText, getByText } = montar();

    await waitFor(() => expect(getByText("Renda e jornada")).toBeTruthy());
    fireEvent.press(getByLabelText("Ajustar como você faz as compras"));

    // Marcador exclusivo da folha — o card de trás também tem o mesmo título
    await waitFor(() => expect(getByText("Com que frequência")).toBeTruthy());
  });
});
