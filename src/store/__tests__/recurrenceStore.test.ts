import type { RecurringSeries } from "../../services/api";
import { usePreferencesStore } from "../preferencesStore";
import { useRecurrenceStore } from "../recurrenceStore";

// A camada de rede é o limite: o que interessa aqui é como o store reage a
// cada resposta da API (inclusive ao 409, que não é erro para a tela)
jest.mock("../../services/api", () => ({
  getRecurrences: jest.fn(),
  detectRecurrences: jest.fn(),
  createRecurrence: jest.fn(),
  updateRecurrence: jest.fn(),
  deleteRecurrence: jest.fn(),
  getRecurrenceForecast: jest.fn(),
}));

const api = jest.requireMock("../../services/api");

function setAnchor(day: number) {
  usePreferencesStore.setState({ cycleAnchorDay: day });
}

// Recorte que o store manda com o relógio preso em 05/08/2026 (ver beforeEach)
const CALENDAR_RANGE = { kind: "month", month: "2026-08" };
const CYCLE_RANGE = { kind: "window", start: "2026-07-12", end: "2026-08-11" };

function makeSeries(overrides: Partial<RecurringSeries> = {}): RecurringSeries {
  return {
    id: "s-1",
    merchantKey: "spotify",
    displayName: "Spotify",
    categoryId: null,
    flow: "EXPENSE",
    cadence: "MONTHLY",
    anchorDay: 30,
    dayTolerance: 3,
    amountType: "FIXED",
    expectedAmount: 21.9,
    occurrences: 12,
    firstSeenAt: null,
    lastSeenAt: null,
    active: true,
    dismissed: false,
    source: "DETECTED",
    startsAt: null,
    endsAt: null,
    nextDueDate: "2026-08-30",
    ...overrides,
  };
}

function problem(status: number, detail: string, seriesId?: string) {
  return {
    response: { status, data: { detail, ...(seriesId ? { seriesId } : {}) } },
  };
}

const INITIAL = useRecurrenceStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  // Relógio preso: o recorte da previsão é o ciclo que contém "hoje", e um
  // teste que dependesse do dia real do CI só falharia em certas datas do mês
  jest.useFakeTimers({ now: new Date("2026-08-05T12:00:00Z") });
  setAnchor(1);
  useRecurrenceStore.setState({
    ...INITIAL,
    series: [],
    dismissed: [],
    monthState: {},
    forecast: null,
    hasLoadedOnce: false,
    hasLoadedForecastOnce: false,
    isDetecting: false,
    isSaving: false,
    error: null,
    forecastError: null,
  });
});

describe("carregamento das séries", () => {
  it("guarda a lista e marca que já carregou uma vez", async () => {
    api.getRecurrences.mockResolvedValue([makeSeries()]);
    await useRecurrenceStore.getState().fetchSeries();
    const state = useRecurrenceStore.getState();
    expect(state.series).toHaveLength(1);
    expect(state.hasLoadedOnce).toBe(true);
    expect(state.error).toBeNull();
  });

  it("guarda a mensagem de erro sem apagar o que já estava na tela", async () => {
    api.getRecurrences.mockRejectedValue(new Error("offline"));
    await useRecurrenceStore.getState().fetchSeries();
    expect(useRecurrenceStore.getState().error).toBe(
      "Falha ao carregar suas recorrências.",
    );
    expect(useRecurrenceStore.getState().isLoading).toBe(false);
  });

  it("pede as descartadas com active=false, que é como o servidor as expõe", async () => {
    api.getRecurrences.mockResolvedValue([
      makeSeries({ id: "s-2", active: false, dismissed: true }),
    ]);
    await useRecurrenceStore.getState().fetchDismissed();
    expect(api.getRecurrences).toHaveBeenCalledWith({ active: false });
    expect(useRecurrenceStore.getState().dismissed).toHaveLength(1);
    expect(useRecurrenceStore.getState().dismissedError).toBeNull();
  });

  it("erro nas descartadas vira mensagem com retry, não vazio silencioso", async () => {
    // sem a mensagem, falha de rede virava "Nada descartado" — um vazio que
    // ninguém verificou
    api.getRecurrences.mockRejectedValue(new Error("offline"));
    await useRecurrenceStore.getState().fetchDismissed();
    expect(useRecurrenceStore.getState().dismissedError).toBe(
      "Falha ao carregar as recorrências descartadas.",
    );
    expect(useRecurrenceStore.getState().isLoadingDismissed).toBe(false);
  });
});

