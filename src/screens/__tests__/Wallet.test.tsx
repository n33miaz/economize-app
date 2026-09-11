import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Wallet from "../Wallet";
import { useWalletStore } from "../../store/walletStore";
import { useIndicatorStore } from "../../store/indicatorStore";
import { usePlanStore } from "../../store/planStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Carteira" }] }),
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

const operacao = (id: string, ativo: string, qtd: number, preco: number) => ({
  id,
  assetCode: ativo,
  type: "BUY",
  quantity: qtd,
  priceAtTransaction: preco,
  transactionDate: "2026-09-01T12:00:00Z",
});

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Wallet />
    </SafeAreaProvider>,
  );

describe("Carteira", () => {
  beforeEach(() => {
    useWalletStore.setState({
      transactions: [operacao("t1", "PETR4", 100, 38.42)],
      isLoading: false,
      error: null,
      fetchedAt: Date.now(),
      fetchTransactions: jest.fn().mockResolvedValue(undefined),
    } as never);
    useIndicatorStore.setState({ indicators: [] } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("mostra o ativo que está na carteira", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("PETR4")).toBeTruthy());
  });

  it("carteira vazia não vira tela quebrada", async () => {
    useWalletStore.setState({ transactions: [] } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Nenhuma transação registrada.")).toBeTruthy(),
    );
    // EC-231: a alocação vazia é o pote, não um glifo de pizza
    expect(getByText("Sem ativos ainda")).toBeTruthy();
    expect(getByText("Adicione ativos para visualizar sua alocação.")).toBeTruthy();
  });

  it("falha de leitura se explica na própria tela", async () => {
    // A política nova: GET que falha não vira toast global — quem chamou
    // mostra o ErrorState com "tentar de novo" ao lado
    useWalletStore.setState({
      transactions: [],
      error: "Erro ao carregar carteira",
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Tentar de novo")).toBeTruthy());
  });

  it("busca as operações ao abrir", async () => {
    const fetchTransactions = jest.fn().mockResolvedValue(undefined);
    useWalletStore.setState({ fetchTransactions } as never);

    montar();

    await waitFor(() => expect(fetchTransactions).toHaveBeenCalled());
  });
});
