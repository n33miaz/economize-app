import type { MonthlyAnalytics, MonthTotals } from "../../services/api";
import { getAnalyticsMonths, getMonthlyAnalytics } from "../../services/api";
import {
  hasMovement,
  reloadAnalyticsForAnchorChange,
  useAnalyticsStore,
} from "../analyticsStore";
import { usePreferencesStore } from "../preferencesStore";

jest.mock("../../services/api", () => ({
  getAnalyticsMonths: jest.fn(),
  getMonthlyAnalytics: jest.fn(),
}));

const mockedMonths = getAnalyticsMonths as jest.MockedFunction<
  typeof getAnalyticsMonths
>;
const mockedMonthly = getMonthlyAnalytics as jest.MockedFunction<
  typeof getMonthlyAnalytics
>;

function totals(overrides?: Partial<MonthTotals>): MonthTotals {
  return {
    month: "2026-07",
    start: "2026-07-01",
    end: "2026-07-31",
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
    ...overrides,
  };
}

/** Consolidação com movimento; `vazia()` é a mesma coisa sem nada dentro. */
function analytics(overrides?: Partial<MonthlyAnalytics>): MonthlyAnalytics {
  return {
    month: "2026-08",
    start: "2026-08-01",
    end: "2026-08-31",
    totalIncome: 5000,
    totalExpense: 3200,
    net: 1800,
    previous: totals(),
    categories: [],
    pendingReviewCount: 0,
    ...overrides,
  };
}

function vazia(overrides?: Partial<MonthlyAnalytics>): MonthlyAnalytics {
  return analytics({ totalIncome: 0, totalExpense: 0, net: 0, ...overrides });
}

function setAnchor(day: number) {
  usePreferencesStore.setState({ cycleAnchorDay: day });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Relógio preso: o alvo default do store depende de "hoje", e um teste que
  // dependesse do dia real do CI só falharia em certas datas do mês
  jest.useFakeTimers({ now: new Date("2026-08-05T12:00:00Z") });
  setAnchor(1);
  useAnalyticsStore.setState({
    data: null,
    months: [],
    selectedMonth: null,
    isLoading: false,
    error: null,
    homeData: null,
    isHomeLoading: false,
  });
});

afterEach(() => {
  jest.useRealTimers();
});

describe("hasMovement", () => {
  it("separa 'sem consolidação' de 'consolidação zerada'", () => {
    expect(hasMovement(null)).toBe(false);
    expect(hasMovement(vazia())).toBe(false);
    expect(hasMovement(analytics())).toBe(true);
    // só entrada, ou só saída, já é movimento
    expect(hasMovement(analytics({ totalExpense: 0 }))).toBe(true);
    expect(hasMovement(analytics({ totalIncome: 0 }))).toBe(true);
  });
});

describe("fetchMonths — alvo inicial", () => {
  it("em modo mês cai no mês de calendário mais recente", async () => {
    mockedMonths.mockResolvedValue(["2026-08", "2026-07"]);

    await useAnalyticsStore.getState().fetchMonths();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-08");
  });

  it("abre no ciclo que contém HOJE, e não no mês mais recente", async () => {
    // Âncora 12, hoje dia 5: o ciclo corrente é 12/07→11/08, que começou em
    // julho. Com `months[0]` a Análise abria em 12/08→11/09 — uma janela que
    // ainda nem começou, vazia, enquanto a Home mostrava o período certo
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-08", "2026-07"]);

    await useAnalyticsStore.getState().fetchMonths();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-07");
  });

  it("a partir do dia da âncora, o ciclo corrente já é o do próprio mês", async () => {
    jest.setSystemTime(new Date("2026-08-20T12:00:00Z"));
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-08", "2026-07"]);

    await useAnalyticsStore.getState().fetchMonths();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-08");
  });

  it("com histórico antigo, ancora no último mês com movimento", async () => {
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-05", "2026-04"]);

    await useAnalyticsStore.getState().fetchMonths();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-05");
  });

  it("não sobrescreve uma escolha que o usuário já fez", async () => {
    useAnalyticsStore.setState({ selectedMonth: "2026-03" });
    mockedMonths.mockResolvedValue(["2026-08", "2026-07"]);

    await useAnalyticsStore.getState().fetchMonths();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-03");
  });
});