describe("estado do mês corrente", () => {
  it("deriva previsto × liquidado do primeiro mês da previsão", async () => {
    api.getRecurrenceForecast.mockResolvedValue({
      startingBalance: 0,
      months: [
        {
          month: "2026-08",
          start: "2026-08-01",
          end: "2026-08-31",
          expectedIncome: 0,
          expectedExpense: 21.9,
          expectedNet: -21.9,
          cumulativeNet: -21.9,
          items: [
            {
              seriesId: "s-1",
              displayName: "Spotify",
              flow: "EXPENSE",
              dueDay: 30,
              dueDate: "2026-08-30",
              amount: 21.9,
              source: "DETECTED",
              settled: true,
            },
          ],
        },
      ],
    });
    await useRecurrenceStore.getState().fetchMonthState();
    // janela de 1 período e saldo zero: aqui só a flag `settled` importa — mas
    // o recorte vai junto, para "corrente" ser o ciclo do usuário
    expect(api.getRecurrenceForecast).toHaveBeenCalledWith(1, 0, CALENDAR_RANGE);
    expect(useRecurrenceStore.getState().monthState["s-1"].settled).toBe(true);
  });

  it("com âncora fora do dia 1 o estado do mês é o do ciclo corrente", async () => {
    setAnchor(12);
    api.getRecurrenceForecast.mockResolvedValue({ startingBalance: 0, months: [] });
    await useRecurrenceStore.getState().fetchMonthState();
    expect(api.getRecurrenceForecast).toHaveBeenCalledWith(1, 0, CYCLE_RANGE);
  });

  it("falhar aqui não pode derrubar a lista", async () => {
    api.getRecurrenceForecast.mockRejectedValue(new Error("500"));
    await useRecurrenceStore.getState().fetchMonthState();
    expect(useRecurrenceStore.getState().monthState).toEqual({});
  });
});

describe("varredura", () => {
  it("recarrega a lista e anuncia o que mudou", async () => {
    api.detectRecurrences.mockResolvedValue({
      seriesCreated: 2,
      seriesUpdated: 1,
      linksCreated: 30,
    });
    api.getRecurrences.mockResolvedValue([makeSeries()]);
    api.getRecurrenceForecast.mockResolvedValue({ startingBalance: 0, months: [] });

    const result = await useRecurrenceStore.getState().runDetection();
    expect(result.ok).toBe(true);
    expect(result.message).toBe(
      "Varredura concluída: 2 novas séries e 1 atualizada.",
    );
    expect(api.getRecurrences).toHaveBeenCalled();
    expect(useRecurrenceStore.getState().isDetecting).toBe(false);
  });

  it("libera o botão mesmo quando a varredura falha", async () => {
    api.detectRecurrences.mockRejectedValue(new Error("timeout"));
    const result = await useRecurrenceStore.getState().runDetection();
    expect(result.ok).toBe(false);
    expect(useRecurrenceStore.getState().isDetecting).toBe(false);
  });
});

