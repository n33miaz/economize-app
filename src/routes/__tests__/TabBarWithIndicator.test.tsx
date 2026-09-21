import React from "react";
import { StyleSheet } from "react-native";
import { act, render } from "@testing-library/react-native";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import {
  useReducedMotion,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import TabBarWithIndicator from "../TabBarWithIndicator";

// A barra padrão exige um navegador de verdade por baixo; o que se prova aqui
// é o indicador que o wrap sobrepõe a ela
jest.mock("@react-navigation/bottom-tabs", () => ({
  BottomTabBar: () => null,
}));

jest.mock("react-native-reanimated", () => {
  const real = jest.requireActual("react-native-reanimated");
  return {
    ...real,
    __esModule: true,
    default: real.default,
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn((valor: number) => valor),
    withSequence: jest.fn((...passos: number[]) => passos[passos.length - 1]),
  };
});

const mockReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;
const mockTiming = withTiming as jest.MockedFunction<typeof withTiming>;
const mockSequence = withSequence as jest.MockedFunction<typeof withSequence>;

// Espelham o componente. Ficam aqui como número literal de propósito: se o
// respiro ou a altura da ilha mudarem sem querer, é ESTE teste que avisa —
// importar as constantes faria o teste concordar com qualquer valor.
const PILULA_MARGEM = 6;
const ILHA_ALTURA = 64;

const LARGURA = 390;

function props(index: number, lateral = 0): BottomTabBarProps {
  return {
    state: {
      index,
      routes: [
        { key: "f", name: "Finanças" },
        { key: "p", name: "Principal" },
        { key: "i", name: "Indicadores" },
      ],
    },
    insets: { top: 0, left: lateral, right: lateral, bottom: 0 },
    descriptors: {},
    navigation: {},
  } as unknown as BottomTabBarProps;
}

/** Monta e entrega a largura medida — sem ela o indicador não existe. */
function montar(index: number, lateral = 0) {
  const resultado = render(<TabBarWithIndicator {...props(index, lateral)} />);
  act(() => {
    (resultado.toJSON() as any).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: LARGURA, height: ILHA_ALTURA } },
    });
  });
  return resultado;
}

function indicador(resultado: ReturnType<typeof render>) {
  const raiz = resultado.toJSON() as any;
  return raiz.children?.[0];
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion.mockReturnValue(false);
});

describe("TabBarWithIndicator", () => {
  it("nasce em cima da aba ativa, sem deslizar nem esticar", () => {
    const resultado = montar(1);

    // A marca da aba ativa deixou de ser um traço de 3 px no topo e virou uma
    // PÍLULA atrás do item — a barra virou ilha flutuante em 16/09/2026 e um
    // traço no topo apontaria para a borda de um bloco que flutua. O que o
    // teste trava continua sendo o mesmo: a marca nasce com a geometria de UMA
    // aba, descontado o respiro, e não recebe toque.
    const estilo = StyleSheet.flatten(indicador(resultado).props.style);
    expect(estilo).toMatchObject({
      width: LARGURA / 3 - PILULA_MARGEM,
      height: ILHA_ALTURA - PILULA_MARGEM * 2,
      pointerEvents: "none",
    });
    // A primeira medição só dá largura ao traço — o índice já era o certo
    expect(mockTiming).not.toHaveBeenCalled();
    expect(mockSequence).not.toHaveBeenCalled();
  });

  it("trocar de aba desliza com estica-e-volta de 10%, sem mola", () => {
    const resultado = montar(0);
    jest.clearAllMocks();

    resultado.rerender(<TabBarWithIndicator {...props(2)} />);

    expect(mockTiming).toHaveBeenCalledWith(
      2,
      expect.objectContaining({ duration: 300 }),
    );
    // Uma sequência de dois withTiming: estica até 1.1 na ida e volta a 1
    expect(mockSequence).toHaveBeenCalledTimes(1);
    expect(mockTiming).toHaveBeenCalledWith(
      1.1,
      expect.objectContaining({ duration: 150 }),
    );
    expect(mockTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 150 }),
    );
  });

  it("com movimento reduzido o traço pula para a aba, sem trajeto", () => {
    mockReducedMotion.mockReturnValue(true);
    const resultado = montar(0);

    resultado.rerender(<TabBarWithIndicator {...props(2)} />);

    expect(mockTiming).not.toHaveBeenCalled();
    expect(mockSequence).not.toHaveBeenCalled();
    expect(indicador(resultado)).toBeTruthy();
  });

  it("desconta o inset lateral (notch em landscape) da largura de cada aba", () => {
    const resultado = montar(1, 44);

    const estilo = StyleSheet.flatten(indicador(resultado).props.style);
    expect(estilo.width).toBeCloseTo((LARGURA - 88) / 3 - PILULA_MARGEM);
  });
});