describe("fetchMonthly — recorte enviado à API", () => {
  it("modo mês manda `month`, sem janela junto (400 na API)", async () => {
    mockedMonthly.mockResolvedValue(analytics());

    await useAnalyticsStore.getState().fetchMonthly("2026-08");

    expect(mockedMonthly).toHaveBeenCalledWith({
      kind: "month",
      month: "2026-08",
    });
  });

  it("fora do dia 1 manda a janela do ciclo", async () => {
    setAnchor(12);
    mockedMonthly.mockResolvedValue(analytics({ month: null }));

    await useAnalyticsStore.getState().fetchMonthly("2026-07");

    expect(mockedMonthly).toHaveBeenCalledWith({
      kind: "window",
      start: "2026-07-12",
      end: "2026-08-11",
    });
  });

  it("sem mês escolhido, o alvo é o ciclo que contém hoje", async () => {
    setAnchor(12);
    mockedMonthly.mockResolvedValue(analytics({ month: null }));

    await useAnalyticsStore.getState().fetchMonthly();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-07");
  });

  it("mantém o mês selecionado quando a resposta vem sem `month` (modo janela)", async () => {
    setAnchor(12);
    mockedMonthly.mockResolvedValue(analytics({ month: null }));

    await useAnalyticsStore.getState().fetchMonthly("2026-07");

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-07");
  });

  it("falha de rede vira mensagem, sem apagar a consolidação anterior", async () => {
    mockedMonthly.mockRejectedValue(new Error("offline"));

    await useAnalyticsStore.getState().fetchMonthly("2026-08");

    expect(useAnalyticsStore.getState().error).toContain("Falha");
    expect(useAnalyticsStore.getState().isLoading).toBe(false);
  });
});

describe("fetchHomeMonthly — desempate da janela vazia", () => {
  it("recua um ciclo quando a janela apostada volta vazia", async () => {
    // Âncora 12, movimento só em 01–11/08: esse dinheiro pertence ao ciclo que
    // COMEÇOU em julho. O servidor informa apenas "agosto tem movimento", então
    // a primeira aposta erra e só a resposta vazia denuncia
    jest.setSystemTime(new Date("2026-08-15T12:00:00Z"));
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-08"]);
    const doCicloAnterior = analytics({ month: null, start: "2026-07-12" });
    mockedMonthly
      .mockResolvedValueOnce(vazia({ month: null, start: "2026-08-12" }))
      .mockResolvedValueOnce(doCicloAnterior);

    await useAnalyticsStore.getState().fetchHomeMonthly();

    expect(mockedMonthly).toHaveBeenNthCalledWith(2, {
      kind: "window",
      start: "2026-07-12",
      end: "2026-08-11",
    });
    expect(useAnalyticsStore.getState().homeData).toBe(doCicloAnterior);
  });

  it("não tenta recuar quando a janela já tem movimento", async () => {
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-08"]);
    mockedMonthly.mockResolvedValue(analytics({ month: null }));

    await useAnalyticsStore.getState().fetchHomeMonthly();

    expect(mockedMonthly).toHaveBeenCalledTimes(1);
  });

  it("não tenta recuar quando não há extrato nenhum", async () => {
    // Sem meses conhecidos a resposta certa é o onboarding, não caçar ciclo
    setAnchor(12);
    mockedMonths.mockResolvedValue([]);
    mockedMonthly.mockResolvedValue(vazia({ month: null }));

    await useAnalyticsStore.getState().fetchHomeMonthly();

    expect(mockedMonthly).toHaveBeenCalledTimes(1);
  });

  it("ciclo anterior também vazio mantém o recorte corrente na tela", async () => {
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-08"]);
    const corrente = vazia({ month: null, start: "2026-08-12" });
    mockedMonthly
      .mockResolvedValueOnce(corrente)
      .mockResolvedValueOnce(vazia({ month: null, start: "2026-07-12" }));

    await useAnalyticsStore.getState().fetchHomeMonthly();

    expect(useAnalyticsStore.getState().homeData).toBe(corrente);
  });

  it("em modo mês nunca gasta a segunda chamada", async () => {
    mockedMonths.mockResolvedValue(["2026-08"]);
    mockedMonthly.mockResolvedValue(analytics());

    await useAnalyticsStore.getState().fetchHomeMonthly();

    expect(mockedMonthly).toHaveBeenCalledTimes(1);
  });
});

describe("reloadAnalyticsForAnchorChange", () => {
  it("reancora o chip que deixa de existir ao voltar para o dia 1", async () => {
    // "2026-06" só existe como chip em modo janela (é o ciclo extra que cobre o
    // começo do histórico). Voltando para o dia 1 ele some da régua, e manter a
    // seleção deixaria a tela com dados e nenhum chip marcado
    useAnalyticsStore.setState({
      months: ["2026-08", "2026-07"],
      selectedMonth: "2026-06",
    });
    setAnchor(1);
    mockedMonths.mockResolvedValue(["2026-08", "2026-07"]);
    mockedMonthly.mockResolvedValue(analytics());

    await reloadAnalyticsForAnchorChange();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-08");
  });

  it("preserva a seleção quando ela continua na régua", async () => {
    useAnalyticsStore.setState({
      months: ["2026-08", "2026-07"],
      selectedMonth: "2026-07",
    });
    setAnchor(12);
    mockedMonths.mockResolvedValue(["2026-08", "2026-07"]);
    mockedMonthly.mockResolvedValue(analytics({ month: null }));

    await reloadAnalyticsForAnchorChange();

    expect(useAnalyticsStore.getState().selectedMonth).toBe("2026-07");
  });
});
