import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import BudgetSheet, { type BudgetTarget } from "../BudgetSheet";
import { clearBudget, setBudget } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  setBudget: jest.fn(),
  clearBudget: jest.fn(),
}));

const gravar = setBudget as jest.MockedFunction<typeof setBudget>;
const apagar = clearBudget as jest.MockedFunction<typeof clearBudget>;

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const SEM_TETO: BudgetTarget = {
  categoryId: "c1",
  categoryName: "Mercado",
  monthlyLimit: null,
};

const COM_TETO: BudgetTarget = { ...SEM_TETO, monthlyLimit: 800 };

const montar = (target: BudgetTarget, onSaved = jest.fn()) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BudgetSheet visible target={target} onClose={jest.fn()} onSaved={onSaved} />
    </SafeAreaProvider>,
  );

/**
 * EC-204: a folha do teto.
 *
 * O que se prova aqui é a separação entre reajustar e tirar — zerar o campo
 * não pode apagar a regra em silêncio.
 */
describe("Folha do teto", () => {
  beforeEach(() => jest.clearAllMocks());

  it("categoria sem teto: o campo abre vazio e o botão convida a guardar", () => {
    const { getByLabelText, getByText } = montar(SEM_TETO);

    expect(getByLabelText("Teto mensal de Mercado").props.value).toBe("");
    expect(getByText("Esta categoria ainda não tem teto")).toBeTruthy();
    expect(getByText("Guardar")).toBeTruthy();
  });

  it("categoria com teto: o botão fala em reajustar, e o valor de hoje aparece", () => {
    const { getByText } = montar(COM_TETO);

    expect(getByText(/Hoje: R\$\s?800,00 por mês/)).toBeTruthy();
    expect(getByText("Reajustar")).toBeTruthy();
  });

  it("guarda o valor digitado, com vírgula", async () => {
    gravar.mockResolvedValue({ categoryId: "c1", categoryName: "Mercado", monthlyLimit: 650 });
    const salvou = jest.fn();
    const { getByLabelText } = montar(SEM_TETO, salvou);

    fireEvent.changeText(getByLabelText("Teto mensal de Mercado"), "650,00");
    fireEvent.press(getByLabelText("Guardar o teto"));

    await waitFor(() => expect(gravar).toHaveBeenCalledWith("c1", 650));
    expect(salvou).toHaveBeenCalled();
  });

  it("zero não é teto, e a recusa aponta o caminho certo", async () => {
    const { getByLabelText, findByText } = montar(COM_TETO);

    fireEvent.changeText(getByLabelText("Teto mensal de Mercado"), "0");
    fireEvent.press(getByLabelText("Reajustar o teto"));

    expect(await findByText(/Para tirá-lo, use o botão abaixo/)).toBeTruthy();
    expect(gravar).not.toHaveBeenCalled();
  });

  it("campo vazio pede o número em vez de mandar nada", async () => {
    const { getByLabelText, findByText } = montar(SEM_TETO);

    fireEvent.press(getByLabelText("Guardar o teto"));

    expect(await findByText("Informe o teto mensal desta categoria.")).toBeTruthy();
    expect(gravar).not.toHaveBeenCalled();
  });

  it("tirar o teto só existe quando há teto", () => {
    expect(montar(SEM_TETO).queryByText("Tirar o teto")).toBeNull();
    expect(montar(COM_TETO).getByText("Tirar o teto")).toBeTruthy();
  });

  it("tirar o teto chama a remoção e avisa a tela", async () => {
    apagar.mockResolvedValue(undefined);
    const salvou = jest.fn();
    const { getByLabelText } = montar(COM_TETO, salvou);

    fireEvent.press(getByLabelText("Tirar o teto de Mercado"));

    await waitFor(() => expect(apagar).toHaveBeenCalledWith("c1"));
    expect(salvou).toHaveBeenCalled();
  });

  it("falha ao gravar fica NA folha — o toast monta fora do modal", async () => {
    gravar.mockRejectedValue(new Error("500"));
    const { getByLabelText, findByText } = montar(SEM_TETO);

    fireEvent.changeText(getByLabelText("Teto mensal de Mercado"), "300");
    fireEvent.press(getByLabelText("Guardar o teto"));

    expect(await findByText("Não consegui guardar agora. Tente de novo.")).toBeTruthy();
  });
});