describe("criar agendamento", () => {
  const payload = {
    displayName: "Conta de luz",
    flow: "EXPENSE" as const,
    cadence: "MONTHLY" as const,
    anchorDay: 10,
    expectedAmount: 189.9,
    amountType: "VARIABLE" as const,
  };

  it("acrescenta a série criada à lista", async () => {
    api.createRecurrence.mockResolvedValue(makeSeries({ id: "novo" }));
    const outcome = await useRecurrenceStore.getState().createSeries(payload);
    expect(outcome.status).toBe("saved");
    expect(useRecurrenceStore.getState().series.map((s) => s.id)).toEqual([
      "novo",
    ]);
  });

  it("devolve o seriesId do 409 em vez de erro cru", async () => {
    api.createRecurrence.mockRejectedValue(
      problem(409, "Já existe uma série recorrente...", "existente-1"),
    );
    const outcome = await useRecurrenceStore.getState().createSeries(payload);
    expect(outcome).toEqual({
      status: "conflict",
      message: expect.stringContaining("edite a que existe"),
      seriesId: "existente-1",
    });
    expect(useRecurrenceStore.getState().isSaving).toBe(false);
  });

  it("traduz o 400 de validação", async () => {
    api.createRecurrence.mockRejectedValue(
      problem(400, "Dia âncora não se aplica à cadência WEEKLY"),
    );
    const outcome = await useRecurrenceStore.getState().createSeries(payload);
    expect(outcome).toEqual({
      status: "error",
      message:
        "Cobrança semanal não tem dia do mês — deixe o dia de cobrança em branco.",
    });
  });

  it("segundo toque com salvamento em voo não dispara outra chamada", async () => {
    // dois toques no mesmo frame passam pelo disabled do botão; a trava é a
    // mesma do runDetection
    useRecurrenceStore.setState({ isSaving: true });
    const create = await useRecurrenceStore.getState().createSeries(payload);
    const update = await useRecurrenceStore
      .getState()
      .updateSeries("s-1", { displayName: "x" });
    expect(create.status).toBe("error");
    expect(update.status).toBe("error");
    expect(api.createRecurrence).not.toHaveBeenCalled();
    expect(api.updateRecurrence).not.toHaveBeenCalled();
  });
});

describe("descartar e reativar", () => {
  it("tira a série da lista e busca as descartadas quando vira descarte", async () => {
    useRecurrenceStore.setState({ series: [makeSeries()] });
    api.deleteRecurrence.mockResolvedValue({ deleted: false, deactivated: true });
    api.getRecurrences.mockResolvedValue([
      makeSeries({ active: false, dismissed: true }),
    ]);

    const result = await useRecurrenceStore.getState().discardSeries("s-1");
    expect(result.ok).toBe(true);
    expect(useRecurrenceStore.getState().series).toHaveLength(0);
    expect(api.getRecurrences).toHaveBeenCalledWith({ active: false });
  });

  it("agendamento sem vínculo é excluído de verdade", async () => {
    useRecurrenceStore.setState({ series: [makeSeries({ source: "USER" })] });
    api.deleteRecurrence.mockResolvedValue({ deleted: true, deactivated: false });
    const result = await useRecurrenceStore.getState().discardSeries("s-1");
    expect(result.message).toBe("Agendamento excluído.");
  });

  it("reativar manda active=true e devolve a série à lista ativa", async () => {
    const revived = makeSeries({ active: false, dismissed: true });
    useRecurrenceStore.setState({ series: [], dismissed: [revived] });
    api.updateRecurrence.mockResolvedValue(
      makeSeries({ active: true, dismissed: false }),
    );

    const result = await useRecurrenceStore.getState().reactivateSeries("s-1");
    expect(api.updateRecurrence).toHaveBeenCalledWith("s-1", { active: true });
    expect(result.ok).toBe(true);
    expect(useRecurrenceStore.getState().dismissed).toHaveLength(0);
    expect(useRecurrenceStore.getState().series).toHaveLength(1);
  });

  it("reativar transferência interna avisa que ela não aparece na lista", async () => {
    // o GET padrão esconde INTERNAL: devolvê-la à lista local faria a série
    // "sumir sozinha" no próximo carregamento
    const internal = makeSeries({
      id: "s-int",
      flow: "INTERNAL",
      active: false,
      dismissed: true,
    });
    useRecurrenceStore.setState({ series: [], dismissed: [internal] });
    api.updateRecurrence.mockResolvedValue(
      makeSeries({ id: "s-int", flow: "INTERNAL", active: true, dismissed: false }),
    );

    const result = await useRecurrenceStore.getState().reactivateSeries("s-int");
    expect(result.ok).toBe(true);
    expect(result.message).toContain("não aparecem na lista");
    expect(useRecurrenceStore.getState().dismissed).toHaveLength(0);
    expect(useRecurrenceStore.getState().series).toHaveLength(0);
  });
});

