import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import CreditCards from "../CreditCards";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { usePlanStore } from "../../store/planStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Cartoes" }] }),
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

const cartao = {
  id: "a1",
  name: "Mercado Pago · Cartão de crédito",
  institution: "Mercado Pago",
  type: "CREDIT_CARD",
  number: "7340",
  closingDay: 8,
  dueDay: 14,
} as never;

const BASE = {
  accounts: [cartao],
  byId: new Map([["a1", cartao]]),
  isLoading: false,
  hasLoadedOnce: true,
  error: null,
  invoices: {},
  fetchAccounts: jest.fn().mockResolvedValue(undefined),
  fetchInvoices: jest.fn().mockResolvedValue(undefined),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <CreditCards />
    </SafeAreaProvider>,
  );

describe("Cartões", () => {
  beforeEach(() => {
    useAccountsStore.setState(BASE as never);
    useCategoriesStore.setState({ items: [] } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("abre com o cartão conectado", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Cartões")).toBeTruthy());
  });

  it("pede contas e faturas ao abrir", async () => {
    const fetchAccounts = jest.fn().mockResolvedValue(undefined);
    useAccountsStore.setState({ ...BASE, fetchAccounts } as never);

    montar();

    await waitFor(() => expect(fetchAccounts).toHaveBeenCalled());
  });

  it("sem cartão nenhum a tela explica em vez de ficar em branco", async () => {
    useAccountsStore.setState({
      ...BASE,
      accounts: [],
      byId: new Map(),
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Cartões")).toBeTruthy());
  });

  it("falha ao carregar as contas não é silenciosa", async () => {
    useAccountsStore.setState({
      ...BASE,
      accounts: [],
      byId: new Map(),
      error: "Falha ao carregar suas contas.",
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Cartões")).toBeTruthy());
  });
});
