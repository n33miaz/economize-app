import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import PurchaseDayLine from "../PurchaseDayLine";
import { useWishStore } from "../../store/wishStore";
import type { IncomePattern } from "../../services/api";

/**
 * A linha da Home (EC-237): "sáb 03/10 · o vale cai por volta de 28/09".
 *
 * <p>Autossuficiente — lê `useWishStore` sozinha — e só desenha algo com
 * `status === "READY"`. Sem padrão (servidor antigo, histórico curto, sem
 * renda) ela não é lugar de explicar ausência: simplesmente não aparece.
 */

const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const READY: IncomePattern = {
  status: "READY",
  message: null,
  today: "2026-09-15",
  sources: [
    {
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
    },
  ],
  preference: null,
  inferred: null,
  advice: {
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
    explanation: { headline: "Melhor dia para as compras: sáb 03/10", lines: [] },
    basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" },
  },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("PurchaseDayLine", () => {
  it("READY: mostra o dia e o motivo, e navega para a Previsão ao tocar", () => {
    useWishStore.setState({ incomePattern: READY } as never);

    render(<PurchaseDayLine />);

    expect(screen.getByText(/Melhor dia para as compras/)).toBeTruthy();
    expect(screen.getByText("sáb 03/10")).toBeTruthy();
    expect(screen.getByText(/o vale cai por volta de 29\/09/)).toBeTruthy();

    fireEvent.press(screen.getByText(/Melhor dia para as compras/));

    expect(mockNavigate).toHaveBeenCalledWith("Previsão");
  });

  it("sem padrão (servidor antigo ou ainda não buscou), não desenha nada", () => {
    useWishStore.setState({ incomePattern: null } as never);

    const { toJSON } = render(<PurchaseDayLine />);

    expect(toJSON()).toBeNull();
  });

  it("INSUFFICIENT_HISTORY ou NO_INCOME: a Home não explica ausência, só some", () => {
    useWishStore.setState({
      incomePattern: { ...READY, status: "INSUFFICIENT_HISTORY", advice: null },
    } as never);

    const { toJSON } = render(<PurchaseDayLine />);

    expect(toJSON()).toBeNull();
  });
});
