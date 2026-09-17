import fs from "fs";
import path from "path";

import React from "react";
import { act, render } from "@testing-library/react-native";
import {
  Easing,
  useReducedMotion,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import Skeleton from "../Skeleton";
import { useServerStore } from "../../store/serverStore";

jest.mock("react-native-reanimated", () => {
  const real = jest.requireActual("react-native-reanimated");
  return {
    ...real,
    __esModule: true,
    default: real.default,
    useReducedMotion: jest.fn(() => false),
    withTiming: jest.fn((valor: number) => valor),
    withSequence: jest.fn((...passos: number[]) => passos[passos.length - 1]),
    withRepeat: jest.fn((valor: number) => valor),
  };
});

const mockReducedMotion = useReducedMotion as jest.MockedFunction<
  typeof useReducedMotion
>;
const mockTiming = withTiming as jest.MockedFunction<typeof withTiming>;
const mockRepeat = withRepeat as jest.MockedFunction<typeof withRepeat>;

// Spec do protótipo de identidade: varredura de 1.2 s, linear, em loop
const PERIODO_MS = 1200;

function montarMedido() {
  const resultado = render(<Skeleton />);
  act(() => {
    (resultado.toJSON() as any).props.onLayout({
      nativeEvent: { layout: { x: 0, y: 0, width: 200, height: 20 } },
    });
  });
  return resultado;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockReducedMotion.mockReturnValue(false);
  useServerStore.setState({ isWaking: false, waitedSeconds: 0 });
});

describe("Skeleton — varredura", () => {
  it("varre em 1,2 s, linear e em loop sem inverter", () => {
    const resultado = montarMedido();

    expect(mockTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ duration: PERIODO_MS, easing: Easing.linear }),
    );
    // -1 = para sempre; false = recomeça do início em vez de ir e voltar
    expect(mockRepeat).toHaveBeenCalledWith(expect.anything(), -1, false);
    expect((resultado.toJSON() as any).children).toHaveLength(1);
  });

  it("com movimento reduzido não há varredura: o pulso de opacidade avisa", () => {
    // O que incomoda quem pediu menos movimento é a faixa cruzando a tela;
    // "carregando" continua sendo dito, agora por um pulso parado
    mockReducedMotion.mockReturnValue(true);
    const resultado = montarMedido();

    expect((resultado.toJSON() as any).children).toBeNull();
    const duracoes = mockTiming.mock.calls.map(([, cfg]) => cfg?.duration);
    expect(duracoes).not.toContain(PERIODO_MS);
    expect(duracoes).toContain(800);
    expect(mockRepeat).toHaveBeenCalledWith(expect.anything(), -1, true);
  });

  /**
   * A outra metade da escolha 12: *"nas telas com servidor dormindo, a faixa
   * desacelera para dizer sem palavras que vai demorar mais"*.
   *
   * <p>O plano free do Render hiberna e o primeiro acesso já custou 229 s
   * medidos. Uma faixa rápida nessa espera promete o que não vai cumprir.
   */
  it("com a API subindo, a faixa varre no dobro do tempo", () => {
    useServerStore.setState({ isWaking: true });
    montarMedido();

    expect(mockTiming).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        duration: PERIODO_MS * 2,
        easing: Easing.linear,
      }),
    );
    const duracoes = mockTiming.mock.calls.map(([, cfg]) => cfg?.duration);
    expect(duracoes).not.toContain(PERIODO_MS);
  });

  it("quando a API responde, a faixa volta ao ritmo rápido", () => {
    useServerStore.setState({ isWaking: true });
    const resultado = montarMedido();
    jest.clearAllMocks();

    // O que o efeito precisa observar: a espera acaba NO MEIO do carregamento,
    // e a tela não pode terminar de carregar devagar
    act(() => {
      useServerStore.setState({ isWaking: false });
    });
    resultado.rerender(<Skeleton />);

    const duracoes = mockTiming.mock.calls.map(([, cfg]) => cfg?.duration);
    expect(duracoes).toContain(PERIODO_MS);
    expect(duracoes).not.toContain(PERIODO_MS * 2);
  });

  it("o período não bifurca por plataforma", () => {
    // Nativo e web precisam varrer no mesmo ritmo: a garantia é o componente
    // nem olhar para Platform — uma constante só, usada uma vez
    const fonte = fs.readFileSync(
      path.join(__dirname, "..", "Skeleton.tsx"),
      "utf8",
    );
    expect(fonte).not.toMatch(/Platform/);
    expect(fonte.match(/1200/g)).toHaveLength(1);
  });
});
