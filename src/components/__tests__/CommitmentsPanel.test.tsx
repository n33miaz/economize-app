import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import CommitmentsPanel from "../CommitmentsPanel";
import type { CommitmentsPanel as Panel, CommitmentMonth } from "../../services/api";

const mes = (over: Partial<CommitmentMonth>): CommitmentMonth => ({
  month: "2026-12",
  partial: false,
  installments: 100,
  debts: 800,
  total: 900,
  shareOfIncome: 18,
  aboveThreshold: false,
  ...over,
});

const painel = (over: Partial<Panel> = {}): Panel => ({
  thresholdPct: 40,
  income: { amount: 5000, origin: "SOURCES", sources: 1 },
  months: [
    mes({ month: "2026-11", partial: true, total: 850, shareOfIncome: 17 }),
    mes({}),
  ],
  peakSharePct: 18,
  aboveThreshold: false,
  ...over,
});

describe("CommitmentsPanel", () => {
  it("lista os meses com valor e percentual, sem aviso abaixo do limite", () => {
    const { getByText, queryByText } = render(
      <CommitmentsPanel panel={painel()} onRegisterIncome={jest.fn()} />,
    );

    expect(getByText("Parcelas e compromissos")).toBeTruthy();
    expect(getByText(/restante/)).toBeTruthy();
    expect(getByText("R$ 900,00")).toBeTruthy();
    expect(getByText("18%")).toBeTruthy();
    expect(getByText(/Renda de R\$ 5\.000,00 · cadastrada/)).toBeTruthy();
    expect(queryByText(/Passa de/)).toBeNull();
  });

  it("avisa quando passa do limite e diz que é referência", () => {
    const { getByText } = render(
      <CommitmentsPanel
        panel={painel({
          income: { amount: 2000, origin: "MEASURED", sources: 1 },
          months: [mes({ total: 900, shareOfIncome: 45, aboveThreshold: true })],
          peakSharePct: 45,
          aboveThreshold: true,
        })}
        onRegisterIncome={jest.fn()}
      />,
    );

    expect(getByText("Passa de 40% da renda em 1 mês")).toBeTruthy();
    expect(getByText(/referência, não uma regra/)).toBeTruthy();
    expect(getByText("45%")).toBeTruthy();
    expect(getByText(/medida no extrato/)).toBeTruthy();
  });

  it("sem renda não mostra percentual e leva ao cadastro", () => {
    const onRegisterIncome = jest.fn();
    const { getByText, queryByText } = render(
      <CommitmentsPanel
        panel={painel({
          income: { amount: null, origin: "NONE", sources: 0 },
          months: [mes({ shareOfIncome: null })],
          peakSharePct: null,
        })}
        onRegisterIncome={onRegisterIncome}
      />,
    );

    expect(queryByText("18%")).toBeNull();
    expect(queryByText(/Renda de/)).toBeNull();
    fireEvent.press(getByText("Cadastrar renda"));
    expect(onRegisterIncome).toHaveBeenCalledTimes(1);
  });

  it("some quando não há compromisso nenhum", () => {
    const { toJSON } = render(
      <CommitmentsPanel
        panel={painel({ months: [mes({ total: 0, installments: 0, debts: 0 })] })}
        onRegisterIncome={jest.fn()}
      />,
    );

    expect(toJSON()).toBeNull();
  });
});
