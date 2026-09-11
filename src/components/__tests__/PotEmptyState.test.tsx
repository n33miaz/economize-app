import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import PotEmptyState from "../PotEmptyState";
import { darkTheme } from "../../theme/colors";

/**
 * EC-231 — o vazio contado pelo pote.
 *
 * O que se prova aqui é que o nível não é decorativo: cada situação tem o seu,
 * e um pote cheio anunciando "você ainda não importou nada" seria mentira
 * desenhada.
 */
describe("Vazio com o pote", () => {
  const desenho = (arvore: ReturnType<typeof render>) =>
    JSON.stringify(arvore.toJSON());

  /**
   * O react-native-svg serializa cor como inteiro ARGB, não como o hexa do
   * token. Converter aqui é mais honesto do que copiar o número mágico: o
   * teste continua falando na linguagem do tema.
   */
  const comoOSvgGrava = (hex: string) =>
    String(0xff000000 + parseInt(hex.replace("#", ""), 16));

  it("começar mostra o pote VAZIO — a frase fica livre para dizer o que fazer", () => {
    const vazio = desenho(
      render(<PotEmptyState mood="comecar" title="t" body="b" />),
    );
    const cheio = desenho(
      render(<PotEmptyState mood="conquistado" title="t" body="b" />),
    );

    expect(vazio).not.toEqual(cheio);
  });

  it("conquistado veste o token de sucesso", () => {
    expect(
      desenho(render(<PotEmptyState mood="conquistado" title="t" body="b" />)),
    ).toContain(comoOSvgGrava(darkTheme.semantic.success));
  });

  it("atenção veste o token de perigo", () => {
    expect(
      desenho(render(<PotEmptyState mood="atencao" title="t" body="b" />)),
    ).toContain(comoOSvgGrava(darkTheme.semantic.danger));
  });

  it("título e corpo aparecem", () => {
    const { getByText } = render(
      <PotEmptyState
        mood="comecar"
        title="Sua análise começa com um extrato"
        body="Importe e veja seus meses."
      />,
    );

    expect(getByText("Sua análise começa com um extrato")).toBeTruthy();
    expect(getByText("Importe e veja seus meses.")).toBeTruthy();
  });

  it("sem ação, não desenha botão — mas o vazio ainda se explica", () => {
    const { queryByRole, getByText } = render(
      <PotEmptyState mood="sem-movimento" title="Nada neste mês" body="Escolha outro." />,
    );

    expect(queryByRole("button")).toBeNull();
    expect(getByText("Nada neste mês")).toBeTruthy();
  });

  it("com ação, o botão chama de volta — o vazio não é um beco", () => {
    const agir = jest.fn();
    const { getByLabelText } = render(
      <PotEmptyState
        mood="comecar"
        title="t"
        body="b"
        actionLabel="Importar extrato"
        onAction={agir}
      />,
    );

    fireEvent.press(getByLabelText("Importar extrato"));

    expect(agir).toHaveBeenCalled();
  });

  it("o segundo caminho só existe ao lado do primeiro", () => {
    const conectar = jest.fn();
    const cadastrar = jest.fn();
    const { getByLabelText, queryByLabelText, rerender } = render(
      <PotEmptyState
        mood="comecar"
        title="t"
        body="b"
        actionLabel="Conectar banco"
        onAction={conectar}
        secondaryActionLabel="Cadastrar à mão"
        onSecondaryAction={cadastrar}
      />,
    );

    fireEvent.press(getByLabelText("Cadastrar à mão"));
    expect(cadastrar).toHaveBeenCalled();
    expect(conectar).not.toHaveBeenCalled();

    // Sozinho, o segundo caminho não é desenhado: sem o primeiro ele seria o
    // primeiro, e quem quer um botão só passa `actionLabel`
    rerender(
      <PotEmptyState
        mood="comecar"
        title="t"
        body="b"
        secondaryActionLabel="Cadastrar à mão"
        onSecondaryAction={cadastrar}
      />,
    );
    expect(queryByLabelText("Cadastrar à mão")).toBeNull();
  });

  it("quem ouve recebe título e corpo numa frase só", () => {
    const { getByLabelText } = render(
      <PotEmptyState mood="comecar" title="Comece aqui" body="Importe um extrato." />,
    );

    expect(getByLabelText("Comece aqui. Importe um extrato.")).toBeTruthy();
  });
});
