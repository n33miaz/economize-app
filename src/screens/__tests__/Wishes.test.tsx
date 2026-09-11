import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Wishes from "../Wishes";
import { useWishStore } from "../../store/wishStore";
import { usePlanStore } from "../../store/planStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Desejos" }] }),
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

const BASE_VAZIA = {
  baseline: null,
  wishes: [],
  income: null,
  committed: null,
  isLoading: false,
  hasLoadedOnce: true,
  isSaving: false,
  isIncomeLoading: false,
  hasLoadedIncomeOnce: true,
  isCommittedLoading: false,
  hasLoadedCommittedOnce: true,
  error: null,
  incomeError: null,
  committedError: null,
  fetch: jest.fn().mockResolvedValue(undefined),
  fetchIncome: jest.fn().mockResolvedValue(undefined),
  fetchCommitted: jest.fn().mockResolvedValue(undefined),
};

/** Retrato financeiro que a tela usa para traduzir preço em horas de vida. */
const BASELINE = {
  workIncome: 2628,
  hourlyRate: 14.93,
  hoursPerMonth: 176,
  monthlyLeftover: 420.5,
  monthlyExpense: 2207.5,
  cyclesConsidered: 3,
  gaps: [],
};

const desejo = (id: string, nome: string, valor: number) =>
  ({
    id,
    name: nome,
    targetAmount: valor,
    savedAmount: 0,
    categoryId: null,
    status: "WISH",
    targetDate: null,
    note: null,
    purchasedAt: null,
    purchaseTransactionId: null,
    // A projeção é o coração da tela: é ela que traduz preço em horas de vida
    projection: {
      remaining: valor,
      hoursOfWork: 160.8,
      workDays: 20.1,
      workMonths: 0.9,
      workYears: null,
      monthsToAfford: 6,
      estimatedDate: "2027-03-01",
      installments: null,
      maxInstallment: null,
    },
  }) as never;

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Wishes />
    </SafeAreaProvider>,
  );

describe("Desejos", () => {
  beforeEach(() => {
    useWishStore.setState(BASE_VAZIA as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("sem desejo nenhum a tela abre e convida a criar", async () => {
    const { getByText, getByLabelText } = montar();

    await waitFor(() => expect(getByText("Desejos")).toBeTruthy());
    // EC-231: o vazio é contado pelo pote, numa frase só para quem ouve
    expect(
      getByLabelText(/^Nenhum desejo ainda\. Cadastre algo que você quer comprar/),
    ).toBeTruthy();
  });

  it("mostra o desejo cadastrado", async () => {
    useWishStore.setState({
      ...BASE_VAZIA,
      baseline: BASELINE,
      wishes: [desejo("w1", "Bicicleta", 2400)],
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Bicicleta")).toBeTruthy());
  });

  it("busca a lista na primeira abertura", async () => {
    const fetch = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({ ...BASE_VAZIA, hasLoadedOnce: false, fetch } as never);

    montar();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("já carregado, voltar à tela não repete a busca", async () => {
    // `hasLoadedOnce` é o que evita uma requisição por foco: a lista de
    // desejos muda quando o usuário mexe nela, não quando ele troca de aba
    const fetch = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({ ...BASE_VAZIA, hasLoadedOnce: true, fetch } as never);

    montar();

    await waitFor(() => expect(fetch).not.toHaveBeenCalled());
  });

  it("no Plus o slot de anúncio não ocupa espaço", async () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Desejos")).toBeTruthy());
    expect(queryByText("Publicidade")).toBeNull();
  });
});
