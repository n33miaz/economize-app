import React from "react";
import { render } from "@testing-library/react-native";

import ShoppingBudgetBar from "../ShoppingBudgetBar";
import { formatBRL } from "../../utils/money";

describe("ShoppingBudgetBar", () => {
  it("sem orçamento não desenha nada — um teto inventado seria mentira", () => {
    const { toJSON } = render(<ShoppingBudgetBar total={50} budget={null} />);
    expect(toJSON()).toBeNull();
  });

  it("dentro do orçamento diz quanto falta", () => {
    const { getByText, getByLabelText } = render(
      <ShoppingBudgetBar total={60} budget={100} />,
    );
    expect(getByText(`faltam ${formatBRL(40)} do orçamento de ${formatBRL(100)}`)).toBeTruthy();
    expect(getByLabelText(/faltam/).props.accessibilityValue).toEqual({ min: 0, max: 100, now: 60 });
  });

  it("estourou: diz quanto passou e a barra para em 100%", () => {
    const { getByText, getByLabelText } = render(
      <ShoppingBudgetBar total={130} budget={100} />,
    );
    expect(getByText(`passou ${formatBRL(30)} do orçamento de ${formatBRL(100)}`)).toBeTruthy();
    expect(getByLabelText(/passou/).props.accessibilityValue.now).toBe(100);
  });
});
