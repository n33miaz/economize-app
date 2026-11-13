import React from "react";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import BudgetPanel from "../BudgetPanel";
import { getBudgetStatus } from "../../services/api";
import type { BudgetLine } from "../../services/api";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getBudgetStatus: jest.fn(),
  setBudget: jest.fn(),
  clearBudget: jest.fn(),
}));

jest.mock("../CategoryPickerSheet", () => () => null);

// O foco da tela, simulado: cada `mockFocar()` é a pessoa voltando para a
// Análise. Entre focos, o efeito acompanha a identidade do callback, como o
// useFocusEffect real faz com a tela já em foco
let mockFocar: () => void = () => {};
jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (efeito: () => void) => {
    const React = require("react");
    const [foco, setFoco] = React.useState(0);
    mockFocar = () => setFoco((n: number) => n + 1);
    React.useEffect(efeito, [efeito, foco]);
  },
}));

const buscar = getBudgetStatus as jest.MockedFunction<typeof getBudgetStatus>;

const linha = (patch: Partial<BudgetLine> = {}): BudgetLine => ({
  categoryId: "c1",
  categoryName: "Mercado",
  monthlyLimit: 800,
  windowLimit: 800,
  spent: 150,
  expectedSoFar: 160,
  overBy: 0,
  exceeded: false,
  abovePace: false,
  ...patch,
});

const RECORTE = { kind: "month" as const, month: "2026-09" };

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

// A folha do teto monta um CustomModal, que lê as áreas seguras
const montar = (range: Parameters<typeof BudgetPanel>[0]["range"]) =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BudgetPanel range={range} />
    </SafeAreaProvider>,
  );

/**
 * EC-204 na Análise.
 *
 * O que se prova aqui é o que o painel existe para separar: "estourou" e "o
 * ritmo leva a estourar" são notícias diferentes e não podem virar um número
 * só de avisos.
 */
describe("Painel de tetos", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sem teto nenhum, fica o convite — não some", async () => {
    buscar.mockResolvedValue({ exceededCount: 0, abovePaceCount: 0, lines: [] });

    const { getByText } = montar(RECORTE);

    await waitFor(() =>
      expect(getByText(/Ponha um teto numa categoria/)).toBeTruthy(),
    );
  });

  it("tudo dentro: o resumo diz isso sem inventar aviso", async () => {
    buscar.mockResolvedValue({
      exceededCount: 0,
      abovePaceCount: 0,
      lines: [linha()],
    });

    const { getByText } = montar(RECORTE);

    await waitFor(() => expect(getByText("1 teto neste período · tudo dentro")).toBeTruthy());
  });

  it("as duas perguntas aparecem separadas na mesma frase", async () => {
    buscar.mockResolvedValue({
      exceededCount: 1,
      abovePaceCount: 2,
      lines: [
        linha({ spent: 900, overBy: 100, exceeded: true }),
        linha({ categoryId: "c2", categoryName: "Lazer", abovePace: true }),
        linha({ categoryId: "c3", categoryName: "Transporte", abovePace: true }),
      ],
    });

    const { getByText } = montar(RECORTE);

    await waitFor(() =>
      expect(
        getByText("3 tetos neste período · 1 estourado e 2 no ritmo de estourar"),
      ).toBeTruthy(),
    );
  });

  it("uma falha vira erro do painel, não o convite de quem não tem teto", async () => {
    buscar.mockRejectedValueOnce(new Error("sem rede"));

    const { getByLabelText, queryByText, findByText } = montar(RECORTE);

    await waitFor(() => expect(getByLabelText("Tentar de novo")).toBeTruthy());
    // Sem dado não é sem teto: convidar a "pôr um teto" seria mentir
    expect(queryByText(/Ponha um teto numa categoria/)).toBeNull();

    buscar.mockResolvedValueOnce({
      exceededCount: 0,
      abovePaceCount: 0,
      lines: [linha()],
    });
    fireEvent.press(getByLabelText("Tentar de novo"));

    expect(await findByText("1 teto neste período · tudo dentro")).toBeTruthy();
    expect(queryByText(/Tentar de novo/)).toBeNull();
  });

  it("volta a perguntar ao ganhar foco", async () => {
    buscar.mockResolvedValue({ exceededCount: 0, abovePaceCount: 0, lines: [] });

    montar(RECORTE);
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));

    // De volta da Revisão: o gasto por categoria pode ter mudado
    act(() => mockFocar());

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2));
  });

  it("resposta atrasada do mês anterior não sobrescreve o atual", async () => {
    let soltaSetembro: (v: unknown) => void = () => {};
    buscar
      .mockImplementationOnce(
        () => new Promise((resolve) => (soltaSetembro = resolve)) as never,
      )
      .mockResolvedValueOnce({
        exceededCount: 0,
        abovePaceCount: 0,
        lines: [linha({ categoryName: "Agosto" })],
      });

    const { rerender, findByLabelText, queryByLabelText } = montar(RECORTE);
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));

    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <BudgetPanel range={{ kind: "month", month: "2026-08" }} />
      </SafeAreaProvider>,
    );
    expect(await findByLabelText("Ajustar o teto de Agosto")).toBeTruthy();

    await act(async () => {
      soltaSetembro({
        exceededCount: 0,
        abovePaceCount: 0,
        lines: [linha({ categoryName: "Setembro" })],
      });
    });

    expect(queryByLabelText("Ajustar o teto de Setembro")).toBeNull();
    expect(queryByLabelText("Ajustar o teto de Agosto")).toBeTruthy();
  });

  it("sem recorte, não pergunta nada ao servidor", () => {
    montar(null);

    expect(buscar).not.toHaveBeenCalled();
  });

  it("tocar numa barra abre a folha com o teto que já existe", async () => {
    buscar.mockResolvedValue({
      exceededCount: 0,
      abovePaceCount: 0,
      lines: [linha({ monthlyLimit: 800 })],
    });

    const { getByLabelText, findByLabelText } = montar(RECORTE);

    fireEvent.press(await findByLabelText("Ajustar o teto de Mercado"));

    // Campo preenchido, e não em branco: em branco pareceria "ainda não tem"
    expect(getByLabelText("Teto mensal de Mercado").props.value).toBe("800,00");
  });

  it("o recorte muda e o painel repergunta", async () => {
    buscar.mockResolvedValue({ exceededCount: 0, abovePaceCount: 0, lines: [] });

    const { rerender } = montar(RECORTE);
    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(1));

    rerender(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <BudgetPanel range={{ kind: "month", month: "2026-08" }} />
      </SafeAreaProvider>,
    );

    await waitFor(() => expect(buscar).toHaveBeenCalledTimes(2));
    expect(buscar).toHaveBeenLastCalledWith({ kind: "month", month: "2026-08" });
  });
});
