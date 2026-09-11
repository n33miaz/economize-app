import React from "react";
import { Text } from "react-native";
import { act, render } from "@testing-library/react-native";

import AppOpening from "../AppOpening";
import { useOpeningStore } from "../../store/openingStore";

const MIOLO = "conteúdo do app";

const montar = () =>
  render(
    <AppOpening>
      <Text>{MIOLO}</Text>
    </AppOpening>,
  );

/**
 * A cortina de abertura de quem já está dentro.
 *
 * O que se prova aqui é a regra dura herdada do Login: a animação acompanha o
 * carregamento, ela não é o motivo da espera — e nunca prende a tela.
 */
describe("Abertura do app", () => {
  beforeEach(() => {
    useOpeningStore.setState({ done: false, ready: false });
  });

  it("o conteúdo já está montado por baixo da cortina", () => {
    // Montar só depois seria pagar o carregamento da Home DEPOIS da animação,
    // e aí a animação viraria espera de verdade
    const { getByText } = montar();

    expect(getByText(MIOLO)).toBeTruthy();
  });

  it("terminada, a cortina sai do caminho", () => {
    useOpeningStore.setState({ done: true, ready: true });

    const { getByText } = montar();

    expect(getByText(MIOLO)).toBeTruthy();
  });

  it("a Home avisando que está pronta libera o fim da animação", () => {
    montar();

    act(() => {
      useOpeningStore.getState().markReady();
    });

    expect(useOpeningStore.getState().ready).toBe(true);
  });

  it("servidor lento não prende a tela: a cortina sai sem a animação", () => {
    jest.useFakeTimers();
    try {
      montar();
      expect(useOpeningStore.getState().ready).toBe(false);

      // O teto TOTAL não passa pelo `onSettled` do Reanimated de propósito:
      // um callback que não chega deixaria a tela inteira coberta para sempre
      act(() => {
        jest.advanceTimersByTime(5000);
      });

      expect(useOpeningStore.getState().done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("o teto total vale mesmo quando a Home respondeu na hora", () => {
    jest.useFakeTimers();
    try {
      montar();
      act(() => {
        useOpeningStore.getState().markReady();
        jest.advanceTimersByTime(5000);
      });

      expect(useOpeningStore.getState().done).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it("sair zera a cortina — a próxima entrada é outra sessão", () => {
    useOpeningStore.setState({ done: true, ready: true });

    useOpeningStore.getState().reset();

    expect(useOpeningStore.getState().done).toBe(false);
    expect(useOpeningStore.getState().ready).toBe(false);
  });
});
