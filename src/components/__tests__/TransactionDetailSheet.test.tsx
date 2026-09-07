import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import TransactionDetailSheet from "../TransactionDetailSheet";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useFamilyStore } from "../../store/familyStore";
import {
  setFamilyTransfer,
  setInternalTransfer,
  setTransactionIgnored,
} from "../../services/api";

import type { BankTransaction } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  renameTransaction: jest.fn(),
  setInternalTransfer: jest.fn(),
  setFamilyTransfer: jest.fn(),
  setTransactionIgnored: jest.fn(),
}));

const marcarPropria = setInternalTransfer as jest.MockedFunction<
  typeof setInternalTransfer
>;
const marcarCasa = setFamilyTransfer as jest.MockedFunction<
  typeof setFamilyTransfer
>;
const marcarIgnorada = setTransactionIgnored as jest.MockedFunction<
  typeof setTransactionIgnored
>;

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 0, routes: [{ name: "Extrato" }] }),
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

const LANCAMENTO = {
  id: "t1",
  transactionId: "ext-t1",
  type: "DEBIT",
  amount: -194.99,
  description: "SUPERMERCADO SERO",
  originalDescription: "Pagamento com QR Pix SUPERMERCADOS SEROPEDICA LTDA",
  date: "2026-08-01T12:00:00Z",
  categoryId: null,
  category: null,
  accountId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: "USER",
  confidence: null,
  internalTransfer: false,
  ignored: false,
  familyTransfer: false,
} as unknown as BankTransaction;

const montar = (visivel = true, onUpdated = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <TransactionDetailSheet
        transaction={LANCAMENTO}
        visible={visivel}
        onClose={jest.fn()}
        onUpdated={onUpdated}
      />
    </SafeAreaProvider>,
  );

describe("Detalhe da transação", () => {
  beforeEach(() => {
    useCategoriesStore.setState({
      items: [],
      byId: () => undefined,
    } as never);
    useAccountsStore.setState({
      accounts: [],
      byId: new Map(),
    } as never);
    useFamilyStore.setState({ hasFamily: false } as never);
    marcarPropria.mockReset();
    marcarCasa.mockReset();
    marcarIgnorada.mockReset();
  });

  it("mostra a descrição do lançamento", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("SUPERMERCADO SERO")).toBeTruthy());
  });

  it("fechada, não desenha o conteúdo", async () => {
    const { queryByText } = montar(false);

    await waitFor(() => expect(queryByText("SUPERMERCADO SERO")).toBeNull());
  });

  it("marcar como dinheiro meu grava e devolve a linha à tela", async () => {
    const onUpdated = jest.fn();
    marcarPropria.mockResolvedValue({
      ...LANCAMENTO,
      internalTransfer: true,
    } as BankTransaction);
    const { getByLabelText } = montar(true, onUpdated);

    fireEvent(
      await waitFor(() => getByLabelText("É dinheiro meu trocando de bolso")),
      "valueChange",
      true,
    );

    await waitFor(() => expect(marcarPropria).toHaveBeenCalledWith("t1", true));
    expect(onUpdated).toHaveBeenCalled();
  });

  it("sem casa, o interruptor da casa não existe", async () => {
    const { queryByLabelText } = montar();

    // um controle sem efeito é pior que controle nenhum: sem família a marca
    // não muda soma alguma
    await waitFor(() => expect(queryByLabelText("Ficou dentro da casa")).toBeNull());
  });

  it("com casa, dá para dizer que o dinheiro ficou entre vocês", async () => {
    useFamilyStore.setState({ hasFamily: true } as never);
    marcarCasa.mockResolvedValue({
      ...LANCAMENTO,
      familyTransfer: true,
    } as BankTransaction);
    const { getByLabelText } = montar();

    fireEvent(
      await waitFor(() => getByLabelText("Ficou dentro da casa")),
      "valueChange",
      true,
    );

    await waitFor(() => expect(marcarCasa).toHaveBeenCalledWith("t1", true));
  });

  it("descartar a linha não a apaga, só a marca", async () => {
    marcarIgnorada.mockResolvedValue({
      ...LANCAMENTO,
      ignored: true,
    } as BankTransaction);
    const { getByLabelText } = montar();

    fireEvent(
      await waitFor(() => getByLabelText("Esta linha não deveria existir")),
      "valueChange",
      true,
    );

    await waitFor(() => expect(marcarIgnorada).toHaveBeenCalledWith("t1", true));
  });

  it("falha ao marcar aparece NA folha", async () => {
    marcarPropria.mockRejectedValue(new Error("boom"));
    const { getByLabelText, findByText } = montar();

    fireEvent(
      await waitFor(() => getByLabelText("É dinheiro meu trocando de bolso")),
      "valueChange",
      true,
    );

    expect(
      await findByText("Não consegui mudar isso agora. Tente de novo."),
    ).toBeTruthy();
  });
});
