import type {
  InvestmentMovements,
  InvestmentPosition,
  InvestmentProfile,
  InvestmentSummary,
  MacroIndicator,
} from "../../services/api";
import {
  EMPTY_PROFILE,
  EMPTY_SUMMARY,
  INVESTMENT_CACHE_TTL_MS,
  selectQuotes,
  selectServerLacksInvestments,
  selectUsdBrl,
  useInvestmentStore,
} from "../investmentStore";

// A camada de rede é o limite. `getApiErrorStatus` entra com a leitura do
// original (o status da resposta) porque é dele que sai a diferença entre
// "servidor antigo" (404 → vazio honesto) e falha de verdade
jest.mock("../../services/api", () => ({
  getInvestmentSummary: jest.fn(),
  getInvestmentPositions: jest.fn(),
  getInvestmentMovements: jest.fn(),
  getInvestmentProfile: jest.fn(),
  getMacroIndicators: jest.fn(),
  getTreasuryBonds: jest.fn(),
  getForeignQuote: jest.fn(),
  getNewsByTopics: jest.fn(),
  syncInvestments: jest.fn(),
  createInvestmentPosition: jest.fn(),
  updateInvestmentPosition: jest.fn(),
  deleteInvestmentPosition: jest.fn(),
  addInvestmentInterest: jest.fn(),
  removeInvestmentInterest: jest.fn(),
  getApiErrorStatus: (error: any) => error?.response?.status ?? null,
}));

const api = jest.requireMock("../../services/api");

const problem = (status: number) => ({ response: { status, data: {} } });

function summary(over: Partial<InvestmentSummary> = {}): InvestmentSummary {
  return {
    ...EMPTY_SUMMARY,
    totalInvested: 10000,
    currentValue: 10450,
    profit: 450,
    profitPercent: 4.5,
    positionsCount: 1,
    sources: ["CONNECTOR"],
    updatedAt: "2026-09-06T10:00:00Z",
    ...over,
  };
}

function position(over: Partial<InvestmentPosition> = {}): InvestmentPosition {
  return {
    id: "pos-1",
    source: "CONNECTOR",
    institution: "Inter",
    accountId: "acc-1",
    name: "CDB Inter",
    code: null,
    type: "FIXED_INCOME",
    subtype: "CDB",
    indexer: "CDI",
    rate: 110,
    currency: "BRL",
    quantity: null,
    unitPrice: null,
    investedAmount: 10000,
    currentValue: 10450,
    maturityDate: null,
    positionDate: "2026-09-05",
    updatedAt: null,
    stale: false,
    ...over,
  };
}

function profile(over: Partial<InvestmentProfile> = {}): InvestmentProfile {
  return {
    indexers: ["CDI"],
    watch: [{ kind: "RATE", code: "CDI" }],
    topics: ["selic-cdi"],
    derivedFrom: { positions: 1, movements: 0, manualInterests: 0 },
    isDefault: false,
    ...over,
  };
}

const movements: InvestmentMovements = {
  items: [],
  totals: { applied: 100, redeemed: 0, yield: 5 },
  netInvested: 100,
};

const macro: MacroIndicator[] = [
  {
    code: "USD_PTAX",
    name: "Dólar",
    value: 5.4,
    unit: "BRL",
    referenceDate: "2026-09-05",
    source: "BCB",
    asOf: "2026-09-05T18:00:00Z",
    stale: false,
  },
];

/** Todas as rotas respondendo bem — o ponto de partida da maioria dos casos. */
function servidorSaudavel() {
  api.getInvestmentSummary.mockResolvedValue(summary());
  api.getInvestmentPositions.mockResolvedValue([position()]);
  api.getInvestmentMovements.mockResolvedValue(movements);
  api.getInvestmentProfile.mockResolvedValue(profile());
  api.getMacroIndicators.mockResolvedValue(macro);
  api.getTreasuryBonds.mockResolvedValue([]);
  api.getNewsByTopics.mockResolvedValue({
    status: "ok",
    totalResults: 1,
    articles: [{ title: "Copom mantém a Selic", topics: ["selic-cdi"], url: "https://x/1" }],
    updatedAt: null,
  });
  api.getForeignQuote.mockResolvedValue({ symbol: "VT", price: 118, priceBrl: 640 });
}

beforeEach(() => {
  jest.clearAllMocks();
  useInvestmentStore.getState().reset();
});

