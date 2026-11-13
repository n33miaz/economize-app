import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Reports from "../Reports";
import { useReportsStore } from "../../store/reportsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { usePlanStore } from "../../store/planStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Relatorios" }] }),
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

const relatorio = (id: string, inicio: string, fim: string) =>
  ({
    id,
    period: "MONTHLY",
    startDate: inicio,
    endDate: fim,
    totalIncome: 5423.68,
    totalExpense: 6862.7,
    balance: -1439.02,
    breakdown: {},
    createdAt: "2026-09-01T10:00:00Z",
  }) as never;

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Reports />
    </SafeAreaProvider>,
  );

describe("Relatórios", () => {
  beforeEach(() => {
    useReportsStore.setState({
      items: [relatorio("r1", "2026-08-01", "2026-08-31")],
      isLoading: false,
      isGenerating: false,
      error: null,
      loadError: null,
      fetch: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(true),
    } as never);
    useCategoriesStore.setState({ items: [] } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  });

  it("monta com a lista que o store já tem", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Relatórios")).toBeTruthy());
  });

  it("pede os relatórios ao abrir", async () => {
    const fetch = jest.fn().mockResolvedValue(undefined);
    useReportsStore.setState({ fetch } as never);

    montar();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("sem relatório nenhum a tela continua de pé", async () => {
    useReportsStore.setState({ items: [] } as never);

    const { getByText, getAllByLabelText } = montar();

    await waitFor(() => expect(getByText("Relatórios")).toBeTruthy());
    // EC-231: o pote vazio, com o "Gerar" repetido para quem chegou sem vê-lo
    // — são DOIS botões com o mesmo rótulo, o do cabeçalho e o do vazio
    expect(getByText("Nenhum relatório mensais ainda")).toBeTruthy();
    expect(getAllByLabelText("Gerar relatório")).toHaveLength(2);
    // EC-228: a primeira visita diz o que um relatório fecha
    expect(getByText("O que um relatório fecha")).toBeTruthy();
  });

  it("no Plus o espaço de anúncio não é reservado", async () => {
    usePlanStore.setState({ plan: "PLUS", adsEnabled: false });

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText("Relatórios")).toBeTruthy());
    expect(queryByText("Publicidade")).toBeNull();
  });

  it("falha ao buscar mostra o erro com tentar de novo, não o vazio", async () => {
    const fetch = jest.fn().mockResolvedValue(undefined);
    useReportsStore.setState({
      items: [],
      loadError: "Falha ao carregar relatórios",
      fetch,
    } as never);

    const { getByText, getAllByLabelText, queryByText } = montar();

    await waitFor(() =>
      expect(getByText("Falha ao carregar relatórios")).toBeTruthy(),
    );
    expect(queryByText(/Nenhum relatório/)).toBeNull();
    fetch.mockClear();
    fireEvent.press(getAllByLabelText("Tentar de novo")[0]);
    expect(fetch).toHaveBeenCalledWith("MONTHLY");
  });

  it("os chips de período dizem qual está aberto", async () => {
    const { getAllByRole } = montar();

    await waitFor(() => expect(getAllByRole("tab")).toHaveLength(3));
    const selecionados = getAllByRole("tab").filter(
      (el) => el.props.accessibilityState?.selected,
    );
    expect(selecionados).toHaveLength(1);
  });

  it("falha ao GERAR não troca o vazio pelo erro de carga", async () => {
    // Gerar já avisa por toast; o vazio fica com o seu "Gerar relatório"
    useReportsStore.setState({
      items: [],
      error: "Falha ao gerar relatório",
      loadError: null,
    } as never);

    const { getByText, queryByLabelText } = montar();

    await waitFor(() =>
      expect(getByText("Nenhum relatório mensais ainda")).toBeTruthy(),
    );
    expect(queryByLabelText("Tentar de novo")).toBeNull();
  });
});