describe("previsão de saldo", () => {
  it("manda a janela, o saldo base e o mês corrente quando a âncora é o dia 1", async () => {
    api.getRecurrenceForecast.mockResolvedValue({
      startingBalance: 1500,
      anchorDay: 1,
      months: [],
    });
    await useRecurrenceStore.getState().fetchForecast(6, 1500);
    // só `month`: com âncora no dia 1 o recorte É o mês do calendário, e é a
    // mesma gramática que a Análise manda para /analytics/monthly
    expect(api.getRecurrenceForecast).toHaveBeenCalledWith(6, 1500, CALENDAR_RANGE);
    expect(useRecurrenceStore.getState().forecast?.startingBalance).toBe(1500);
    expect(useRecurrenceStore.getState().hasLoadedForecastOnce).toBe(true);
  });

  it("fora do dia 1 manda o ciclo que contém hoje como start/end", async () => {
    // Âncora 12 em 05/08: o ciclo corrente abriu em 12/07 e fecha em 11/08. É
    // este recorte — e não o mês de agosto — que o servidor projeta primeiro
    setAnchor(12);
    api.getRecurrenceForecast.mockResolvedValue({
      startingBalance: 0,
      anchorDay: 12,
      months: [],
    });
    await useRecurrenceStore.getState().fetchForecast(3, 0);
    expect(api.getRecurrenceForecast).toHaveBeenCalledWith(3, 0, CYCLE_RANGE);
  });

  it("esquecer a previsão zera o estado e descarta a resposta que estava em voo", async () => {
    // A troca de âncora chama isto: a resposta pedida com a âncora velha não
    // pode repovoar a tela depois que o store já foi zerado
    let resolveSlow: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      resolveSlow = resolve;
    });
    api.getRecurrenceForecast.mockReturnValueOnce(slow);

    const inFlight = useRecurrenceStore.getState().fetchForecast(3, 0);
    useRecurrenceStore.getState().invalidateForecast();
    expect(useRecurrenceStore.getState().isForecastLoading).toBe(false);
    expect(useRecurrenceStore.getState().hasLoadedForecastOnce).toBe(false);

    resolveSlow({ startingBalance: 0, anchorDay: 1, months: [{ month: "velho" }] });
    await inFlight;
    expect(useRecurrenceStore.getState().forecast).toBeNull();
    expect(useRecurrenceStore.getState().hasLoadedForecastOnce).toBe(false);
  });

  it("ignora a resposta antiga quando a janela muda no meio do caminho", async () => {
    let resolveSlow: (value: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      resolveSlow = resolve;
    });
    api.getRecurrenceForecast
      .mockReturnValueOnce(slow)
      .mockResolvedValueOnce({ startingBalance: 0, months: [{ month: "2026-08" }] });

    const first = useRecurrenceStore.getState().fetchForecast(12, 0);
    await useRecurrenceStore.getState().fetchForecast(1, 0);
    resolveSlow({ startingBalance: 0, months: [{ month: "velho" }] });
    await first;

    expect(useRecurrenceStore.getState().forecast?.months[0].month).toBe(
      "2026-08",
    );
  });

  it("guarda a mensagem traduzida quando a previsão falha", async () => {
    api.getRecurrenceForecast.mockRejectedValue(
      problem(400, "months deve estar entre 1 e 12"),
    );
    await useRecurrenceStore.getState().fetchForecast(3, 0);
    expect(useRecurrenceStore.getState().forecastError).toBe(
      "Escolha um período entre 1 e 12 meses.",
    );
  });
});
