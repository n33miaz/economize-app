import React from "react";
import { render } from "@testing-library/react-native";

import OriginBadge from "../OriginBadge";
import type { ConnectorAccount } from "../../services/api";

const cartao: ConnectorAccount = {
  id: "acc-cartao",
  name: "Ultravioleta ····1234",
  type: "CREDIT_CARD",
  institution: "Nubank",
  statementClosingDay: 10,
  statementDueDay: 17,
  linked: true,
};

describe("OriginBadge", () => {
  it("nomeia o cartão e anuncia que aquilo é a origem", () => {
    const tela = render(
      <OriginBadge accountId={cartao.id} account={cartao} />,
    );
    expect(tela.getByText("Ultravioleta ····1234")).toBeTruthy();
    expect(tela.getByLabelText("Origem: Ultravioleta ····1234")).toBeTruthy();
  });

  it("origem nula é frase, não espaço em branco", () => {
    // Estado permanente do histórico anterior à dimensão de conta e de todo
    // upload manual: precisa ler como resposta, nunca como falha
    const tela = render(<OriginBadge accountId={null} account={undefined} />);
    expect(tela.getByText("Origem não informada")).toBeTruthy();
    expect(tela.getByLabelText("Origem não informada")).toBeTruthy();
  });

  it("origem que existe mas não está no mapa NÃO vira 'não informada'", () => {
    // `/accounts` falhou nesta sessão, ou a conta sumiu no provedor: o dado
    // existe e quem não o tem somos nós — as duas frases não podem ser a mesma
    const tela = render(<OriginBadge accountId="acc-sumiu" account={undefined} />);
    expect(tela.getByText("Origem não reconhecida")).toBeTruthy();
  });

  it("conta e cartão são o mesmo selo, com o mesmo peso visual", () => {
    const tela = render(
      <OriginBadge
        accountId="acc-conta"
        account={{
          ...cartao,
          id: "acc-conta",
          name: "Conta ····9911",
          type: "BANK",
        }}
      />,
    );
    expect(tela.getByText("Conta ····9911")).toBeTruthy();
  });
});
