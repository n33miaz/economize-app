import React from "react";
import { render } from "@testing-library/react-native";

import DebtBreakdown from "../DebtBreakdown";
import { usePreferencesStore } from "../../store/preferencesStore";
import type { DebtOverview } from "../../services/api";

const overview: DebtOverview = {
  month: "2026-08",
  start: "2026-08-01",
  end: "2026-08-31",
  totalExpense: 5100,
  totalDebt: 2040,
  shareOfExpense: 40,
  revolvingAlert: false,
  groups: [
    {
      kind: "FINANCING",
      total: 1200,
      count: 1,
      items: [
        {
          transactionId: "t1",
          description: "Financiamento do carro",
          amount: 1200,
          date: "2026-08-10",
          installment: 7,
          total: 48,
          remaining: 41,
        },
      ],
    },
    {
      kind: "INSTALLMENT",
      total: 840,
      count: 2,
      items: [],
    },
  ],
};

describe("DebtBreakdown por profundidade de leitura (EC-142)", () => {
  beforeEach(() => {
    usePreferencesStore.getState().reset();
  });

  it("na visão simples mostra o total e explica, sem taxonomia", () => {
    const { getByText, queryByText } = render(
      <DebtBreakdown debt={overview} />,
    );

    expect(getByText("R$ 2.040,00")).toBeTruthy();
    expect(getByText(/compromisso assumido antes/)).toBeTruthy();
    // "Financiamento" e "Parcelamento" são a leitura avançada
    expect(queryByText("Financiamento")).toBeNull();
  });

  it("na visão avançada devolve a quebra por tipo", () => {
    usePreferencesStore.getState().setViewDepth("advanced");
    const { getByText, queryByText } = render(
      <DebtBreakdown debt={overview} />,
    );

    expect(getByText("Financiamento")).toBeTruthy();
    expect(getByText("R$ 1.200,00")).toBeTruthy();
    expect(queryByText(/compromisso assumido antes/)).toBeNull();
  });

  it("sem dívida nenhuma não desenha nada nos dois modos", () => {
    // Um card dizendo "R$ 0,00 em dívidas" ocupa espaço para não informar
    const vazio = { ...overview, totalDebt: 0, groups: [] };
    expect(render(<DebtBreakdown debt={vazio} />).toJSON()).toBeNull();
    usePreferencesStore.getState().setViewDepth("advanced");
    expect(render(<DebtBreakdown debt={vazio} />).toJSON()).toBeNull();
  });
});
