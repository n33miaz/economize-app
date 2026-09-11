import React from "react";
import { Text } from "react-native";
import { act, render, renderHook } from "@testing-library/react-native";

import FlipCard, { useFlip } from "../FlipCard";

const FRENTE = "o número";
const VERSO = "de onde veio";

const montar = (flipped: boolean) =>
  render(
    <FlipCard flipped={flipped} front={<Text>{FRENTE}</Text>} back={<Text>{VERSO}</Text>} />,
  );

/**
 * EC-225 — o card que gira.
 *
 * O que se prova aqui é que os DOIS lados existem o tempo todo: o verso não
 * pode ser montado só quando aparece, senão a altura do card salta no meio do
 * giro e empurra a tela inteira.
 */
describe("Card que gira", () => {
  it("os dois lados ficam montados — a altura é a do maior", () => {
    const { getByText } = montar(false);

    expect(getByText(FRENTE)).toBeTruthy();
    expect(getByText(VERSO)).toBeTruthy();
  });

  it("virado, continua com os dois lados na árvore", () => {
    const { getByText } = montar(true);

    expect(getByText(FRENTE)).toBeTruthy();
    expect(getByText(VERSO)).toBeTruthy();
  });

  it("o estado do giro alterna", () => {
    const { result } = renderHook(() => useFlip());

    expect(result.current.flipped).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.flipped).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.flipped).toBe(false);
  });

  it("o verso volta sozinho — ele é resposta, não um modo da tela", () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useFlip(6000));

      act(() => result.current.toggle());
      expect(result.current.flipped).toBe(true);

      act(() => {
        jest.advanceTimersByTime(6100);
      });

      // Sem isto, o usuário rola a tela e encontra quatro cards de costas mais
      // tarde, sem lembrar por quê
      expect(result.current.flipped).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });

  it("voltar para a frente cancela o temporizador", () => {
    jest.useFakeTimers();
    try {
      const { result } = renderHook(() => useFlip(6000));

      act(() => result.current.toggle());
      act(() => result.current.reset());

      act(() => {
        jest.advanceTimersByTime(10000);
      });

      expect(result.current.flipped).toBe(false);
    } finally {
      jest.useRealTimers();
    }
  });
});
