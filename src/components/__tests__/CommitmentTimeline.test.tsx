import React from "react";
import { render } from "@testing-library/react-native";

import CommitmentTimeline, {
  type CommitmentMonth,
} from "../CommitmentTimeline";

const mes = (
  month: string,
  label: string,
  installments = 0,
  invoice = 0,
  recurring = 0,
): CommitmentMonth => ({ month, label, installments, invoice, recurring });

/**
 * EC-226 — seis meses à frente, e o que já tem dono em cada um.
 *
 * É a melhor peça do Pierre e temos mais matéria-prima: ele projeta só
 * parcelamento, e projeta errado. Nós somamos parcela, fatura prevista e
 * recorrência — as três já medidas.
 */
describe("Linha do tempo de compromisso", () => {
  it("soma as três fontes num total por mês", () => {
    const { getByLabelText } = render(
      <CommitmentTimeline months={[mes("2026-10", "out", 199.96, 800, 120)]} />,
    );

    expect(getByLabelText(/out: R\$\s?1\.119,96 comprometidos/)).toBeTruthy();
  });

  it("mês sem compromisso aparece vazio, NÃO some", () => {
    // Um buraco na sequência faria o eixo mentir sobre a distância entre os
    // meses restantes
    const { getByLabelText, getByText } = render(
      <CommitmentTimeline
        months={[mes("2026-10", "out", 500), mes("2026-11", "nov")]}
      />,
    );

    expect(getByLabelText("nov: nada comprometido")).toBeTruthy();
    expect(getByText("—")).toBeTruthy();
  });

  it("com o olhinho fechado, o valor não aparece", () => {
    const { queryByText, getByText } = render(
      <CommitmentTimeline
        months={[mes("2026-10", "out", 500)]}
        showValues={false}
      />,
    );

    expect(queryByText(/500/)).toBeNull();
    expect(getByText("•••")).toBeTruthy();
  });

  it("sem mês nenhum, não ocupa espaço", () => {
    expect(render(<CommitmentTimeline months={[]} />).toJSON()).toBeNull();
  });

  it("a barra NÃO escreve legenda — a proporção é a leitura", () => {
    const { queryByText } = render(
      <CommitmentTimeline months={[mes("2026-10", "out", 199.96, 800, 120)]} />,
    );

    expect(queryByText(/parcelas/)).toBeNull();
    expect(queryByText(/recorrências/)).toBeNull();
  });

  it("todos os meses da janela aparecem, na ordem recebida", () => {
    const { getByText } = render(
      <CommitmentTimeline
        months={[
          mes("2026-10", "out", 100),
          mes("2026-11", "nov", 200),
          mes("2026-12", "dez", 300),
        ]}
      />,
    );

    expect(getByText("out")).toBeTruthy();
    expect(getByText("nov")).toBeTruthy();
    expect(getByText("dez")).toBeTruthy();
  });
});
