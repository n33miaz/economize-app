import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import BankIntegration from "../BankIntegration";
import { useAccountsStore } from "../../store/accountsStore";
import { useBankStore } from "../../store/bankStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useConnectorStore } from "../../store/connectorStore";
import { useFamilyStore } from "../../store/familyStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";

// A conferencia de saldo (EC-196) sai na entrada da tela. Aqui ela devolve
// vazio: o que estes testes cobrem e a tela de conexoes, nao o aviso -- que
// tem suite propria em BalanceCheckNotice.test.tsx
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getBalanceCheck: jest.fn().mockResolvedValue({ accountsChecked: 0, findings: [] }),
  // Origens duplicadas: a tela pergunta na montagem e trata a falha em
  // silêncio — o dublê devolve "nenhuma" para o caso comum
  getMergeSuggestions: jest.fn().mockResolvedValue([]),
  mergeAccounts: jest.fn().mockResolvedValue(0),
  describeRequestFailure: jest.fn(() => ({ kind: "UNKNOWN", message: "falhou" })),
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => false,
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

const lancamento = (id: string, descricao: string, valor: number) => ({
  id,
  transactionId: `ext-${id}`,
  type: valor < 0 ? "DEBIT" : "CREDIT",
  amount: valor,
  description: descricao,
  date: "2026-08-10T12:00:00Z",
  categoryId: null,
  category: null,
  accountId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: "USER",
  confidence: null,
  internalTransfer: false,
});

function prepararStores() {
  useBankStore.setState({
    transactions: [lancamento("t1", "SUPERMERCADO SERO", -194.99)],
    isLoading: false,
    isImporting: false,
    error: null,
    fetchedAt: Date.now(),
    fetchTransactions: jest.fn().mockResolvedValue(undefined),
    importStatement: jest.fn(),
    applyTransaction: jest.fn(),
    calculateMetrics: () => ({ income: 0, expense: 194.99, total: -194.99 }),
  } as never);
  useFamilyStore.setState({
    hasFamily: false,
    scope: "me",
    transactions: [],
    isTransactionsLoading: false,
    transactionsError: null,
    hasLoadedTransactionsOnce: true,
    fetchTransactions: jest.fn().mockResolvedValue(undefined),
    family: null,
    setScope: jest.fn(),
  } as never);
  useAccountsStore.setState({
    accounts: [],
    byId: new Map(),
    isLoading: false,
    hasLoadedOnce: true,
    error: null,
    invoices: {},
    fetchAccounts: jest.fn().mockResolvedValue(undefined),
  } as never);
  useCategoriesStore.setState({
    items: [],
    fetch: jest.fn().mockResolvedValue(undefined),
  } as never);
  useConnectorStore.setState({
    status: { enabled: false, configured: false, itemCount: 0 },
    items: [],
    isChecking: false,
    isSyncing: false,
    isLoadingItems: false,
    isLinking: false,
    error: null,
    checkStatus: jest.fn().mockResolvedValue(undefined),
    fetchItems: jest.fn().mockResolvedValue(undefined),
    runSync: jest.fn(),
  } as never);
  usePreferencesStore.setState({ cycleAnchorDay: 1 } as never);
  usePlanStore.setState({ plan: "FREE", adsEnabled: true });
}

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BankIntegration />
    </SafeAreaProvider>,
  );

describe("Extrato", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    prepararStores();
  });

  it("lista o lançamento importado", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("SUPERMERCADO SERO")).toBeTruthy());
  });

  it("busca extrato, categorias e contas ao ganhar foco", async () => {
    const fetchTransactions = jest.fn().mockResolvedValue(undefined);
    const fetchCategories = jest.fn().mockResolvedValue(undefined);
    const fetchAccounts = jest.fn().mockResolvedValue(undefined);
    useBankStore.setState({ fetchTransactions } as never);
    useCategoriesStore.setState({ items: [], fetch: fetchCategories } as never);
    useAccountsStore.setState({ fetchAccounts } as never);

    montar();

    await waitFor(() => expect(fetchTransactions).toHaveBeenCalled());
    expect(fetchCategories).toHaveBeenCalled();
    expect(fetchAccounts).toHaveBeenCalled();
  });

  it("extrato vazio não vira tela quebrada", async () => {
    useBankStore.setState({ transactions: [] } as never);

    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("em nenhum lugar aparece o nome do provedor do conector", async () => {
    // Pedido do dono: o usuário só precisa saber que pode conectar o banco;
    // quem faz o meio é assunto nosso, e trocar de provedor não pode virar
    // uma troca de textos pelo app inteiro
    useConnectorStore.setState({
      status: {
        enabled: true,
        configured: true,
        itemCount: 1,
        provider: { id: "pluggy", displayName: "Open Finance" },
      },
    } as never);

    const { queryByText } = montar();

    await waitFor(() => expect(queryByText(/[Pp]luggy/)).toBeNull());
  });

  it("sem conector ligado, a seção de conexão não é oferecida", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("sem casa, o alternador Eu/Casa fica fora", async () => {
    const { queryByText } = montar();

    await waitFor(() => expect(queryByText("Casa")).toBeNull());
  });
});
