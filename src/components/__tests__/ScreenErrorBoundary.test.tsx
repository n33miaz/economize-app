import React from "react";
import { Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import ScreenErrorBoundary, { withScreenBoundary } from "../ScreenErrorBoundary";

/**
 * Um erro de renderização numa tela não pode levar o app inteiro embora.
 *
 * Medido em 12/11/2026 pelo roteiro de ponta a ponta: um `toLocaleString` em
 * `null` no cabeçalho de Investimentos desmontava a árvore toda e sobrava a
 * tela de abertura — a pessoa perdia a barra de abas, a Home e o Extrato por
 * causa de um número. Não havia limite nenhum entre a tela e a raiz.
 */
describe("Limite de erro por tela", () => {
  let quebrada = true;
  const Instavel = () => {
    if (quebrada) throw new Error("número nulo no cabeçalho");
    return <Text>Carteira em ordem</Text>;
  };

  beforeEach(() => {
    quebrada = true;
    // o React registra no console o erro que o limite segurou; aqui é esperado
    jest.spyOn(console, "error").mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it("segura o erro da tela e mantém de pé o que está em volta", () => {
    const { getByText, queryByText } = render(
      <>
        <Text>Barra de abas</Text>
        <ScreenErrorBoundary>
          <Instavel />
        </ScreenErrorBoundary>
      </>,
    );

    expect(getByText("Barra de abas")).toBeTruthy();
    expect(getByText("Esta tela falhou")).toBeTruthy();
    expect(queryByText("Carteira em ordem")).toBeNull();
  });

  it("tentar de novo remonta a tela", () => {
    const { getByLabelText, getByText, queryByText } = render(
      <ScreenErrorBoundary>
        <Instavel />
      </ScreenErrorBoundary>,
    );

    quebrada = false;
    fireEvent.press(getByLabelText("Tentar de novo"));

    expect(getByText("Carteira em ordem")).toBeTruthy();
    expect(queryByText("Esta tela falhou")).toBeNull();
  });

  it("se a tela falhar de novo, continua oferecendo a saída", () => {
    const { getByLabelText, getByText } = render(
      <ScreenErrorBoundary>
        <Instavel />
      </ScreenErrorBoundary>,
    );

    fireEvent.press(getByLabelText("Tentar de novo"));

    expect(getByText("Esta tela falhou")).toBeTruthy();
  });

  it("sem erro, a tela aparece como é e recebe as próprias props", () => {
    const Saudacao = ({ nome }: { nome: string }) => <Text>{`Olá, ${nome}`}</Text>;
    const Protegida = withScreenBoundary(Saudacao);

    const { getByText } = render(<Protegida nome="Alice" />);

    expect(getByText("Olá, Alice")).toBeTruthy();
    expect(Protegida.displayName).toBe("ScreenBoundary(Saudacao)");
  });
});
