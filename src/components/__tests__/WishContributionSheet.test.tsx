import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import WishContributionSheet from "../WishContributionSheet";
import { contributeToWish, getWishContributions } from "../../services/api";
import type { Wish, WishContribution } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  contributeToWish: jest.fn(),
  getWishContributions: jest.fn(),
}));

const guardar = contributeToWish as jest.MockedFunction<typeof contributeToWish>;
const historico = getWishContributions as jest.MockedFunction<typeof getWishContributions>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const META = {
  id: "w1",
  name: "Moto",
  targetAmount: 18000,
  savedAmount: 1200,
  status: "GOAL",
} as Wish;

const SOBRA = { amount: 420.5, cycleMonth: "2026-09" };

const montar = (
  props: Partial<React.ComponentProps<typeof WishContributionSheet>> = {},
) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <WishContributionSheet
        visible
        wish={META}
        leftover={SOBRA}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        {...props}
      />
    </SafeAreaProvider>,
  );

/**
 * EC-205 na tela.
 *
 * O que se prova aqui é a regra que separa este recurso de um campo de texto:
 * o app PROPÕE a sobra que mediu, e quem guarda é a pessoa.
 */
describe("Folha de aporte da meta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    historico.mockResolvedValue([]);
  });

  it("a sobra medida vira uma proposta de um toque, com o ciclo dito", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText(/Guardar a sobra de R\$\s?420,50/)).toBeTruthy());
    expect(getByText(/ciclo 2026-09, medido no seu extrato/)).toBeTruthy();
  });

  it("guardar a sobra manda o ciclo — é ele que trava a repetição", async () => {
    guardar.mockResolvedValue({
      contribution: {} as WishContribution,
      savedAmount: 1620.5,
    });
    const { getByLabelText } = montar();

    fireEvent.press(
      await waitFor(() => getByLabelText(/Guardar a sobra de R\$\s?420,50 do ciclo 2026-09/)),
    );

    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith("w1", {
        amount: 420.5,
        cycleMonth: "2026-09",
      }),
    );
  });

  it("sem sobra medida, a proposta não aparece — nada é inventado", async () => {
    const { queryByText, getByLabelText } = montar({ leftover: null });

    await waitFor(() => expect(getByLabelText(/Quanto guardar/)).toBeTruthy());
    expect(queryByText(/Guardar a sobra/)).toBeNull();
  });

  it("o valor digitado vai SEM ciclo: ele é declarado, não medido", async () => {
    guardar.mockResolvedValue({
      contribution: {} as WishContribution,
      savedAmount: 1500,
    });
    const { getByLabelText } = montar();

    fireEvent.changeText(await waitFor(() => getByLabelText(/Quanto guardar/)), "300,00");
    fireEvent.press(getByLabelText("Guardar o valor informado"));

    await waitFor(() =>
      expect(guardar).toHaveBeenCalledWith("w1", { amount: 300, cycleMonth: null }),
    );
  });

  it("campo vazio pede o número e aponta o caminho da correção", async () => {
    const { getByLabelText, findByText } = montar();

    fireEvent.press(await waitFor(() => getByLabelText("Guardar o valor informado")));

    expect(await findByText(/use um valor negativo/)).toBeTruthy();
    expect(guardar).not.toHaveBeenCalled();
  });

  it("o histórico separa o que foi medido do que foi digitado", async () => {
    historico.mockResolvedValue([
      {
        id: "c1",
        amount: 420.5,
        origin: "MEASURED",
        cycleMonth: "2026-09",
        note: null,
        createdAt: "2026-09-11T10:00:00Z",
      },
      {
        id: "c2",
        amount: -100,
        origin: "DECLARED",
        cycleMonth: null,
        note: "errei o dedo",
        createdAt: "2026-09-10T10:00:00Z",
      },
    ]);

    const { getByText } = montar();

    await waitFor(() => expect(getByText(/sobra medida do ciclo 2026-09/)).toBeTruthy());
    expect(getByText(/valor informado por você · errei o dedo/)).toBeTruthy();
    // Devolução é lida como devolução, não como um aporte de sinal trocado
    expect(getByText("Devolvido")).toBeTruthy();
  });

  it("a recusa do servidor chega inteira — ela diz se o dinheiro entrou", async () => {
    guardar.mockRejectedValue({
      response: { status: 400, data: { detail: "A sobra de 2026-09 já foi guardada nesta meta" } },
    });
    const { getByLabelText, findByText } = montar();

    fireEvent.press(
      await waitFor(() => getByLabelText(/Guardar a sobra de R\$\s?420,50 do ciclo 2026-09/)),
    );

    expect(await findByText(/já foi guardada nesta meta/)).toBeTruthy();
  });

  it("o extrato falhar não impede de guardar dinheiro", async () => {
    historico.mockRejectedValue(new Error("sem rede"));

    const { getByLabelText } = montar();

    await waitFor(() => expect(getByLabelText("Guardar o valor informado")).toBeTruthy());
  });
});
