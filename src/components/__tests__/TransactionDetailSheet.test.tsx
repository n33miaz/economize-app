import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import TransactionDetailSheet from "../TransactionDetailSheet";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";

import type { BankTransaction } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  renameTransaction: jest.fn(),
}));

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
} as unknown as BankTransaction;

const montar = (visivel = true) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <TransactionDetailSheet
        transaction={LANCAMENTO}
        visible={visivel}
        onClose={jest.fn()}
        onUpdated={jest.fn()}
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
  });

  it("mostra a descrição do lançamento", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("SUPERMERCADO SERO")).toBeTruthy());
  });

  it("fechada, não desenha o conteúdo", async () => {
    const { queryByText } = montar(false);

    await waitFor(() => expect(queryByText("SUPERMERCADO SERO")).toBeNull());
  });
});
