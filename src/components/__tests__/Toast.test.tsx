import React from "react";
import { render } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";
import {
  useReducedMotion,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import Toast from "../Toast";
import { useToastStore } from "../../store/toastStore";

// Só as três funções que decidem o movimento; o resto do Reanimated fica como
// está, senão o Animated.View sai do módulo e o componente não monta
jest.mock("react-native-reanimated", () => {
  const real = jest.requireActual("react-native-reanimated");
  return {
    ...real,
    __esModule: true,
    default: real.default,
    useReducedMotion: jest.fn(() => false),
    withSpring: jest.fn((valor: number) => valor),
    withTiming: jest.fn((valor: number) => valor),
  };
});

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Toast />
    </SafeAreaProvider>,
  );

const mockReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;
const mockSpring = withSpring as jest.MockedFunction<typeof withSpring>;
const mockTiming = withTiming as jest.MockedFunction<typeof withTiming>;

describe("Toast — movimento reduzido (EC-054)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion.mockReturnValue(false);
    useToastStore.setState({ visible: false, message: "", type: "info" });
  });

  it("com movimento normal, o toast desliza para entrar", () => {
    useToastStore.setState({ visible: true, message: "Salvo", type: "success" });

    montar();

    expect(mockSpring).toHaveBeenCalled();
  });

  it("com movimento reduzido, ele aparece sem percurso nenhum", () => {
    // A mensagem continua sendo entregue: o que sai é o deslize, que é
    // justamente o que incomoda quem pediu menos movimento
    mockReducedMotion.mockReturnValue(true);
    useToastStore.setState({ visible: true, message: "Salvo", type: "success" });

    montar();

    expect(mockSpring).not.toHaveBeenCalled();
    expect(mockTiming).not.toHaveBeenCalled();
  });

  it("a mensagem aparece na tela", () => {
    useToastStore.setState({
      visible: true,
      message: "Relatório excluído.",
      type: "success",
    });

    const { getByText } = montar();

    expect(getByText("Relatório excluído.")).toBeTruthy();
  });
});
