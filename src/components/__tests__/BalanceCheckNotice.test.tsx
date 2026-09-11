import React from "react";
import { render } from "@testing-library/react-native";

import BalanceCheckNotice from "../BalanceCheckNotice";
import type { BalanceFinding } from "../../services/api";

const ZERO_COM_MOVIMENTO: BalanceFinding = {
  accountId: "a1",
  accountName: "Inter ····2750",
  kind: "ZERO_COM_MOVIMENTO",
  reportedBalance: 0,
  reportedAt: "2026-09-10T11:55:00Z",
  movementAfter: null,
  message:
    "A instituição informou saldo R$ 0,00, mas esta conta teve movimento nos últimos 30 dias.",
};

const MOVIMENTO_DEPOIS: BalanceFinding = {
  accountId: "a2",
  accountName: "Nubank ····1234",
  kind: "MOVIMENTO_APOS_LEITURA",
  reportedBalance: 1200,
  reportedAt: "2026-09-10T06:00:00Z",
  movementAfter: -130,
  message: "Entraram lançamentos depois da última leitura de saldo.",
};

describe("Aviso de divergência de saldo", () => {
  it("sem achado, não ocupa espaço nenhum", () => {
    // Aviso vazio na tela é ruído, e ruído tira a força do aviso de verdade
    const { toJSON } = render(<BalanceCheckNotice findings={[]} />);

    expect(toJSON()).toBeNull();
  });

  it("mostra o caso do saldo zero com movimento", () => {
    const { getByText } = render(
      <BalanceCheckNotice findings={[ZERO_COM_MOVIMENTO]} />,
    );

    expect(getByText("Inter ····2750")).toBeTruthy();
    expect(getByText(/movimento nos últimos 30 dias/)).toBeTruthy();
  });

  it("quando há movimento posterior, diz de quanto foi", () => {
    const { getByText } = render(
      <BalanceCheckNotice findings={[MOVIMENTO_DEPOIS]} />,
    );

    expect(getByText(/Desde então: -R\$\s?130,00\./)).toBeTruthy();
  });

  it("a frase vem da API, não da tela", () => {
    // Se a tela reescrevesse a explicação, existiriam duas versões da mesma
    // verdade e uma delas ficaria para trás da regra
    const inventado: BalanceFinding = {
      ...ZERO_COM_MOVIMENTO,
      message: "frase que só existe no servidor",
    };
    const { getByText } = render(<BalanceCheckNotice findings={[inventado]} />);

    expect(getByText("frase que só existe no servidor")).toBeTruthy();
  });

  it("vários achados aparecem juntos, um por linha", () => {
    const { getByText } = render(
      <BalanceCheckNotice findings={[ZERO_COM_MOVIMENTO, MOVIMENTO_DEPOIS]} />,
    );

    expect(getByText("Inter ····2750")).toBeTruthy();
    expect(getByText("Nubank ····1234")).toBeTruthy();
  });

  it("quem usa leitor de tela recebe o bloco como alerta", () => {
    const { getByRole } = render(
      <BalanceCheckNotice findings={[ZERO_COM_MOVIMENTO]} />,
    );

    expect(getByRole("alert")).toBeTruthy();
  });
});