describe("fetchAll — fatias independentes", () => {
  it("carrega todas as fatias em paralelo e marca a hora de cada uma", async () => {
    servidorSaudavel();

    await useInvestmentStore.getState().fetchAll();

    const state = useInvestmentStore.getState();
    expect(state.summary.data?.currentValue).toBe(10450);
    expect(state.positions.data).toHaveLength(1);
    expect(state.movements.data?.netInvested).toBe(100);
    expect(state.profile.data?.indexers).toEqual(["CDI"]);
    expect(state.macro.data).toHaveLength(1);
    expect(state.treasury.data).toEqual([]);
    expect(state.news.data).toHaveLength(1);
    [state.summary, state.positions, state.profile, state.news].forEach((slice) => {
      expect(slice.loading).toBe(false);
      expect(slice.error).toBeNull();
      expect(slice.fetchedAt).not.toBeNull();
    });
  });

  it("o radar pede os tópicos DO PERFIL, e só depois que ele chegou", async () => {
    servidorSaudavel();

    await useInvestmentStore.getState().fetchAll();

    expect(api.getNewsByTopics).toHaveBeenCalledWith(["selic-cdi"], 5);
  });

  it("uma fatia falhando não apaga as outras", async () => {
    servidorSaudavel();
    api.getInvestmentPositions.mockRejectedValue(new Error("offline"));

    await useInvestmentStore.getState().fetchAll();

    const state = useInvestmentStore.getState();
    expect(state.positions.error).toMatch(/posições/);
    expect(state.positions.data).toBeNull();
    // O resumo chegou e fica: a tela mostra o total com o bloco de posições
    // em "tentar de novo"
    expect(state.summary.data?.currentValue).toBe(10450);
    expect(state.summary.error).toBeNull();
  });

  it("falha preserva o dado anterior — a tela não volta ao vazio", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();

    api.getInvestmentSummary.mockRejectedValue(new Error("offline"));
    await useInvestmentStore.getState().fetchSummary(true);

    const { summary: slice } = useInvestmentStore.getState();
    expect(slice.error).toMatch(/resumo/);
    expect(slice.data?.currentValue).toBe(10450);
    expect(slice.loading).toBe(false);
  });

  it("sem tópico no perfil, o radar fica vazio sem ir à rede", async () => {
    servidorSaudavel();
    api.getInvestmentProfile.mockResolvedValue(profile({ topics: [] }));

    await useInvestmentStore.getState().fetchAll();

    expect(api.getNewsByTopics).not.toHaveBeenCalled();
    expect(useInvestmentStore.getState().news.data).toEqual([]);
    expect(useInvestmentStore.getState().news.fetchedAt).not.toBeNull();
  });

  it("busca cotação para o ticker acompanhado E para a posição manual sem preço", async () => {
    servidorSaudavel();
    api.getInvestmentProfile.mockResolvedValue(
      profile({ watch: [{ kind: "TICKER", code: "vt", market: "US" }] }),
    );
    api.getInvestmentSummary.mockResolvedValue(summary({ needsQuote: ["VOO"] }));

    await useInvestmentStore.getState().fetchAll();

    expect(api.getForeignQuote).toHaveBeenCalledWith("VT", "US");
    expect(api.getForeignQuote).toHaveBeenCalledWith("VOO", "US");
    expect(api.getForeignQuote).toHaveBeenCalledTimes(2);
    expect(selectQuotes(useInvestmentStore.getState())).toHaveProperty("VT");
  });
});

describe("cache de cinco minutos por fatia", () => {
  it("dentro da janela, a segunda chamada não vai à rede", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();
    jest.clearAllMocks();

    await useInvestmentStore.getState().fetchAll();

    expect(api.getInvestmentSummary).not.toHaveBeenCalled();
    expect(api.getInvestmentPositions).not.toHaveBeenCalled();
    expect(api.getMacroIndicators).not.toHaveBeenCalled();
    expect(api.getNewsByTopics).not.toHaveBeenCalled();
  });

  it("`force` ignora o cache — é o puxar para atualizar", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();
    jest.clearAllMocks();
    servidorSaudavel();

    await useInvestmentStore.getState().fetchAll(true);

    expect(api.getInvestmentSummary).toHaveBeenCalledTimes(1);
    expect(api.getInvestmentPositions).toHaveBeenCalledTimes(1);
  });

  it("cache vencido rebusca", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchSummary();
    useInvestmentStore.setState((state) => ({
      summary: {
        ...state.summary,
        fetchedAt: Date.now() - INVESTMENT_CACHE_TTL_MS - 1,
      },
    }));
    jest.clearAllMocks();
    servidorSaudavel();

    await useInvestmentStore.getState().fetchSummary();

    expect(api.getInvestmentSummary).toHaveBeenCalledTimes(1);
  });

  it("erro anterior invalida o cache: tenta de novo mesmo dentro da janela", async () => {
    api.getInvestmentSummary.mockRejectedValueOnce(new Error("offline"));
    await useInvestmentStore.getState().fetchSummary();
    expect(useInvestmentStore.getState().summary.error).not.toBeNull();

    api.getInvestmentSummary.mockResolvedValue(summary());
    await useInvestmentStore.getState().fetchSummary();

    expect(useInvestmentStore.getState().summary.error).toBeNull();
    expect(useInvestmentStore.getState().summary.data?.currentValue).toBe(10450);
  });

  it("chamada concorrente não duplica a requisição", async () => {
    servidorSaudavel();
    await Promise.all([
      useInvestmentStore.getState().fetchPositions(),
      useInvestmentStore.getState().fetchPositions(),
    ]);
    expect(api.getInvestmentPositions).toHaveBeenCalledTimes(1);
  });
});

