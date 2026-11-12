import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Wallet from "../Wallet";
import { useWalletStore } from "../../store/walletStore";
import { useIndicatorStore } from "../../store/indicatorStore";
import { usePlanStore } from "../../store/planStore";
import { useToastStore } from "../../store/toastStore";
import { useConfirmStore } from "../../store/confirmStore";

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
    useToastStore.setState({ visible: false, message: "", lastMessage: "" } as never);
    useConfirmStore.setState({ request: null } as never);
  });

  it("mostra o ativo que está na carteira", async () => {
    const { getAllByText } = montar();

    // a sigla aparece na linha e na legenda da alocação
    await waitFor(() => expect(getAllByText("PETR4").length).toBeGreaterThan(0));
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

  // Antes valia 0: saldo R$ 0,00 e o valor inteiro como prejuízo em vermelho
  it("ativo sem cotação vale o preço pago e diz \"sem cotação\"", async () => {
    useWalletStore.setState({
      transactions: [operacao("t1", "PETR4", 0.5, 1000)],
    } as never);

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("sem cotação")).toBeTruthy());
    // quantidade em pt-BR, e o valor é o custo, sem prejuízo inventado
    expect(getByText("0,5 PETR4")).toBeTruthy();
    expect(queryByText(/^-R\$/)).toBeNull();
  });

  // Abre e preenche fora do `act` assíncrono: dentro dele o React só
  // re-renderiza no fim, e a folha ainda não existiria para ser preenchida
  const preencher = async (
    tela: ReturnType<typeof montar>,
    quantidade: string,
    preco: string,
  ) => {
    fireEvent.press(tela.getByLabelText("Adicionar transação"));
    await waitFor(() => expect(tela.getByLabelText("Quantidade")).toBeTruthy());
    fireEvent.changeText(tela.getByLabelText("Quantidade"), quantidade);
    fireEvent.changeText(
      tela.getByLabelText("Preço pago unitário em reais"),
      preco,
    );
  };

  it("lê \"1.234,56\" como mil e tanto, não como 1,234", async () => {
    const addTransaction = jest.fn().mockResolvedValue(undefined);
    useWalletStore.setState({ addTransaction } as never);

    const tela = montar();
    await preencher(tela, "2.500", "1.234,56");
    await act(async () => {
      fireEvent.press(tela.getByLabelText("Salvar investimento"));
    });

    expect(addTransaction).toHaveBeenCalledWith(
      expect.objectContaining({ quantity: 2500, priceAtTransaction: 1234.56 }),
    );
  });

  it("falha ao salvar avisa e mantém o que foi digitado", async () => {
    const addTransaction = jest.fn().mockRejectedValue(new Error("rede"));
    useWalletStore.setState({ addTransaction } as never);

    const tela = montar();
    await preencher(tela, "1", "10");
    await act(async () => {
      fireEvent.press(tela.getByLabelText("Salvar investimento"));
    });

    await waitFor(() =>
      expect(useToastStore.getState().message).toBe(
        "Não foi possível salvar a transação.",
      ),
    );
    expect(useToastStore.getState().type).toBe("error");
    // a folha não limpou: dá para tentar de novo sem redigitar
    expect(tela.getByLabelText("Quantidade").props.value).toBe("1");
  });

  it("dois toques no salvar gravam uma vez só", async () => {
    let concluir: () => void = () => {};
    const addTransaction = jest.fn(
      () => new Promise<void>((resolve) => (concluir = resolve)),
    );
    useWalletStore.setState({ addTransaction } as never);

    const tela = montar();
    await preencher(tela, "1", "10");
    await act(async () => {
      fireEvent.press(tela.getByLabelText("Salvar investimento"));
      fireEvent.press(tela.getByLabelText("Salvar investimento"));
    });
    expect(addTransaction).toHaveBeenCalledTimes(1);
    await act(async () => concluir());
  });

  it("falha ao excluir aparece em toast", async () => {
    const removeTransaction = jest.fn().mockRejectedValue(new Error("rede"));
    useWalletStore.setState({ removeTransaction } as never);

    const tela = montar();
    await waitFor(() =>
      expect(tela.getByLabelText("Excluir transação de PETR4")).toBeTruthy(),
    );
    fireEvent.press(tela.getByLabelText("Excluir transação de PETR4"));
    await act(async () => {
      await useConfirmStore.getState().request!.onConfirm();
    });

    expect(useToastStore.getState().message).toBe(
      "Não foi possível excluir a transação.",
    );
  });
});
