import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import SpendingCalendar from "../SpendingCalendar";
import type { DailyTotal } from "../../services/api";

/** Os três dias reais de setembro/2026 do extrato do dono (Inter). */
const SETEMBRO: DailyTotal[] = [
  { date: "2026-09-04", spent: 157.8, earned: 2813.94, count: 8 },
  { date: "2026-09-05", spent: 3971.83, earned: 957.13, count: 9 },
  { date: "2026-09-08", spent: 188.54, earned: 52.72, count: 7 },
];

/**
 * EC-235 — a grade na tela.
 *
 * A função tem teste próprio; aqui se prova a outra metade: que o mês vira
 * trinta casas navegáveis, que cada dia se anuncia por extenso para quem
 * ouve, e que só o dia COM movimento abre.
 */
describe("Calendário na tela", () => {
  it("cada dia com movimento se anuncia por extenso", () => {
    const { getByLabelText } = render(
      <SpendingCalendar month="2026-09" days={SETEMBRO} />,
    );

    // O valor sai compacto; o que importa é a frase carregar saída E entrada
    expect(getByLabelText(/Dia 4, saída de .*, entrada de /)).toBeTruthy();
    expect(getByLabelText(/Dia 5, saída de /)).toBeTruthy();
  });

  it("dia sem movimento diz que não teve", () => {
    const { getByLabelText } = render(
      <SpendingCalendar month="2026-09" days={SETEMBRO} />,
    );

    expect(getByLabelText("Dia 1, sem movimento")).toBeTruthy();
  });

  it("tocar num dia com movimento abre aquele dia", () => {
    const abrir = jest.fn();
    const { getByLabelText } = render(
      <SpendingCalendar month="2026-09" days={SETEMBRO} onSelectDay={abrir} />,
    );

    fireEvent.press(getByLabelText(/Dia 5, saída de /));

    expect(abrir).toHaveBeenCalledWith("2026-09-05");
  });

  it("dia sem movimento não é botão — não há o que abrir", () => {
    const abrir = jest.fn();
    const { getByLabelText } = render(
      <SpendingCalendar month="2026-09" days={SETEMBRO} onSelectDay={abrir} />,
    );

    fireEvent.press(getByLabelText("Dia 1, sem movimento"));

    expect(abrir).not.toHaveBeenCalled();
  });

  it("o rodapé conta os dias com saída e nomeia o maior", () => {
    const { getByText } = render(
      <SpendingCalendar month="2026-09" days={SETEMBRO} />,
    );

    expect(getByText(/3 dias com saída/)).toBeTruthy();
  });

  it("mês sem saída diz isso em vez de deixar a grade muda", () => {
    const { getByText } = render(
      <SpendingCalendar
        month="2026-09"
        days={[{ date: "2026-09-04", spent: 0, earned: 100, count: 1 }]}
      />,
    );

    expect(getByText("Nenhuma saída neste mês.")).toBeTruthy();
  });

  it("um dia só no singular", () => {
    const { getByText } = render(
      <SpendingCalendar month="2026-09" days={[SETEMBRO[0]]} />,
    );

    expect(getByText(/1 dia com saída/)).toBeTruthy();
  });
});
