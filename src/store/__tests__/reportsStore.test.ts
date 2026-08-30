import type { Report } from "../reportsStore";
import { useReportsStore } from "../reportsStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const api = jest.requireMock("../../services/api").default;

function relatorio(id: string): Report {
  return {
    id,
    period: "MONTHLY",
    startDate: "2026-08-12T00:00:00Z",
    endDate: "2026-09-11T00:00:00Z",
    totalIncome: 5000,
    totalExpense: 3200,
    dominantCategory: "Alimentação",
    summary: null,
  } as Report;
}

beforeEach(() => {
  jest.clearAllMocks();
  useReportsStore.setState({ items: [], error: null });
});

describe("remove — EC-038", () => {
  it("tira o relatório da lista e confirma com true", async () => {
    useReportsStore.setState({ items: [relatorio("a"), relatorio("b")] });
    api.delete.mockResolvedValue({});

    const ok = await useReportsStore.getState().remove("a");

    expect(ok).toBe(true);
    expect(api.delete).toHaveBeenCalledWith("/reports/a");
    expect(useReportsStore.getState().items.map((r) => r.id)).toEqual(["b"]);
  });

  it("falha devolve false e preserva a lista", async () => {
    useReportsStore.setState({ items: [relatorio("a")] });
    api.delete.mockRejectedValue(new Error("500"));

    const ok = await useReportsStore.getState().remove("a");

    expect(ok).toBe(false);
    expect(useReportsStore.getState().items).toHaveLength(1);
    expect(useReportsStore.getState().error).toBeTruthy();
  });

  it("sucesso limpa erro de uma tentativa anterior", async () => {
    // Sem isso, a falha antiga ficava grudada no estado e a tela seguia
    // anunciando fracasso depois de a exclusão dar certo
    useReportsStore.setState({
      items: [relatorio("a")],
      error: "Falha ao remover relatório",
    });
    api.delete.mockResolvedValue({});

    await useReportsStore.getState().remove("a");

    expect(useReportsStore.getState().error).toBeNull();
  });

  it("id inexistente não derruba a lista", async () => {
    useReportsStore.setState({ items: [relatorio("a")] });
    api.delete.mockResolvedValue({});

    await useReportsStore.getState().remove("nao-existe");

    expect(useReportsStore.getState().items.map((r) => r.id)).toEqual(["a"]);
  });
});
