import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";

import HistoricalChart from "../HistoricalChart";
import { getHistoricalData } from "../../services/api";

// O gráfico é o único componente do app que nenhum teste conseguia montar: o
// `transformIgnorePatterns` do jest não liberava `react-native-gifted-charts`,
// então o import estourava em sintaxe antes de qualquer expectativa rodar.
// Esta suíte existe para provar o contrário — se a lista voltar a excluir a
// biblioteca, ela quebra aqui e não em produção.
jest.mock("../../services/api", () => ({
  getHistoricalData: jest.fn(),
}));

const mockGetHistoricalData = getHistoricalData as jest.MockedFunction<
  typeof getHistoricalData
>;

// Sete pontos, como a janela de "Últimos 7 dias" que a tela anuncia
const sevenDays = Array.from({ length: 7 }, (_, i) => ({
  timestamp: String(Math.floor(Date.UTC(2026, 7, 10 + i) / 1000)),
  high: 5 + i * 0.1,
}));

describe("HistoricalChart", () => {
  // A LineChart agenda animação por setTimeout ao montar. Com timer real, o
  // callback dispara DEPOIS que o jest derruba o ambiente e o processo cai
  // tentando reimportar react-native — falha de infraestrutura, não do gráfico
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("monta o gráfico de linha com a série carregada", async () => {
    mockGetHistoricalData.mockResolvedValue(sevenDays);

    render(<HistoricalChart currencyCode="USD" />);

    // O título só aparece no caminho de sucesso — carregando mostra Skeleton e
    // falha mostra a mensagem de erro
    expect(
      await screen.findByText("Variação (Últimos 7 dias)"),
    ).toBeTruthy();
    expect(mockGetHistoricalData).toHaveBeenCalledWith("USD");
  });

  it("mostra a mensagem de indisponibilidade quando a série vem vazia", async () => {
    mockGetHistoricalData.mockResolvedValue([]);

    render(<HistoricalChart currencyCode="EUR" />);

    // Lista vazia é tratada como erro pelo hook, com texto próprio
    expect(
      await screen.findByText("Dados históricos indisponíveis."),
    ).toBeTruthy();
  });

  it("não busca nada sem código de moeda", async () => {
    render(<HistoricalChart currencyCode="" />);

    await waitFor(() => {
      expect(mockGetHistoricalData).not.toHaveBeenCalled();
    });
  });
});
