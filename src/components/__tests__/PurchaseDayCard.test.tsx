import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import PurchaseDayCard from "../PurchaseDayCard";
import { usePreferencesStore } from "../../store/preferencesStore";
import type {
  IncomePattern,
  IncomeSourcePattern,
  PurchaseAdvice,
} from "../../services/api";

/**
 * O card do melhor dia de compra (EC-237).
 *
 * <p>O que ele promete, e o que a suíte guarda: nunca uma data sem o selo de
 * origem ao lado (medido é uma coisa, informado é outra — EC-206), nunca fingir
 * saber quando faltam menos de três meses de histórico, e o aviso de
 * recálculo (EC-202) aparecendo com todas as letras em vez de trocar o número
 * em silêncio.
 */

function advice(over: Partial<PurchaseAdvice> = {}): PurchaseAdvice {
  return {
    cadence: "MONTHLY",
    cadenceOrigin: "MEASURED",
    paymentMode: "CASH",
    bestDay: "2026-10-03",
    bestDayWeekday: "SATURDAY",
    fundingSource: "MEAL_VOUCHER",
    fundingDate: "2026-09-29",
    mustLastUntil: "2026-11-09",
    daysToCover: 37,
    card: null,
    weeklyDay: null,
    nextDates: [],
    confidence: "MEDIUM",
    explanation: {
      headline: "Melhor dia para as compras: sáb 03/10",
      lines: ["Seu salário cai por volta do 5º dia útil — em outubro isso dá 07/10."],
    },
    basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" },
    ...over,
  };
}

function source(over: Partial<IncomeSourcePattern> = {}): IncomeSourcePattern {
  return {
    incomeSourceId: "src-1",
    seriesId: "ser-1",
    kind: "MEAL_VOUCHER",
    name: "Flash — Vale refeição",
    confirmed: true,
    origin: "MEASURED",
    pattern: {
      rule: "BUSINESS_DAY_FROM_END",
      median: 2,
      min: 1,
      max: 3,
      monthsObserved: 3,
      firstOccurrence: "2026-06-25",
      lastOccurrence: "2026-08-28",
      expectedAmount: 735,
      confidence: "MEDIUM",
      label: "nos últimos dias úteis do mês",
    },
    occurrences: [],
    relation: null,
    upcoming: [
      {
        month: "2026-09",
        expected: "2026-09-29",
        earliest: "2026-09-25",
        latest: "2026-09-30",
        adjusted: false,
      },
    ],
    ...over,
  };
}

function pattern(over: Partial<IncomePattern> = {}): IncomePattern {
  return {
    status: "READY",
    message: null,
    today: "2026-09-15",
    sources: [source()],
    preference: null,
    inferred: null,
    advice: advice(),
    ...over,
  };
}

const montar = (p: IncomePattern, onAdjust = jest.fn(), onRegisterIncome = jest.fn()) =>
  render(
    <PurchaseDayCard
      pattern={p}
      onAdjust={onAdjust}
      onRegisterIncome={onRegisterIncome}
    />,
  );

beforeEach(() => {
  usePreferencesStore.setState({ lastPurchaseAdvice: null } as never);
});

describe("PurchaseDayCard", () => {
  it("READY com fonte medida veste o selo 'medido'", () => {
    montar(pattern());

    expect(screen.getByText("sáb 03/10")).toBeTruthy();
    expect(screen.getByText("medido")).toBeTruthy();
    expect(screen.getByText(/precisa durar até 09\/11/)).toBeTruthy();
    expect(screen.getByText(/37 dias/)).toBeTruthy();
  });

  it("fonte INFORMED veste o selo 'informado' em destaque de aviso", () => {
    montar(
      pattern({
        sources: [source({ origin: "INFORMED" })],
      }),
    );

    expect(screen.getByText("informado")).toBeTruthy();
  });

  it("INSUFFICIENT_HISTORY nunca inventa uma data", () => {
    montar(
      pattern({
        status: "INSUFFICIENT_HISTORY",
        message: "Vi só 2 pagamentos; a partir de 3 meses eu digo o padrão.",
        advice: null,
      }),
    );

    expect(screen.getByText("Ainda não dá para dizer")).toBeTruthy();
    expect(
      screen.getByText("Vi só 2 pagamentos; a partir de 3 meses eu digo o padrão."),
    ).toBeTruthy();
    // Nenhuma data grande de recomendação nesse estado
    expect(screen.queryByText("sáb 03/10")).toBeNull();
  });

  it("NO_INCOME oferece a ação de cadastrar renda", () => {
    const onRegisterIncome = jest.fn();
    montar(
      pattern({ status: "NO_INCOME", advice: null, sources: [] }),
      jest.fn(),
      onRegisterIncome,
    );

    const botao = screen.getByText("Cadastrar renda");
    fireEvent.press(botao);

    expect(onRegisterIncome).toHaveBeenCalled();
  });

  it("CARD_CYCLE_UNKNOWN explica que não sabe quando o cartão fecha", () => {
    montar(
      pattern({
        status: "CARD_CYCLE_UNKNOWN",
        message: "Não sei quando seu cartão fecha.",
        advice: null,
      }),
    );

    expect(screen.getByText("Não sei quando seu cartão fecha")).toBeTruthy();
  });

  it("botão 'Ajustar como você compra' aciona onAdjust", () => {
    const onAdjust = jest.fn();
    montar(pattern(), onAdjust);

    fireEvent.press(screen.getByText("Ajustar como você compra"));

    expect(onAdjust).toHaveBeenCalled();
  });

  /**
   * EC-202: a data mudou porque uma queda nova entrou no extrato. O card
   * precisa dizer isso com todas as letras, não trocar o número em silêncio.
   */
  it("avisa quando a recomendação mudou por causa de uma queda nova", () => {
    usePreferencesStore.setState({
      lastPurchaseAdvice: {
        bestDay: "2026-09-27",
        basisLastOccurrence: "2026-07-29",
        seenAt: "2026-09-01T00:00:00.000Z",
      },
    } as never);

    montar(
      pattern({
        advice: advice({
          bestDay: "2026-10-03",
          basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" },
        }),
      }),
    );

    expect(
      screen.getByText(/Recalculado depois que o vale de 28\/08 entrou/),
    ).toBeTruthy();
  });

  it("sem mudança real, não mostra aviso nenhum", () => {
    usePreferencesStore.setState({
      lastPurchaseAdvice: {
        bestDay: "2026-10-03",
        basisLastOccurrence: "2026-08-28",
        seenAt: "2026-09-01T00:00:00.000Z",
      },
    } as never);

    montar(pattern());

    expect(screen.queryByText(/Recalculado/)).toBeNull();
  });

  it("aviso de fatura vencendo antes do salário", () => {
    montar(
      pattern({
        advice: advice({
          paymentMode: "CARD",
          card: {
            accountId: "acc-1",
            name: "Nubank",
            closingDay: 10,
            nextClosing: "2026-10-10",
            invoiceDue: "2026-10-17",
            paidBySalaryOn: null,
            warning: "a fatura vence antes do salário cair",
          },
        }),
      }),
    );

    expect(
      screen.getByText("a fatura vence antes do salário cair"),
    ).toBeTruthy();
  });
});
