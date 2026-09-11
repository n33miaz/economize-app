import React from "react";
import { fireEvent, render } from "@testing-library/react-native";

import SubscriptionsCard from "../SubscriptionsCard";
import type { Subscription, SubscriptionReport } from "../../services/api";

const assinatura = (patch: Partial<Subscription> = {}): Subscription => ({
  seriesId: "s1",
  name: "Spotify",
  category: "Lazer",
  monthlyAmount: 23.9,
  yearlyAmount: 286.8,
  occurrences: 12,
  firstSeenAt: "2025-09-01T00:00:00Z",
  lastSeenAt: "2026-09-01T00:00:00Z",
  silent: false,
  ...patch,
});

const relatorio = (patch: Partial<SubscriptionReport> = {}): SubscriptionReport => ({
  seriesExamined: 24,
  subscriptions: 1,
  yearlyTotal: 286.8,
  silentCount: 0,
  details: [assinatura()],
  ...patch,
});

/**
 * EC-203 na tela.
 *
 * O que se prova aqui é a decisão que o card existe para carregar: o número
 * que chega primeiro é o ANUAL, porque é ele que faz alguém cancelar.
 */
describe("Card de assinaturas", () => {
  it("o número grande é o anual, não o mensal", () => {
    const { getByLabelText } = render(
      <SubscriptionsCard report={relatorio()} onOpen={jest.fn()} />,
    );

    // O título fala o ano; o mensal só aparece como apoio. Trocar os dois é
    // exatamente o que faz a lista do concorrente não mover ninguém
    expect(getByLabelText(/R\$\s?286,80 por ano em 1 assinatura/)).toBeTruthy();
  });

  it("a linha de apoio traz a contagem e o equivalente mensal", () => {
    const { getByText } = render(
      <SubscriptionsCard
        report={relatorio({ subscriptions: 2, yearlyTotal: 646.8 })}
        onOpen={jest.fn()}
      />,
    );

    expect(getByText(/2 assinaturas · R\$\s?53,90 por mês/)).toBeTruthy();
  });

  it("sem assinatura, o denominador prova que o filtro trabalhou", () => {
    const { getByText } = render(
      <SubscriptionsCard
        report={relatorio({ subscriptions: 0, yearlyTotal: 0, details: [] })}
        onOpen={jest.fn()}
      />,
    );

    expect(getByText("Olhei 24 séries e nenhuma tem cara de assinatura.")).toBeTruthy();
  });

  it("sem série nenhuma, a frase não acusa um filtro que não rodou", () => {
    const { getByText } = render(
      <SubscriptionsCard
        report={relatorio({ seriesExamined: 0, subscriptions: 0, details: [] })}
        onOpen={jest.fn()}
      />,
    );

    expect(
      getByText("Ainda não há séries suficientes para reconhecer uma assinatura."),
    ).toBeTruthy();
  });

  it("enquanto a busca não voltou, o card não afirma nada", () => {
    const { toJSON } = render(<SubscriptionsCard report={null} onOpen={jest.fn()} />);

    expect(toJSON()).toBeNull();
  });

  it("a parada há mais de 45 dias ganha selo e rodapé", () => {
    const { getByText } = render(
      <SubscriptionsCard
        report={relatorio({
          silentCount: 1,
          details: [assinatura({ silent: true })],
        })}
        onOpen={jest.fn()}
      />,
    );

    expect(getByText("parada")).toBeTruthy();
    expect(getByText("1 delas não cobra há mais de 45 dias.")).toBeTruthy();
  });

  it("tocar numa assinatura abre a série dela", () => {
    const abrir = jest.fn();
    const { getByLabelText } = render(
      <SubscriptionsCard report={relatorio()} onOpen={abrir} />,
    );

    fireEvent.press(getByLabelText(/Spotify:/));

    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ seriesId: "s1" }));
  });

  it("quem ouve recebe mensal e anual na mesma frase", () => {
    const { getByLabelText } = render(
      <SubscriptionsCard report={relatorio()} onOpen={jest.fn()} />,
    );

    expect(
      getByLabelText(/Spotify: R\$\s?23,90 por mês, R\$\s?286,80 por ano/),
    ).toBeTruthy();
  });

  it("assinatura sem categoria não vira espaço vazio", () => {
    const { getByText } = render(
      <SubscriptionsCard
        report={relatorio({ details: [assinatura({ category: null })] })}
        onOpen={jest.fn()}
      />,
    );

    expect(getByText(/Sem categoria/)).toBeTruthy();
  });
});
