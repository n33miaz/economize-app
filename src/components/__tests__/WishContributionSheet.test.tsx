import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
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

const SOBRA = { amount: 420.5, cycleMonth: "2026-09", start: "2026-09-05", end: "2026-10-04" };

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

  it("a sobra medida vira uma proposta de um toque, com o período dito em datas", async () => {
    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText(/Guardar a sobra de R\$\s?420,50/)).toBeTruthy());
    // o período que a pessoa viveu, com o fim inclusivo; nunca a chave "2026-09"
    expect(getByText(/sobrou de 05\/09 a 04\/10, medido no seu extrato/)).toBeTruthy();
    expect(queryByText(/2026-09/)).toBeNull();
  });

  it("sem as datas (API anterior), fala o mês por extenso em vez da chave", async () => {
    const { getByText } = montar({ leftover: { amount: 420.5, cycleMonth: "2026-09" } });

    await waitFor(() => expect(getByText(/sobrou em setembro de 2026/)).toBeTruthy());
  });

  it("sobra zero ou negativa não vira proposta", async () => {
    const { queryByText, getByLabelText } = montar({ leftover: { ...SOBRA, amount: 0 } });

    await waitFor(() => expect(getByLabelText(/Quanto guardar/)).toBeTruthy());
    expect(queryByText(/Guardar a sobra/)).toBeNull();
  });

  it("trocar de meta descarta o extrato da anterior antes de carregar o novo", async () => {
    let entregarSegunda: (linhas: WishContribution[]) => void = () => {};
    historico
      .mockResolvedValueOnce([
        {
          id: "c1",
          amount: 420.5,
          origin: "MEASURED",
          cycleMonth: "2026-09",
          note: null,
          createdAt: "2026-09-11T10:00:00Z",
        },
      ])
      .mockImplementationOnce(
        () => new Promise((resolve) => { entregarSegunda = resolve; }),
      );
    const { getByText, queryByText, rerender } = montar();
    await waitFor(() => expect(getByText(/sobra medida do ciclo 2026-09/)).toBeTruthy());
    // a meta 1 já guardou esta sobra: a proposta some
    expect(queryByText(/Guardar a sobra/)).toBeNull();

    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <WishContributionSheet
          visible
          wish={{ ...META, id: "w2", name: "Viagem" } as Wish}
          leftover={SOBRA}
          onClose={jest.fn()}
          onSaved={jest.fn()}
        />
      </SafeAreaProvider>,
    );

    // o extrato da meta 2 ainda não chegou, e o da meta 1 já não está na tela
    await waitFor(() => expect(historico).toHaveBeenLastCalledWith("w2"));
    expect(queryByText(/sobra medida do ciclo 2026-09/)).toBeNull();
    expect(getByText(/Guardar a sobra de R\$\s?420,50/)).toBeTruthy();

    entregarSegunda([]);
    await waitFor(() => expect(getByText(/Guardar a sobra de R\$\s?420,50/)).toBeTruthy());
  });

  it("guardar a sobra manda o ciclo — é ele que trava a repetição", async () => {
    guardar.mockResolvedValue({
      contribution: {} as WishContribution,
      savedAmount: 1620.5,
    });
    const { getByLabelText } = montar();

    fireEvent.press(
      await waitFor(() => getByLabelText(/Guardar a sobra de R\$\s?420,50, de 5 de setembro a 4 de outubro de 2026/)),
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

  it("não oferece de novo o ciclo que o extrato da meta já registrou", async () => {
    historico.mockResolvedValue([
      {
        id: "c1",
        amount: 420.5,
        origin: "MEASURED",
        cycleMonth: "2026-09",
        note: null,
        createdAt: "2026-09-11T10:00:00Z",
      },
    ]);
    const { queryByText } = montar();

    await waitFor(() => expect(queryByText(/Guardar a sobra/)).toBeNull());
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

  it("dois toques rápidos no guardar viram UM aporte", async () => {
    // A gravação fica pendurada: o segundo toque chega antes de o estado
    // "salvando" existir no render, e só a trava por ref o segura
    let concluir: () => void = () => {};
    guardar.mockImplementation(
      () =>
        new Promise((resolve) => {
          concluir = () =>
            resolve({ contribution: {} as WishContribution, savedAmount: 1500 });
        }),
    );
    const { getByLabelText } = montar();

    fireEvent.changeText(await waitFor(() => getByLabelText(/Quanto guardar/)), "300,00");
    const botao = getByLabelText("Guardar o valor informado");
    // Os dois toques no MESMO ato, sem render no meio: é o caso em que o
    // `isSaving` do estado ainda é `false` para os dois, e só a ref segura
    act(() => {
      fireEvent.press(botao);
      fireEvent.press(botao);
    });

    expect(guardar).toHaveBeenCalledTimes(1);
    concluir();
    await waitFor(() => expect(historico).toHaveBeenCalledTimes(2));
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
      await waitFor(() => getByLabelText(/Guardar a sobra de R\$\s?420,50, de 5 de setembro a 4 de outubro de 2026/)),
    );

    expect(await findByText(/já foi guardada nesta meta/)).toBeTruthy();
  });

  it("o extrato falhar não impede de guardar dinheiro", async () => {
    historico.mockRejectedValue(new Error("sem rede"));

    const { getByLabelText } = montar();

    await waitFor(() => expect(getByLabelText("Guardar o valor informado")).toBeTruthy());
  });
});
