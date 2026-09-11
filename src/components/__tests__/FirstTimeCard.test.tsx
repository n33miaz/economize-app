import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import FirstTimeCard from "../FirstTimeCard";
import { usePreferencesStore } from "../../store/preferencesStore";

/**
 * EC-228 — a primeira vez de cada tela explica.
 *
 * Não é tour: tour é pedágio, aparece quando a pessoa quer usar o app e é
 * sempre no momento errado. É um cartão dentro da tela que ele explica, na
 * posição onde a dúvida acontece.
 */
describe("Cartão de primeira vez", () => {
  beforeEach(() => {
    usePreferencesStore.setState({ dismissedHints: [] });
  });

  it("aparece na primeira vez, com título e uma frase", () => {
    const { getByText } = render(
      <FirstTimeCard
        id="calendario"
        title="O calendário do mês"
        body="Cada quadradinho é um dia; quanto mais escuro, mais você gastou nele."
      />,
    );

    expect(getByText("O calendário do mês")).toBeTruthy();
    expect(getByText(/quanto mais escuro/)).toBeTruthy();
  });

  it("dispensar some com ele NA HORA", () => {
    const { getByLabelText, queryByText } = render(
      <FirstTimeCard id="calendario" title="O calendário do mês" body="Uma frase." />,
    );

    fireEvent.press(getByLabelText("Dispensar explicação: O calendário do mês"));

    expect(queryByText("O calendário do mês")).toBeNull();
  });

  it("dispensado NÃO volta na próxima montagem", () => {
    // Um cartão que volta ensina que o X não funciona — e a partir daí o
    // usuário para de fechar qualquer coisa
    usePreferencesStore.getState().dismissHint("calendario");

    const { toJSON } = render(
      <FirstTimeCard id="calendario" title="O calendário do mês" body="Uma frase." />,
    );

    expect(toJSON()).toBeNull();
  });

  it("dispensar um cartão não some com os outros", () => {
    usePreferencesStore.getState().dismissHint("calendario");

    const { getByText } = render(
      <FirstTimeCard id="parcelamentos" title="Parcelamentos" body="Uma frase." />,
    );

    expect(getByText("Parcelamentos")).toBeTruthy();
  });

  it("dispensar duas vezes não duplica o registro", () => {
    usePreferencesStore.getState().dismissHint("calendario");
    usePreferencesStore.getState().dismissHint("calendario");

    expect(usePreferencesStore.getState().dismissedHints).toEqual(["calendario"]);
  });
});
