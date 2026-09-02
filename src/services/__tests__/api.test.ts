import api, { getMonthlyAnalytics, getRecurrenceForecast } from "../api";
import type { AnalysisRange } from "../../utils/cycleWindow";

// Só a chamada HTTP é interceptada: o que interessa aqui é a query string que
// SAI — o contrato do servidor é `month` OU `start`/`end`, nunca os dois, e a
// previsão de saldo precisa falar exatamente a gramática da análise (EC-116)
const getSpy = jest.spyOn(api, "get");

beforeEach(() => {
  getSpy.mockReset();
  getSpy.mockResolvedValue({ data: {} });
});

describe("getRecurrenceForecast — recorte na gramática de /analytics/monthly", () => {
  it("sem recorte manda só months e startingBalance (o que o APK publicado pede)", async () => {
    await getRecurrenceForecast(3, 1500);
    expect(getSpy).toHaveBeenCalledWith("/recurrences/forecast", {
      params: { months: 3, startingBalance: 1500 },
    });
  });

  it("âncora no dia 1 vai como month, sem start/end", async () => {
    await getRecurrenceForecast(6, 0, { kind: "month", month: "2026-08" });
    expect(getSpy).toHaveBeenCalledWith("/recurrences/forecast", {
      params: { months: 6, startingBalance: 0, month: "2026-08" },
    });
  });

  it("fora do dia 1 vai como start/end, sem month", async () => {
    await getRecurrenceForecast(12, 250.5, {
      kind: "window",
      start: "2026-07-12",
      end: "2026-08-11",
    });
    expect(getSpy).toHaveBeenCalledWith("/recurrences/forecast", {
      params: {
        months: 12,
        startingBalance: 250.5,
        start: "2026-07-12",
        end: "2026-08-11",
      },
    });
  });

  it("traduz o recorte exatamente como a análise traduz — uma régua só", async () => {
    const range: AnalysisRange = {
      kind: "window",
      start: "2026-07-12",
      end: "2026-08-11",
    };
    await getMonthlyAnalytics(range);
    await getRecurrenceForecast(3, 0, range);
    const [, monthlyOptions] = getSpy.mock.calls[0] as [string, { params: object }];
    const [, forecastOptions] = getSpy.mock.calls[1] as [string, { params: object }];
    expect(forecastOptions.params).toMatchObject(monthlyOptions.params);
  });
});
