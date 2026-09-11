import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Categories from "../Categories";
import { useCategoriesStore } from "../../store/categoriesStore";
import { usePlanStore } from "../../store/planStore";
import { useToastStore } from "../../store/toastStore";

import type { Category } from "../../services/api";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({ index: 1, routes: [{ name: "Main" }, { name: "Categorias" }] }),
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

const cat = (over: Partial<Category> & { id: string; name: string }): Category =>
  ({
    slug: over.name.toLowerCase().replace(/\s+/g, "-"),
    groupName: null,
    flow: "EXPENSE",
    color: "#F2C14E",
    icon: "tag",
    parentId: null,
    archived: false,
    system: false,
    ...over,
  }) as Category;

const ALIMENTACAO = cat({ id: "c1", name: "Alimentação" });
const MERCADO = cat({ id: "c2", name: "Mercado", parentId: "c1" });
const ARQUIVADA = cat({ id: "c3", name: "Antiga", archived: true });

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Categories />
    </SafeAreaProvider>,
  );

describe("Categorias", () => {
  beforeEach(() => {
    useCategoriesStore.setState({
      items: [ALIMENTACAO, MERCADO, ARQUIVADA],
      isLoading: false,
      isSaving: false,
      error: null,
      fetch: jest.fn().mockResolvedValue(undefined),
    } as never);
    usePlanStore.setState({ plan: "FREE", adsEnabled: true });
    useToastStore.setState({ toasts: [] } as never);
  });

  it("lista as categorias ativas", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Alimentação")).toBeTruthy());
  });

  it("a subcategoria aparece dentro da raiz, não solta na lista", async () => {
    // A taxonomia é de dois níveis (ADR-013): "Mercado" só existe DENTRO de
    // "Alimentação", e é o acordeão que mostra isso
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Alimentação")).toBeTruthy());
    fireEvent.press(getByText("Alimentação"));
    await waitFor(() => expect(getByText("Mercado")).toBeTruthy());
  });

  it("arquivada aparece separada, sob o próprio título", async () => {
    // Arquivar não some com a categoria: ela desce para um bloco próprio, e é
    // isso que permite reativá-la sem recriar (e sem perder o histórico)
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Alimentação")).toBeTruthy());
    expect(getByText("Arquivadas")).toBeTruthy();
    expect(getByText("Antiga")).toBeTruthy();
  });

  it("pede a lista ao servidor na abertura", async () => {
    const fetch = jest.fn().mockResolvedValue(undefined);
    useCategoriesStore.setState({ fetch } as never);

    montar();

    await waitFor(() => expect(fetch).toHaveBeenCalled());
  });

  it("sem nenhuma categoria a tela ainda monta e oferece criar", async () => {
    useCategoriesStore.setState({ items: [] } as never);

    const { getByText } = montar();

    // O caminho de criar é a saída de quem apagou tudo — sem ele a tela
    // vazia seria um beco
    await waitFor(() => expect(getByText("Categorias")).toBeTruthy());
  });

  it("EC-199: toda raiz oferece criar subcategoria, inclusive as do sistema", async () => {
    const { getAllByLabelText } = montar();

    // As 14 raizes do sistema nao tinham gesto nenhum na linha: criar
    // "Mercado > Feira" exigia abrir "Nova categoria" e cacar o pai numa
    // lista de 14 -- o caminho existia e ninguem achava
    await waitFor(() =>
      expect(getAllByLabelText(/Nova subcategoria em /).length).toBeGreaterThan(0),
    );
  });

  it("subcategoria NAO oferece neta: a hierarquia e de dois niveis", async () => {
    const { queryByLabelText } = montar();

    // Oferecer um botao que a API recusaria e pior do que nao oferecer
    await waitFor(() =>
      expect(queryByLabelText("Nova subcategoria em Mercado")).toBeNull(),
    );
  });
});
