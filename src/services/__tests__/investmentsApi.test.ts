import api, {
  addInvestmentInterest,
  createInvestmentPosition,
  deleteInvestmentPosition,
  getForeignQuote,
  getInvestmentMovements,
  getInvestmentPositions,
  getInvestmentProfile,
  getInvestmentSummary,
  getMacroIndicators,
  getNewsByTopics,
  getNewsTopics,
  getTreasuryBonds,
  removeInvestmentInterest,
  syncInvestments,
  updateInvestmentPosition,
} from "../api";

// Só a chamada HTTP é interceptada: o que interessa é a ROTA e a query que
// saem, porque a API de investimentos está sendo escrita em paralelo contra
// este mesmo contrato — um caminho errado aqui é 404 lá
const getSpy = jest.spyOn(api, "get");
const postSpy = jest.spyOn(api, "post");
const patchSpy = jest.spyOn(api, "patch");
const deleteSpy = jest.spyOn(api, "delete");

beforeEach(() => {
  [getSpy, postSpy, patchSpy, deleteSpy].forEach((spy) => {
    spy.mockReset();
    spy.mockResolvedValue({ data: { ok: true } });
  });
});

describe("contrato das rotas de investimentos", () => {
  it("resumo, posições e perfil são GETs simples", async () => {
    await getInvestmentSummary();
    await getInvestmentPositions();
    await getInvestmentProfile();
    expect(getSpy).toHaveBeenCalledWith("/investments/summary");
    expect(getSpy).toHaveBeenCalledWith("/investments/positions");
    expect(getSpy).toHaveBeenCalledWith("/investments/profile");
  });

  it("movimentações pedem a janela em meses, 12 por padrão", async () => {
    await getInvestmentMovements();
    expect(getSpy).toHaveBeenCalledWith("/investments/movements", {
      params: { months: 12 },
    });
    await getInvestmentMovements(6);
    expect(getSpy).toHaveBeenLastCalledWith("/investments/movements", {
      params: { months: 6 },
    });
  });

  it("cadastro manual: POST, PATCH por id e DELETE por id", async () => {
    const payload = { name: "VT", type: "ETF" as const, code: "VT", currency: "USD" };
    await createInvestmentPosition(payload);
    expect(postSpy).toHaveBeenCalledWith("/investments/positions", payload);

    await updateInvestmentPosition("pos-1", { rate: 115 });
    expect(patchSpy).toHaveBeenCalledWith("/investments/positions/pos-1", { rate: 115 });

    await deleteInvestmentPosition("pos-1");
    expect(deleteSpy).toHaveBeenCalledWith("/investments/positions/pos-1");
  });

  it("sincronizar é um POST sem corpo e devolve o resultado cru", async () => {
    postSpy.mockResolvedValue({
      data: { synced: true, created: 1, updated: 0, itemsRead: 1, skippedItems: 0 },
    });
    const result = await syncInvestments();
    expect(postSpy).toHaveBeenCalledWith("/investments/sync");
    expect(result.created).toBe(1);
  });

  it("interesses: POST com o corpo e DELETE por tipo/código escapado", async () => {
    await addInvestmentInterest({ kind: "TICKER", code: "VT", market: "US" });
    expect(postSpy).toHaveBeenCalledWith("/investments/interests", {
      kind: "TICKER",
      code: "VT",
      market: "US",
    });

    await removeInvestmentInterest("TICKER", "BRK.B");
    expect(deleteSpy).toHaveBeenCalledWith("/investments/interests/TICKER/BRK.B");
    await removeInvestmentInterest("CURRENCY", "US D");
    expect(deleteSpy).toHaveBeenLastCalledWith("/investments/interests/CURRENCY/US%20D");
  });

  it("indicadores: macro, Tesouro e cotação com mercado", async () => {
    await getMacroIndicators();
    await getTreasuryBonds();
    expect(getSpy).toHaveBeenCalledWith("/indicators/macro");
    expect(getSpy).toHaveBeenCalledWith("/indicators/treasury");

    await getForeignQuote("VT");
    expect(getSpy).toHaveBeenLastCalledWith("/indicators/quote/VT", {
      params: { market: "US" },
    });
    await getForeignQuote("BRK.B", "US");
    expect(getSpy).toHaveBeenLastCalledWith("/indicators/quote/BRK.B", {
      params: { market: "US" },
    });
  });

  it("notícias: tópicos separados por vírgula, com limite", async () => {
    await getNewsTopics();
    expect(getSpy).toHaveBeenCalledWith("/news/topics");

    await getNewsByTopics(["selic-cdi", "tesouro"], 5);
    expect(getSpy).toHaveBeenLastCalledWith("/news/top-headlines", {
      params: { topics: "selic-cdi,tesouro", limit: 5 },
    });
  });
});