describe("servidor antigo — 404 nas rotas", () => {
  it("vira estado vazio honesto, sem erro vermelho", async () => {
    api.getInvestmentSummary.mockRejectedValue(problem(404));
    api.getInvestmentPositions.mockRejectedValue(problem(404));
    api.getInvestmentMovements.mockRejectedValue(problem(404));
    api.getInvestmentProfile.mockRejectedValue(problem(404));
    api.getMacroIndicators.mockRejectedValue(problem(404));
    api.getTreasuryBonds.mockRejectedValue(problem(404));

    await useInvestmentStore.getState().fetchAll();

    const state = useInvestmentStore.getState();
    expect(state.summary).toMatchObject({
      data: EMPTY_SUMMARY,
      error: null,
      unavailable: true,
    });
    expect(state.positions).toMatchObject({ data: [], error: null, unavailable: true });
    expect(state.profile).toMatchObject({ data: EMPTY_PROFILE, error: null });
    expect(state.macro.data).toEqual([]);
    expect(state.news.data).toEqual([]);
    expect(selectServerLacksInvestments(state)).toBe(true);
    expect(api.getNewsByTopics).not.toHaveBeenCalled();
  });

  it("um 404 só na cotação vira 'indisponível' sem derrubar o resto", async () => {
    servidorSaudavel();
    api.getInvestmentProfile.mockResolvedValue(
      profile({ watch: [{ kind: "TICKER", code: "XYZW" }] }),
    );
    api.getForeignQuote.mockRejectedValue(problem(404));

    await useInvestmentStore.getState().fetchAll();

    const quote = useInvestmentStore.getState().quotes.XYZW;
    expect(quote.unavailable).toBe(true);
    expect(quote.error).toBeNull();
    expect(quote.data).toBeNull();
    expect(selectServerLacksInvestments(useInvestmentStore.getState())).toBe(false);
  });

  it("falha de rede na cotação guarda mensagem própria", async () => {
    api.getForeignQuote.mockRejectedValue(new Error("offline"));
    await useInvestmentStore.getState().fetchQuote("vt");
    expect(useInvestmentStore.getState().quotes.VT.error).toMatch(/Cotação/);
  });
});

describe("sync", () => {
  it("sincroniza e recarrega posições, movimentos e o que deriva deles", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();
    jest.clearAllMocks();
    servidorSaudavel();
    api.syncInvestments.mockResolvedValue({
      synced: true,
      created: 2,
      updated: 1,
      itemsRead: 3,
      skippedItems: 0,
    });

    const result = await useInvestmentStore.getState().sync();

    expect(result?.created).toBe(2);
    expect(useInvestmentStore.getState().syncing).toBe(false);
    expect(useInvestmentStore.getState().syncError).toBeNull();
    expect(api.getInvestmentPositions).toHaveBeenCalledTimes(1);
    expect(api.getInvestmentMovements).toHaveBeenCalledTimes(1);
    expect(api.getInvestmentSummary).toHaveBeenCalledTimes(1);
    expect(api.getInvestmentProfile).toHaveBeenCalledTimes(1);
  });

  it("503 é o conector desligado — mensagem específica, resultado nulo", async () => {
    api.syncInvestments.mockRejectedValue(problem(503));

    const result = await useInvestmentStore.getState().sync();

    expect(result).toBeNull();
    expect(useInvestmentStore.getState().syncError).toMatch(/desligado/);
    expect(useInvestmentStore.getState().syncing).toBe(false);
  });

  it("404 é o servidor antigo; qualquer outra falha é genérica", async () => {
    api.syncInvestments.mockRejectedValueOnce(problem(404));
    await useInvestmentStore.getState().sync();
    expect(useInvestmentStore.getState().syncError).toMatch(/ainda não sincroniza/);

    api.syncInvestments.mockRejectedValueOnce(new Error("offline"));
    await useInvestmentStore.getState().sync();
    expect(useInvestmentStore.getState().syncError).toMatch(/Não foi possível/);
  });

  it("duas sincronizações ao mesmo tempo viram uma", async () => {
    let liberar: (value: unknown) => void = () => {};
    api.syncInvestments.mockImplementationOnce(
      () => new Promise((resolve) => {
        liberar = resolve;
      }),
    );
    servidorSaudavel();

    const primeira = useInvestmentStore.getState().sync();
    const segunda = await useInvestmentStore.getState().sync();
    expect(segunda).toBeNull();
    liberar({ synced: true, created: 0, updated: 0, itemsRead: 0, skippedItems: 0 });
    await primeira;

    expect(api.syncInvestments).toHaveBeenCalledTimes(1);
  });
});

