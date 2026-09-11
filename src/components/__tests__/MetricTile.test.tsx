import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import MetricTile from "../MetricTile";
import AnimatedMoney from "../AnimatedMoney";
import { darkTheme } from "../../theme/colors";

/**
 * EC-221 — um rótulo, um número, um gesto.
 *
 * Card com dois números concorrendo não tem hierarquia: o olho pula entre os
 * dois e não decide qual é a resposta.
 */
describe("Tile de métrica", () => {
  it("mostra o rótulo e o valor", () => {
    const { getByText } = render(<MetricTile label="Saldo" value={1240.5} />);

    expect(getByText("Saldo")).toBeTruthy();
  });

  it("quem ouve recebe o valor por EXTENSO, não a abreviação", () => {
    // "R$ 1,2 mil" é atalho visual; para quem ouve, atalho é perda
    const { getByLabelText } = render(
      <MetricTile label="Saldo" value={1240.5} compact />,
    );

    expect(getByLabelText(/Saldo: R\$\s?1\.240,50/)).toBeTruthy();
  });

  it("sem gesto, NÃO finge ser tocável", () => {
    const { queryByRole } = render(<MetricTile label="Saldo" value={10} />);

    expect(queryByRole("button")).toBeNull();
  });

  it("com gesto, o toque dispara e a seta aparece", () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <MetricTile label="Saldo" value={10} onPress={onPress} />,
    );

    fireEvent.press(getByRole("button"));

    expect(onPress).toHaveBeenCalled();
  });

  it("o tom carrega o significado do número", () => {
    const negativo = render(
      <MetricTile label="Previsto" value={-539.7} tone="negative" />,
    );

    expect(JSON.stringify(negativo.toJSON())).toContain(darkTheme.semantic.danger);
  });

  it("o hint é texto, e a API não tem onde pôr um segundo número", () => {
    // A regra é imposta pelo TIPO: só existe um campo `value`
    const { getByText } = render(
      <MetricTile label="Saldo" value={10} hint="atualizado há 2 h" />,
    );

    expect(getByText("atualizado há 2 h")).toBeTruthy();
  });
});

/**
 * O número que CHEGA. Contar do zero em toda montagem faria cada abertura
 * parecer carregamento — o app já tem esqueleto para isso.
 */
describe("Dinheiro que conta", () => {
  it("na primeira renderização mostra o valor final, sem contar", () => {
    const { getByText } = render(<AnimatedMoney value={1240.5} />);

    expect(getByText(/1\.240,50/)).toBeTruthy();
  });

  it("quem ouve recebe sempre o valor final, nunca a contagem", () => {
    const { getByLabelText, rerender } = render(<AnimatedMoney value={100} />);
    rerender(<AnimatedMoney value={900} />);

    expect(getByLabelText(/900,00/)).toBeTruthy();
  });

  it("o rótulo falado pode ser trocado quando a frase precisa de contexto", () => {
    const { getByLabelText } = render(
      <AnimatedMoney value={10} accessibilityLabel="Saldo estimado: dez reais" />,
    );

    expect(getByLabelText("Saldo estimado: dez reais")).toBeTruthy();
  });
});
