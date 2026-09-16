import { getInstallments } from "../../services/api";
import { INSTALLMENTS_TTL_MS, useInstallmentsStore } from "../installmentsStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn() },
  getInstallments: jest.fn(),
}));

const getInstallmentsMock = getInstallments as jest.MockedFunction<
  typeof getInstallments
>;

const RESPOSTA = {
  totalSeries: 1,
  openSeries: 1,
  remainingTotal: 199.96,
  series: [
    {
      description: "Mercadolivre*Bwgshop",
      total: 3,
      seen: 2,
      remaining: 1,
      installmentAmount: 199.96,
      remainingAmount: 199.96,
      firstMonth: "2026-08",
      lastMonth: "2026-10",
      finished: false,
    },
  ],
};

describe("installmentsStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
    useInstallmentsStore.getState().reset();
  });

  it("busca uma vez e guarda a resposta", async () => {
    getInstallmentsMock.mockResolvedValue(RESPOSTA);

    await useInstallmentsStore.getState().fetchInstallments();

    const estado = useInstallmentsStore.getState();
    expect(estado.overview).toEqual(RESPOSTA);
    expect(estado.hasLoadedOnce).toBe(true);
    expect(estado.isLoading).toBe(false);
    expect(getInstallmentsMock).toHaveBeenCalledTimes(1);
  });

  it("dentro da janela de frescor, o segundo foco não bate no servidor", async () => {
    // A chamada varre todas as transações: voltar da aba de Finanças para a
    // Home não pode custar a varredura de novo
    getInstallmentsMock.mockResolvedValue(RESPOSTA);

    await useInstallmentsStore.getState().fetchInstallments();
    await useInstallmentsStore.getState().fetchInstallments();

    expect(getInstallmentsMock).toHaveBeenCalledTimes(1);
  });

  it("`force` ignora a janela — é o puxar-para-atualizar", async () => {
    getInstallmentsMock.mockResolvedValue(RESPOSTA);

    await useInstallmentsStore.getState().fetchInstallments();
    await useInstallmentsStore.getState().fetchInstallments(true);

    expect(getInstallmentsMock).toHaveBeenCalledTimes(2);
  });

  it("resposta velha é pedida de novo sem `force`", async () => {
    getInstallmentsMock.mockResolvedValue(RESPOSTA);
    await useInstallmentsStore.getState().fetchInstallments();

    // Envelhece a leitura além da janela em vez de mexer no relógio global
    useInstallmentsStore.setState({
      fetchedAt: Date.now() - INSTALLMENTS_TTL_MS - 1,
    });
    await useInstallmentsStore.getState().fetchInstallments();

    expect(getInstallmentsMock).toHaveBeenCalledTimes(2);
  });

  it("falha não apaga a resposta anterior nem marca como carregado", async () => {
    getInstallmentsMock.mockResolvedValueOnce(RESPOSTA);
    await useInstallmentsStore.getState().fetchInstallments();

    getInstallmentsMock.mockRejectedValueOnce(new Error("rede"));
    await useInstallmentsStore.getState().fetchInstallments(true);

    const estado = useInstallmentsStore.getState();
    expect(estado.overview).toEqual(RESPOSTA);
    expect(estado.error).toBeTruthy();
    expect(estado.isLoading).toBe(false);
  });

  it("falha na primeira carga deixa o próximo foco tentar de novo", async () => {
    getInstallmentsMock.mockRejectedValueOnce(new Error("rede"));
    await useInstallmentsStore.getState().fetchInstallments();
    expect(useInstallmentsStore.getState().hasLoadedOnce).toBe(false);

    getInstallmentsMock.mockResolvedValueOnce(RESPOSTA);
    await useInstallmentsStore.getState().fetchInstallments();

    expect(useInstallmentsStore.getState().overview).toEqual(RESPOSTA);
    expect(getInstallmentsMock).toHaveBeenCalledTimes(2);
  });

  it("reset zera tudo — a próxima conta não herda os parcelamentos da anterior", async () => {
    getInstallmentsMock.mockResolvedValue(RESPOSTA);
    await useInstallmentsStore.getState().fetchInstallments();

    useInstallmentsStore.getState().reset();

    const estado = useInstallmentsStore.getState();
    expect(estado.overview).toBeNull();
    expect(estado.hasLoadedOnce).toBe(false);
    expect(estado.fetchedAt).toBeNull();
  });
});
