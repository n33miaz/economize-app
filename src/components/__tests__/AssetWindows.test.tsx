import React from "react";
import { render } from "@testing-library/react-native";

import AssetWindows from "../AssetWindows";
import type { AssetDetail } from "../../services/api";

const detalhe = (over: Partial<AssetDetail> = {}): AssetDetail => ({
  code: "PETR4",
  name: "Petroleo Brasileiro SA Pfd",
  price: 46.87,
  dayChangePct: 4.11,
  fiftyTwoWeekHigh: 50.69,
  fiftyTwoWeekLow: 29.31,
  rangePosition: 0.8213,
  stale: false,
  windows: [
    { key: "24h", label: "Hoje", changePct: 4.11, fromPrice: null, fromDate: null },
    { key: "7d", label: "7 dias", changePct: 13.08, fromPrice: 41.45, fromDate: "2026-08-26" },
    { key: "30d", label: "30 dias", changePct: -8.87, fromPrice: 51.4, fromDate: "2026-08-03" },
    { key: "ytd", label: "No ano", changePct: 52.62, fromPrice: 30.71, fromDate: "2026-01-02" },
  ],
  ...over,
});

describe("AssetWindows (EC-103)", () => {
  it("mostra as quatro janelas com sinal e vírgula decimal", () => {
    const { getByText } = render(
      <AssetWindows detail={detalhe()} isLoading={false} />,
    );

    expect(getByText("Hoje")).toBeTruthy();
    expect(getByText("+13,08%")).toBeTruthy();
    // Queda com o sinal de menos tipográfico, não o hífen
    expect(getByText("−8,87%")).toBeTruthy();
    expect(getByText("+52,62%")).toBeTruthy();
  });

  it("janela sem histórico mostra traço, e não zero por cento", () => {
    // Papel recém-listado não tem 30 dias: "0,00%" afirmaria estabilidade
    const { getAllByText } = render(
      <AssetWindows
        detail={detalhe({
          windows: [
            { key: "24h", label: "Hoje", changePct: 2, fromPrice: null, fromDate: null },
            { key: "30d", label: "30 dias", changePct: null, fromPrice: null, fromDate: null },
          ],
        })}
        isLoading={false}
      />,
    );

    expect(getAllByText("—").length).toBe(1);
  });

  it("desenha a faixa de 52 semanas com os dois extremos", () => {
    const { getByText } = render(
      <AssetWindows detail={detalhe()} isLoading={false} />,
    );

    expect(getByText("Últimas 52 semanas")).toBeTruthy();
    expect(getByText(/29,31/)).toBeTruthy();
    expect(getByText(/50,69/)).toBeTruthy();
  });

  it("sem faixa apurada, a régua não é desenhada", () => {
    const { queryByText } = render(
      <AssetWindows
        detail={detalhe({
          fiftyTwoWeekHigh: null,
          fiftyTwoWeekLow: null,
          rangePosition: null,
        })}
        isLoading={false}
      />,
    );

    expect(queryByText("Últimas 52 semanas")).toBeNull();
  });

  it("preço velho é anunciado, nunca servido em silêncio", () => {
    const { getByText } = render(
      <AssetWindows
        detail={detalhe({ stale: true, windows: [] })}
        isLoading={false}
      />,
    );

    expect(getByText(/limite diário de consultas/)).toBeTruthy();
  });

  it("carregando sem dado mostra o indicador; sem dado nenhum não ocupa espaço", () => {
    const { getByLabelText } = render(
      <AssetWindows detail={null} isLoading />,
    );
    expect(getByLabelText("Carregando o histórico do ativo")).toBeTruthy();

    const { toJSON } = render(<AssetWindows detail={null} isLoading={false} />);
    expect(toJSON()).toBeNull();
  });

  it("cada janela é um nó acessível que diz alta ou queda", () => {
    const { getByLabelText } = render(
      <AssetWindows detail={detalhe()} isLoading={false} />,
    );

    expect(getByLabelText("7 dias: alta de 13,08 por cento")).toBeTruthy();
    expect(getByLabelText("30 dias: queda de 8,87 por cento")).toBeTruthy();
    expect(getByLabelText("Hoje: alta de 4,11 por cento")).toBeTruthy();
  });

  it("a régua é anunciada com preço, mínima e máxima", () => {
    const { getByLabelText } = render(
      <AssetWindows detail={detalhe()} isLoading={false} />,
    );

    expect(
      getByLabelText(/Preço de .*46,87.*mínima de .*29,31.*máxima de .*50,69/),
    ).toBeTruthy();
  });
});
