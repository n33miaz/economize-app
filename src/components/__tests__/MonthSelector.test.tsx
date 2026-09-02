import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import MonthSelector from "../MonthSelector";
import { formatMonthLabel } from "../../utils/cycleWindow";

/**
 * A fileira de períodos com movimento (EC-092).
 *
 * <p>É por ela que a Análise troca o recorte, e o rótulo muda de significado
 * conforme a âncora do usuário: com âncora no dia 1 o chip é o mês; fora dele,
 * é o ciclo — e o texto falado precisa dizer o recorte por extenso, porque
 * "julho" sozinho seria falso para quem recebe dia 5.
 */
describe("MonthSelector", () => {
  const meses = ["2026-07", "2026-06", "2026-05"];

  it("desenha um chip por período, com o mês por extenso", () => {
    const { getByText } = render(
      <MonthSelector months={meses} selected="2026-07" onSelect={jest.fn()} />,
    );

    // Sem formatador próprio, o rótulo é o mês abreviado ("jul 2026") — a
    // chave crua nunca aparece na tela
    for (const mes of meses) {
      expect(getByText(formatMonthLabel(mes))).toBeTruthy();
    }
  });

  it("tocar num chip escolhe aquele período", () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <MonthSelector months={meses} selected="2026-07" onSelect={onSelect} />,
    );

    fireEvent.press(getByText(formatMonthLabel("2026-06")));

    expect(onSelect).toHaveBeenCalledWith("2026-06");
  });

  it("o chip escolhido é anunciado como escolhido", () => {
    const { getByLabelText } = render(
      <MonthSelector
        months={meses}
        selected="2026-06"
        onSelect={jest.fn()}
        describeOption={(m) => `Período ${m}`}
      />,
    );

    const chip = getByLabelText("Período 2026-06");
    expect(chip.props.accessibilityState?.selected).toBe(true);
  });

  it("com formatador, o chip mostra o rótulo do CICLO e não o mês cru", () => {
    // Fora da âncora dia 1, "julho" sozinho seria falso: o recorte vai de
    // 05/07 a 04/08
    const { getByText, queryByText } = render(
      <MonthSelector
        months={["2026-07"]}
        selected="2026-07"
        onSelect={jest.fn()}
        formatLabel={(m) => `Ciclo de ${m}`}
      />,
    );

    expect(getByText("Ciclo de 2026-07")).toBeTruthy();
    expect(queryByText(formatMonthLabel("2026-07"))).toBeNull();
  });

  it("a descrição falada pode dizer o recorte por extenso", () => {
    const { getByLabelText } = render(
      <MonthSelector
        months={["2026-07"]}
        selected={null}
        onSelect={jest.fn()}
        describeOption={() => "De 05 de julho a 04 de agosto"}
      />,
    );

    expect(getByLabelText("De 05 de julho a 04 de agosto")).toBeTruthy();
  });

  it("sem período nenhum, a fileira não desenha chip", () => {
    const { queryByText } = render(
      <MonthSelector months={[]} selected={null} onSelect={jest.fn()} />,
    );

    expect(queryByText(formatMonthLabel("2026-07"))).toBeNull();
  });

  it("nenhum selecionado é estado válido: nada fica marcado", () => {
    const { getByLabelText } = render(
      <MonthSelector
        months={["2026-07"]}
        selected={null}
        onSelect={jest.fn()}
        describeOption={(m) => `Período ${m}`}
      />,
    );

    expect(getByLabelText("Período 2026-07").props.accessibilityState?.selected)
      .toBe(false);
  });
});
