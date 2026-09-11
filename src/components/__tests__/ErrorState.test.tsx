import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import ErrorState from "../ErrorState";

const AGORA = Date.parse("2026-09-10T12:00:00Z");

/**
 * EC-216 — a tela que falha diz o que falhou, DESDE QUANDO, e para onde ir.
 *
 * O concorrente falhava em silêncio: esqueleto eterno em duas abas, sem erro
 * e sem saída. Falhar já é ruim; falhar sem dizer desde quando o número na
 * tela é velho, e sem oferecer o caminho que ainda funciona, é pior.
 */
describe("Estado de falha", () => {
  beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(AGORA));
  afterEach(() => jest.restoreAllMocks());

  it("diz o que aconteceu e oferece tentar de novo", () => {
    const onRetry = jest.fn();
    const { getByText, getByLabelText } = render(
      <ErrorState message="O servidor demorou a responder." onRetry={onRetry} />,
    );

    expect(getByText("O servidor demorou a responder.")).toBeTruthy();
    fireEvent.press(getByLabelText("Tentar de novo"));
    expect(onRetry).toHaveBeenCalled();
  });

  it("com a hora da última leitura boa, diz desde quando", () => {
    const { getByText } = render(
      <ErrorState
        message="Não foi possível carregar."
        onRetry={jest.fn()}
        lastGoodAt={AGORA - 2 * 60 * 60_000}
      />,
    );

    expect(getByText("última leitura boa há 2 h")).toBeTruthy();
  });

  it("sem hora informada, não inventa carimbo nenhum", () => {
    // Tela que nunca carregou não tem leitura boa; escrever "sem leitura
    // ainda" numa falha seria ruído em cima de erro
    const { queryByText } = render(
      <ErrorState message="Não foi possível carregar." onRetry={jest.fn()} />,
    );

    expect(queryByText(/última leitura boa/)).toBeNull();
    expect(queryByText(/sem leitura ainda/)).toBeNull();
  });

  it("oferece o caminho que NÃO depende do que falhou", () => {
    const onFallback = jest.fn();
    const { getByLabelText } = render(
      <ErrorState
        message="Não foi possível carregar."
        onRetry={jest.fn()}
        fallbackLabel="Importar extrato de um arquivo"
        onFallback={onFallback}
      />,
    );

    fireEvent.press(getByLabelText("Importar extrato de um arquivo"));

    expect(onFallback).toHaveBeenCalled();
  });

  it("sem caminho alternativo, nenhum botão a mais aparece", () => {
    const { queryByLabelText } = render(
      <ErrorState message="Não foi possível carregar." onRetry={jest.fn()} />,
    );

    expect(queryByLabelText("Importar extrato de um arquivo")).toBeNull();
  });

  it("o rótulo sozinho, sem ação, não vira botão morto", () => {
    // Botão que não faz nada é pior que botão nenhum
    const { queryByLabelText } = render(
      <ErrorState
        message="Não foi possível carregar."
        onRetry={jest.fn()}
        fallbackLabel="Importar extrato de um arquivo"
      />,
    );

    expect(queryByLabelText("Importar extrato de um arquivo")).toBeNull();
  });

  it("na versão compacta, a lista velha continua e o carimbo entra junto", () => {
    const { getByText } = render(
      <ErrorState
        compact
        message="Não foi possível atualizar."
        onRetry={jest.fn()}
        lastGoodAt={AGORA - 30 * 60_000}
      />,
    );

    expect(getByText("Não foi possível atualizar.")).toBeTruthy();
    expect(getByText("na tela, há 30 min")).toBeTruthy();
  });
});