describe("CRUD da posição manual", () => {
  it("criar acrescenta à lista e recarrega resumo e perfil", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();
    jest.clearAllMocks();
    servidorSaudavel();
    const nova = position({ id: "pos-2", source: "MANUAL", name: "VT" });
    api.createInvestmentPosition.mockResolvedValue(nova);

    const created = await useInvestmentStore
      .getState()
      .createPosition({ name: "VT", type: "ETF" });

    expect(created.id).toBe("pos-2");
    expect(useInvestmentStore.getState().positions.data?.map((p) => p.id)).toEqual([
      "pos-1",
      "pos-2",
    ]);
    expect(api.getInvestmentSummary).toHaveBeenCalledTimes(1);
    expect(api.getInvestmentProfile).toHaveBeenCalledTimes(1);
  });

  it("editar substitui a posição pelo que o servidor devolveu", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchPositions();
    api.updateInvestmentPosition.mockResolvedValue(position({ name: "CDB Inter 115%" }));

    await useInvestmentStore.getState().updatePosition("pos-1", { name: "CDB Inter 115%" });

    expect(api.updateInvestmentPosition).toHaveBeenCalledWith("pos-1", {
      name: "CDB Inter 115%",
    });
    expect(useInvestmentStore.getState().positions.data?.[0].name).toBe("CDB Inter 115%");
  });

  it("excluir tira da lista", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchPositions();
    api.deleteInvestmentPosition.mockResolvedValue(undefined);

    await useInvestmentStore.getState().deletePosition("pos-1");

    expect(useInvestmentStore.getState().positions.data).toEqual([]);
  });

  it("falha no cadastro sobe para quem chamou, sem mexer na lista", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchPositions();
    api.createInvestmentPosition.mockRejectedValue(problem(400));

    await expect(
      useInvestmentStore.getState().createPosition({ name: "x", type: "OTHER" }),
    ).rejects.toBeTruthy();
    expect(useInvestmentStore.getState().positions.data).toHaveLength(1);
  });
});

describe("interesses", () => {
  it("adicionar recarrega o perfil e o que deriva dele", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();
    jest.clearAllMocks();
    servidorSaudavel();
    api.getInvestmentProfile.mockResolvedValue(
      profile({
        watch: [
          { kind: "RATE", code: "CDI" },
          { kind: "TICKER", code: "VT", market: "US" },
        ],
        topics: ["selic-cdi", "etf-exterior"],
      }),
    );
    api.addInvestmentInterest.mockResolvedValue(undefined);

    await useInvestmentStore
      .getState()
      .addInterest({ kind: "TICKER", code: "VT", market: "US" });

    expect(api.addInvestmentInterest).toHaveBeenCalledWith({
      kind: "TICKER",
      code: "VT",
      market: "US",
    });
    expect(useInvestmentStore.getState().profile.data?.watch).toHaveLength(2);
    // O perfil novo tem tópico novo e ticker novo: radar e cotação seguem
    expect(api.getNewsByTopics).toHaveBeenCalledWith(["selic-cdi", "etf-exterior"], 5);
    expect(api.getForeignQuote).toHaveBeenCalledWith("VT", "US");
  });

  it("remover recarrega o perfil", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchProfile();
    api.removeInvestmentInterest.mockResolvedValue(undefined);
    api.getInvestmentProfile.mockResolvedValue(profile({ watch: [] }));

    await useInvestmentStore.getState().removeInterest("RATE", "CDI");

    expect(api.removeInvestmentInterest).toHaveBeenCalledWith("RATE", "CDI");
    expect(useInvestmentStore.getState().profile.data?.watch).toEqual([]);
  });
});

describe("seletores e reset", () => {
  it("dólar PTAX sai do bloco macro", async () => {
    expect(selectUsdBrl(useInvestmentStore.getState())).toBeNull();
    servidorSaudavel();
    await useInvestmentStore.getState().fetchMacro();
    expect(selectUsdBrl(useInvestmentStore.getState())).toBe(5.4);
  });

  it("reset zera tudo — é o que o fim da sessão chama", async () => {
    servidorSaudavel();
    await useInvestmentStore.getState().fetchAll();
    useInvestmentStore.getState().reset();
    const state = useInvestmentStore.getState();
    expect(state.summary.data).toBeNull();
    expect(state.positions.fetchedAt).toBeNull();
    expect(state.quotes).toEqual({});
  });
});
