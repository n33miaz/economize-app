import React from "react";
import { StyleSheet } from "react-native";
import { render } from "@testing-library/react-native";
import {
  useReducedMotion,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import AnimatedTabIcon from "../AnimatedTabIcon";
import type { TabGlyphProps } from "../../components/icons/TabGlyphs";

// Só as funções que decidem o movimento; o resto do Reanimated fica como
// está, senão o Animated.View sai do módulo e o componente não monta
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

// Glifo de prova: registra com que props foi desenhado, sem SVG de verdade
const Glifo = jest.fn((_props: TabGlyphProps) => null);

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion.mockReturnValue(false);
});

describe("AnimatedTabIcon — camadas", () => {
  it("desenha contorno frio, contorno quente e silhueta cheia do MESMO glifo", () => {
    render(<AnimatedTabIcon Glyph={Glifo} focused size={26} />);

    const desenhos = Glifo.mock.calls.map(([props]) => props);
    expect(desenhos.filter((p) => p.filled)).toHaveLength(1);
    expect(desenhos.filter((p) => !p.filled)).toHaveLength(2);
    desenhos.forEach((p) => expect(p.size).toBe(26));
  });

  it("a caixa não captura toque e recorta o que passa das janelas", () => {
    // O toque é do botão da aba; camada absoluta engolindo clique é o
    // sintoma invisível que já derrubou a web uma vez (ver pointerEvents.ts)
    const raiz = render(
      <AnimatedTabIcon Glyph={Glifo} focused size={26} />,
    ).toJSON() as any;

    expect(StyleSheet.flatten(raiz.props.style)).toMatchObject({
      pointerEvents: "none",
      overflow: "hidden",
      width: 26,
      height: 26,
    });
  });
});

describe("AnimatedTabIcon — movimento", () => {
  it("na montagem não há pop: a aba ativa nasce cheia e parada", () => {
    render(<AnimatedTabIcon Glyph={Glifo} focused size={26} />);

    expect(mockSequence).not.toHaveBeenCalled();
  });

  it("selecionar anima o nível e dispara o pop; desmarcar só drena", () => {
    const { rerender } = render(
      <AnimatedTabIcon Glyph={Glifo} focused={false} size={26} />,
    );
    jest.clearAllMocks();

    rerender(<AnimatedTabIcon Glyph={Glifo} focused size={26} />);
    expect(mockTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: 300 }),
    );
    expect(mockSequence).toHaveBeenCalledTimes(1);
    // O pico do pop é 1.06, cada metade com a duração de meia base
    expect(mockTiming).toHaveBeenCalledWith(
      1.06,
      expect.objectContaining({ duration: 150 }),
    );

    jest.clearAllMocks();
    rerender(<AnimatedTabIcon Glyph={Glifo} focused={false} size={26} />);
    expect(mockTiming).toHaveBeenCalledWith(
      0,
      expect.objectContaining({ duration: 300 }),
    );
    expect(mockSequence).not.toHaveBeenCalled();
  });

  it("com movimento reduzido o estado final entra seco, nas duas direções", () => {
    mockReducedMotion.mockReturnValue(true);
    const { rerender } = render(
      <AnimatedTabIcon Glyph={Glifo} focused={false} size={26} />,
    );

    rerender(<AnimatedTabIcon Glyph={Glifo} focused size={26} />);
    rerender(<AnimatedTabIcon Glyph={Glifo} focused={false} size={26} />);

    expect(mockTiming).not.toHaveBeenCalled();
    expect(mockSequence).not.toHaveBeenCalled();
    // As três camadas continuam lá: o que muda é só o nível, que pula
    expect(Glifo.mock.calls.length).toBeGreaterThan(0);
  });
});
