import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import StatementReview from "../StatementReview";
import { useAccountsStore } from "../../store/accountsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useReviewStore } from "../../store/reviewStore";
import { useToastStore } from "../../store/toastStore";

import type { Category, ReviewGroup } from "../../services/api";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  // Tudo dentro do factory: o `jest.mock` é içado acima das consts do arquivo,
  // e referenciar uma variável de fora daqui estoura antes do primeiro teste
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Revisao" }] }),
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

const ALIMENTACAO = {
  id: "cat-1",
  name: "Alimentação",
  slug: "alimentacao",
  groupName: null,
  flow: "EXPENSE",
  color: "#F2C14E",
  icon: "utensils",
  parentId: null,
  archived: false,
  system: true,
} as Category;

/** @param sugerida null = grupo que exige escolha manual (o caso do dono) */
const grupo = (
  descricao: string,
  quantas: number,
  sugerida: string | null,
): ReviewGroup =>
  ({
    normalizedDescription: descricao.toLowerCase(),
    sampleDescription: descricao,
    suggestedCategoryId: sugerida,
    categorizedBy: sugerida ? "KEYWORD" : null,
    confidence: sugerida ? 0.7 : null,
    totalAmount: -10 * quantas,
    transactions: Array.from({ length: quantas }, (_, i) => ({
      id: `${descricao}-${i}`,
      transactionId: `ext-${descricao}-${i}`,
      type: "DEBIT",
      amount: -10,
      description: descricao,
      date: "2026-08-10T12:00:00Z",
      categoryId: sugerida,
      accountId: null,
      reviewStatus: sugerida ? "SUGGESTED" : "UNCATEGORIZED",
    })),
  }) as unknown as ReviewGroup;

const BASE = {
  groups: [] as ReviewGroup[],
  uploadId: null,
  pendingCount: 0,
  applyProgress: null,
  isLoading: false,
  isApplying: false,
  error: null,
  fetchQueue: jest.fn().mockResolvedValue(undefined),
  fetchPendingCount: jest.fn().mockResolvedValue(undefined),
  apply: jest.fn().mockResolvedValue(1),
  applyMany: jest.fn().mockResolvedValue({ confirmed: 0, failedItems: [] }),
  recategorize: jest
    .fn()
    .mockResolvedValue({ ok: true, resolved: 0, message: "Nada novo." }),
  confirmAll: jest.fn().mockResolvedValue(0),
  applyTransaction: jest.fn(),
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <StatementReview />
    </SafeAreaProvider>,
  );

describe("Revisão do extrato", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useReviewStore.setState({ ...BASE } as never);
    useCategoriesStore.setState({
      items: [ALIMENTACAO],
      fetch: jest.fn().mockResolvedValue(undefined),
    } as never);
    useAccountsStore.setState({
      accounts: [],
      byId: new Map(),
      fetchAccounts: jest.fn().mockResolvedValue(undefined),
    } as never);
    useToastStore.setState({ toasts: [] } as never);
  });

  it("mostra os grupos que esperam decisão", async () => {
    useReviewStore.setState({
      ...BASE,
      groups: [grupo("CLICK MACHINE", 3, null)],
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("CLICK MACHINE")).toBeTruthy());
  });

  it("sem sugestão nenhuma, 'Aprovar tudo' não aparece", async () => {
    // É exatamente o caso que travou o dono: 137 grupos, zero sugestões, e o
    // botão de aprovar tudo — que só confirma o que o MOTOR sugeriu — nem
    // chega a ser renderizado
    useReviewStore.setState({
      ...BASE,
      groups: [grupo("CLICK MACHINE", 3, null), grupo("ASL VARIEDADES", 2, null)],
    } as never);

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("CLICK MACHINE")).toBeTruthy());
    expect(queryByText(/Aprovar tudo/)).toBeNull();
  });

  it("com sugestão, 'Aprovar tudo' conta as transações sugeridas", async () => {
    useReviewStore.setState({
      ...BASE,
      groups: [grupo("IFOOD", 4, ALIMENTACAO.id)],
    } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Aprovar tudo (4)")).toBeTruthy());
  });

  it("o atalho de reconhecer automaticamente chama o servidor", async () => {
    const recategorize = jest
      .fn()
      .mockResolvedValue({ ok: true, resolved: 2, message: "2 ganharam sugestão." });
    useReviewStore.setState({
      ...BASE,
      groups: [grupo("CLICK MACHINE", 3, null)],
      recategorize,
    } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("Tentar reconhecer automaticamente")).toBeTruthy(),
    );
    fireEvent.press(getByText("Tentar reconhecer automaticamente"));

    await waitFor(() => expect(recategorize).toHaveBeenCalled());
  });

  it("fila vazia não oferece nem aprovar nem reexaminar", async () => {
    const { queryByText } = montar();

    await waitFor(() =>
      expect(queryByText("Tentar reconhecer automaticamente")).toBeNull(),
    );
    expect(queryByText(/Aprovar tudo/)).toBeNull();
  });

  it("busca a fila e o catálogo ao abrir", async () => {
    const fetchQueue = jest.fn().mockResolvedValue(undefined);
    const fetchCategorias = jest.fn().mockResolvedValue(undefined);
    useReviewStore.setState({ ...BASE, fetchQueue } as never);
    useCategoriesStore.setState({
      items: [ALIMENTACAO],
      fetch: fetchCategorias,
    } as never);

    montar();

    // Sem o catálogo, o chip de categoria não teria nome para mostrar
    await waitFor(() => expect(fetchQueue).toHaveBeenCalled());
    expect(fetchCategorias).toHaveBeenCalled();
  });
});
