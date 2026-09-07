import React from "react";
import { render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import RecurrenceForm from "../RecurrenceForm";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";

jest.mock("../../services/api", () => ({ __esModule: true, default: {} }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    canGoBack: () => true,
    getState: () => ({
      index: 1,
      routes: [{ name: "Main" }, { name: "AgendarRecorrencia" }],
    }),
  }),
  // Sem `seriesId`: é o caminho de CRIAR, que é o mais usado
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

const BASE = {
  series: [],
  dismissed: [],
  isSaving: false,
  createSeries: jest.fn().mockResolvedValue({ status: "saved", series: {} }),
  updateSeries: jest.fn().mockResolvedValue({ status: "saved", series: {} }),
  fetchSeries: jest.fn().mockResolvedValue(undefined),
  fetchDismissed: jest.fn().mockResolvedValue(undefined),
  byId: () => undefined,
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <RecurrenceForm />
    </SafeAreaProvider>,
  );

describe("Agendar recorrência", () => {
  beforeEach(() => {
    useRecurrenceStore.setState(BASE as never);
    useCategoriesStore.setState({
      items: [],
      byId: () => undefined,
      fetch: jest.fn().mockResolvedValue(undefined),
    } as never);
  });

  it("abre no modo de criar", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("não salva nada só por abrir a tela", async () => {
    const createSeries = jest.fn();
    useRecurrenceStore.setState({ ...BASE, createSeries } as never);

    montar();

    await waitFor(() => expect(createSeries).not.toHaveBeenCalled());
  });
});
