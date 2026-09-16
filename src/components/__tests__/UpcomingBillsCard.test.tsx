import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import UpcomingBillsCard from "../UpcomingBillsCard";
import InstallmentsCard from "../InstallmentsCard";
import type { UpcomingItem, UpcomingOverview } from "../../utils/upcoming";
import type { InstallmentsSummary } from "../../utils/installments";

/**
 * Os dois blocos que o dono pediu na Home: o que vence e os parcelamentos.
 *
 * <p>Antes deles, "a vencer" era um total com o nome da próxima conta — dava
 * para saber que vinha algo, não o quê nem quando — e os parcelamentos eram um
 * número sem toque dentro do bloco do calendário, que sumia junto com ele
 * quando o mês não tinha movimento.
 *
 * <p>O que os testes guardam é o que a tela promete: nome e data por linha, o
 * destaque de quem vence logo, "a confirmar" em vez de zero para o que não tem
 * valor, e o olhinho calando os números — inclusive para o leitor de tela.
 */
const item = (over: Partial<UpcomingItem> = {}): UpcomingItem => ({
  key: over.key ?? "k1",
  kind: "RECURRENCE",
  name: "Aluguel",
  amount: 800,
  estimated: false,
  countsInTotal: true,
  dueDate: "2026-09-25",
  daysUntil: 9,
  detail: "Vence em 9 dias, 25 de set",
  target: { route: "Recorrências", seriesId: "s1" },
  ...over,
});

const overview = (over: Partial<UpcomingOverview> = {}): UpcomingOverview => ({
  soon: [],
  later: [],
  total: 0,
  count: 0,
  unpricedCount: 0,
  installments: null,
  ...over,
});

describe("UpcomingBillsCard", () => {
  it("lista cada conta com nome e data, e não só o total", () => {
    const fatura = item({
      key: "f1",
      kind: "INVOICE",
      name: "Fatura Nubank",
      amount: 432.1,
      daysUntil: 0,
      dueDate: "2026-09-16",
      detail: "Vence hoje, 16 de set",
      target: { route: "Cartões", accountId: "a1" },
    });

    render(
      <UpcomingBillsCard
        overview={overview({ soon: [fatura, item()], total: 1232.1, count: 2 })}
        showValues
        onPressItem={jest.fn()}
        onPressAll={jest.fn()}
      />,
    );

    expect(screen.getByText("Fatura Nubank")).toBeTruthy();
    expect(screen.getByText("Aluguel")).toBeTruthy();
    // A pílula fala em "hoje", não em data — quem vence hoje não precisa que
    // ninguém faça a subtração
    expect(screen.getByText("hoje")).toBeTruthy();
  });

  /**
   * O que não tem valor estimado aparece de todo jeito. Esconder a conta
   * porque não se sabe quanto ela vai custar é perder justamente o aviso de
   * que ela vem.
   */
  it("conta sem valor estimado aparece como 'a confirmar' e fora do total", () => {
    render(
      <UpcomingBillsCard
        overview={overview({
          soon: [item({ name: "Luz", amount: null, countsInTotal: false })],
          total: 0,
          count: 1,
          unpricedCount: 1,
        })}
        showValues
        onPressItem={jest.fn()}
        onPressAll={jest.fn()}
      />,
    );

    expect(screen.getByText("a confirmar")).toBeTruthy();
    expect(
      screen.getByText(/não entra no total|não entram no total/),
    ).toBeTruthy();
  });

  it("cada linha leva ao lugar onde ela se resolve", () => {
    const onPressItem = jest.fn();
    const fatura = item({
      key: "f1",
      kind: "INVOICE",
      name: "Fatura Nubank",
      target: { route: "Cartões", accountId: "a1" },
    });

    render(
      <UpcomingBillsCard
        overview={overview({ soon: [fatura], total: 100, count: 1 })}
        showValues
        onPressItem={onPressItem}
        onPressAll={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByText("Fatura Nubank"));

    expect(onPressItem).toHaveBeenCalledWith(
      expect.objectContaining({ target: { route: "Cartões", accountId: "a1" } }),
    );
  });

  /** Parcelas já estão dentro da fatura: entram como nota, nunca no total. */
  it("as parcelas da fatura entram como nota de rodapé", () => {
    render(
      <UpcomingBillsCard
        overview={overview({
          soon: [item()],
          total: 800,
          count: 1,
          installments: { amount: 412, count: 3 },
        })}
        showValues
        onPressItem={jest.fn()}
        onPressAll={jest.fn()}
      />,
    );

    expect(screen.getByText(/já dentro da fatura/)).toBeTruthy();
  });

  it("com o olhinho fechado, nem a tela nem o leitor falam o valor", () => {
    render(
      <UpcomingBillsCard
        overview={overview({ soon: [item()], total: 800, count: 1 })}
        showValues={false}
        onPressItem={jest.fn()}
        onPressAll={jest.fn()}
      />,
    );

    expect(screen.queryByText(/800/)).toBeNull();
    // Dois rótulos calam o valor: o do card (o total) e o da linha. Os dois
    // precisam calar — o leitor de tela não pode ser a fresta por onde o
    // número escapa
    expect(screen.getAllByLabelText(/valor oculto/)).toHaveLength(2);
  });
});

const resumo = (over: Partial<InstallmentsSummary> = {}): InstallmentsSummary => ({
  open: [],
  count: 0,
  monthlyLoad: 0,
  remainingTotal: 0,
  ...over,
});

const serie = () => ({
  key: "Mercadolivre|2026-08",
  description: "Mercadolivre*Bwgshop",
  total: 3,
  paid: 2,
  remaining: 1,
  installmentAmount: 199.96,
  remainingAmount: 199.96,
  nextMonth: "2026-10",
  lastMonth: "2026-10",
  progress: 2 / 3,
});

describe("InstallmentsCard", () => {
  /**
   * A manchete é a CARGA MENSAL, não o total a pagar: é ela que responde "por
   * que a minha fatura nunca baixa". O total vem depois, como contexto.
   */
  it("a manchete é quanto as parcelas travam por mês", () => {
    render(
      <InstallmentsCard
        summary={resumo({
          open: [serie()],
          count: 1,
          monthlyLoad: 199.96,
          remainingTotal: 199.96,
        })}
        showValues
        onPressAll={jest.fn()}
      />,
    );

    expect(screen.getByText(/por mês/)).toBeTruthy();
    expect(screen.getByText("1 parcelamento em andamento")).toBeTruthy();
  });

  it("mostra o progresso de cada compra, e o que falta", () => {
    render(
      <InstallmentsCard
        summary={resumo({
          open: [serie()],
          count: 1,
          monthlyLoad: 199.96,
          remainingTotal: 199.96,
        })}
        showValues
        onPressAll={jest.fn()}
      />,
    );

    expect(screen.getByText(/2 de 3 pagas/)).toBeTruthy();
    expect(screen.getByText(/falta 1/)).toBeTruthy();
  });
});
