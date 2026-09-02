import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import MealVoucherPrompt from "../MealVoucherPrompt";
import type { MealVoucherAsk } from "../../utils/mealVoucher";

const ask = (over: Partial<MealVoucherAsk> = {}): MealVoucherAsk => ({
  sourceId: "vr-1",
  sourceName: "Vale-refeição",
  landedOn: "2026-08-25",
  daysAgo: 3,
  amount: 600,
  ...over,
});

describe("MealVoucherPrompt (EC-137)", () => {
  it("não ocupa espaço quando não há o que pedir", () => {
    const { toJSON } = render(
      <MealVoucherPrompt ask={null} onImport={jest.fn()} onDismiss={jest.fn()} />,
    );
    expect(toJSON()).toBeNull();
  });

  it("diz o que caiu, quando e quanto", () => {
    const { getByText } = render(
      <MealVoucherPrompt
        ask={ask()}
        onImport={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );

    expect(getByText("Vale-refeição já caiu")).toBeTruthy();
    expect(getByText(/Entrou há 3 dias \(25\/08\)/)).toBeTruthy();
    expect(getByText(/R\$\s600,00/)).toBeTruthy();
    // A regra do EC-135 na frase: o gasto do vale é do ciclo seguinte
    expect(getByText(/pertence ao próximo ciclo/)).toBeTruthy();
  });

  it("fonte não confirmada não exibe valor nenhum", () => {
    const { queryByText } = render(
      <MealVoucherPrompt
        ask={ask({ amount: null })}
        onImport={jest.fn()}
        onDismiss={jest.fn()}
      />,
    );
    expect(queryByText(/R\$/)).toBeNull();
  });

  it("leva para a importação e sabe ser dispensado", () => {
    const onImport = jest.fn();
    const onDismiss = jest.fn();
    const { getByLabelText } = render(
      <MealVoucherPrompt ask={ask()} onImport={onImport} onDismiss={onDismiss} />,
    );

    fireEvent.press(getByLabelText("Importar extrato"));
    expect(onImport).toHaveBeenCalledTimes(1);

    // Aviso sem saída fica na tela para sempre e ensina a ignorar o próximo
    fireEvent.press(getByLabelText("Agora não"));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
