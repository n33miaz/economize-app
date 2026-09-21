import React from "react";
import { act, fireEvent, render } from "@testing-library/react-native";

import { useReducedMotion, withTiming } from "react-native-reanimated";

import ScreenHeader from "../ScreenHeader";
import { useTabBarStore } from "../../store/tabBarStore";

jest.mock("react-native-reanimated", () => {
  const real = jest.requireActual("react-native-reanimated");
  return {
    ...real,
    __esModule: true,
    default: real.default,
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn((valor: number) => valor),
  };
});

// Largura de telefone: o cabeçalho só condensa no celular
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
}));

const mockReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;
const mockTiming = withTiming as jest.MockedFunction<typeof withTiming>;

// O cabeçalho decide sozinho se mostra a seta: precisa saber em que tipo de
// navegador está. O mock troca o estado por teste sem montar navegação real.
const mockNavigation = {
  getState: jest.fn(),
  canGoBack: jest.fn(),
  goBack: jest.fn(),
  navigate: jest.fn(),
};
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => mockNavigation,
}));
const navigation = mockNavigation;

describe("ScreenHeader — seta de voltar", () => {
  beforeEach(() => {
    navigation.getState.mockReset();
    navigation.canGoBack.mockReset();
    navigation.goBack.mockReset();
  });

  it("aparece numa tela empilhada com histórico e volta ao toque", () => {
    // Na web a tela empilhada cobre a barra de abas e não há botão do
    // sistema: sem a seta a pessoa fica presa na Análise
    navigation.getState.mockReturnValue({ type: "stack" });
    navigation.canGoBack.mockReturnValue(true);
    const { getByLabelText } = render(<ScreenHeader title="Análise" />);
    fireEvent.press(getByLabelText("Voltar"));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("não aparece na raiz de uma aba", () => {
    navigation.getState.mockReturnValue({ type: "tab" });
    navigation.canGoBack.mockReturnValue(true);
    const { queryByLabelText } = render(<ScreenHeader title="Finanças" />);
    expect(queryByLabelText("Voltar")).toBeNull();
  });

  it("não aparece na primeira tela da pilha, sem histórico", () => {
    navigation.getState.mockReturnValue({ type: "stack" });
    navigation.canGoBack.mockReturnValue(false);
    const { queryByLabelText } = render(<ScreenHeader title="Início" />);
    expect(queryByLabelText("Voltar")).toBeNull();
  });

  it("a prop explícita vence a detecção automática", () => {
    navigation.getState.mockReturnValue({ type: "stack" });
    navigation.canGoBack.mockReturnValue(true);
    const { queryByLabelText } = render(
      <ScreenHeader title="Revisão" showBackButton={false} />,
    );
    expect(queryByLabelText("Voltar")).toBeNull();
  });
});

/**
 * A segunda metade da escolha 5, de 16/09: <i>"no celular, o header condensa
 * ao rolar: o título de 28 px encolhe para 18 e vira uma barra fina com
 * sombra, liberando altura"</i>.
 *
 * <p>O que se prova aqui é o TRAJETO pedido, não o estilo final: o estilo que
 * sai de um `useAnimatedStyle` só é recalculado na thread de UI, que o
 * ambiente de teste não executa — lê-lo aqui devolveria sempre o primeiro
 * valor. Mesma escolha das suítes da ilha e do segmentado.
 */
describe("ScreenHeader — condensar ao rolar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockReducedMotion.mockReturnValue(false);
    navigation.getState.mockReturnValue({ type: "tab" });
    navigation.canGoBack.mockReturnValue(false);
    useTabBarStore.setState({ escondida: false, ultimoY: 0 });
  });

  it("a montagem não anima: o cabeçalho apenas está aberto", () => {
    render(<ScreenHeader title="Finanças" subtitle="Gestão de Patrimônio" />);

    expect(mockTiming).not.toHaveBeenCalled();
  });

  it("rolar para baixo condensa, e voltar ao topo reabre", () => {
    render(<ScreenHeader title="Finanças" />);

    act(() => {
      useTabBarStore.setState({ escondida: true });
    });
    expect(mockTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 250 }),
    );

    jest.clearAllMocks();
    act(() => {
      useTabBarStore.setState({ escondida: false });
    });
    expect(mockTiming).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ duration: 250 }),
    );
  });

  it("com movimento reduzido, a troca é seca", () => {
    mockReducedMotion.mockReturnValue(true);
    render(<ScreenHeader title="Finanças" />);
    jest.clearAllMocks();

    act(() => {
      useTabBarStore.setState({ escondida: true });
    });

    expect(mockTiming).not.toHaveBeenCalled();
  });

  /**
   * O título e a legenda continuam legíveis nos dois estados — condensar
   * encolhe, nunca esconde: um cabeçalho que apaga o nome da tela ao rolar
   * tira a única referência de onde a pessoa está.
   */
  it("o nome da tela sobrevive ao condensado", () => {
    const { getByText } = render(
      <ScreenHeader title="Finanças" subtitle="Gestão de Patrimônio" />,
    );

    act(() => {
      useTabBarStore.setState({ escondida: true });
    });

    expect(getByText("Finanças")).toBeTruthy();
    expect(getByText("Gestão de Patrimônio")).toBeTruthy();
  });
});
