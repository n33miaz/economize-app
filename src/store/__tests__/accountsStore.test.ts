import type { AccountInvoices, ConnectorAccount } from "../../services/api";
import { useAccountsStore } from "../accountsStore";

// A camada de rede é o limite. `getApiErrorStatus` entra com a mesma leitura
// do original (o status do ProblemDetail) porque é dele que sai a mensagem
// específica de 400 e 404 — sem isso o teste provaria só o texto genérico.
jest.mock("../../services/api", () => ({
  getAccounts: jest.fn(),
  getAccountInvoices: jest.fn(),
  getApiErrorStatus: (error: any) => error?.response?.status ?? null,
}));

const api = jest.requireMock("../../services/api");

function account(overrides: Partial<ConnectorAccount> = {}): ConnectorAccount {
  return {
    id: "acc-cartao",
    name: "Ultravioleta ····1234",
    type: "CREDIT_CARD",
    institution: "Nubank",
    statementClosingDay: 10,
    statementDueDay: 17,
    linked: true,
    ...overrides,
  };
}

function payload(overrides: Partial<AccountInvoices> = {}): AccountInvoices {
  return {
    accountId: "acc-cartao",
    accountName: "Ultravioleta ····1234",
    accountType: "CREDIT_CARD",
    institution: "Nubank",
    cycleSource: "PROVIDER_CLOSING_DAY",
    invoices: [],
    ...overrides,
  };
}

function problem(status: number) {
  return { response: { status, data: { detail: "…" } } };
}

beforeEach(() => {
  jest.clearAllMocks();
  useAccountsStore.setState({
    accounts: [],
    byId: new Map(),
    isLoading: false,
    hasLoadedOnce: false,
    error: null,
    invoices: {},
  });
});

describe("carregamento das contas", () => {
  it("guarda a lista e o mapa por id", () => {
    api.getAccounts.mockResolvedValue([account(), account({ id: "acc-conta" })]);
    return useAccountsStore
      .getState()
      .fetchAccounts()
      .then(() => {
        const state = useAccountsStore.getState();
        expect(state.accounts).toHaveLength(2);
        expect(state.byId.get("acc-cartao")?.name).toBe("Ultravioleta ····1234");
        expect(state.hasLoadedOnce).toBe(true);
        expect(state.error).toBeNull();
      });
  });

  it("carrega uma vez só: a segunda tela reaproveita o cache", async () => {
    // O extrato devolve só `accountId`; três telas precisam do mesmo mapa e
    // nenhuma delas deve custar uma requisição nova
    api.getAccounts.mockResolvedValue([account()]);
    await useAccountsStore.getState().fetchAccounts();
    await useAccountsStore.getState().fetchAccounts();
    expect(api.getAccounts).toHaveBeenCalledTimes(1);
  });

  it("recarrega quando alguém força — é o caso da sincronização", async () => {
    api.getAccounts.mockResolvedValue([account()]);
    await useAccountsStore.getState().fetchAccounts();
    await useAccountsStore.getState().fetchAccounts(true);
    expect(api.getAccounts).toHaveBeenCalledTimes(2);
  });

  it("chamada concorrente não duplica a requisição", async () => {
    api.getAccounts.mockResolvedValue([account()]);
    await Promise.all([
      useAccountsStore.getState().fetchAccounts(),
      useAccountsStore.getState().fetchAccounts(),
    ]);
    expect(api.getAccounts).toHaveBeenCalledTimes(1);
  });

  it("falha guarda a mensagem sem derrubar o extrato", async () => {
    api.getAccounts.mockRejectedValue(new Error("offline"));
    await useAccountsStore.getState().fetchAccounts();
    const state = useAccountsStore.getState();
    expect(state.error).toBe("Não foi possível carregar suas contas agora.");
    expect(state.isLoading).toBe(false);
    expect(state.accounts).toEqual([]);
  });

  it("falha NÃO vira cache: o próximo foco tenta de novo", async () => {
    // Marcar `hasLoadedOnce` no catch transformava um 500 de dois segundos no
    // cold start em recurso desligado pelo resto da sessão — toda tela batia
    // na guarda de cache e voltava sem tentar, e no celular não sobrava
    // caminho para o retry manual
    api.getAccounts.mockRejectedValueOnce(new Error("offline"));
    await useAccountsStore.getState().fetchAccounts();
    expect(useAccountsStore.getState().hasLoadedOnce).toBe(false);

    api.getAccounts.mockResolvedValueOnce([account()]);
    await useAccountsStore.getState().fetchAccounts();
    expect(api.getAccounts).toHaveBeenCalledTimes(2);
    expect(useAccountsStore.getState().accounts).toHaveLength(1);
    expect(useAccountsStore.getState().error).toBeNull();
  });

  it("conta nenhuma é resposta, não erro", async () => {
    // Quem nunca sincronizou conector recebe array vazio — a tela de cartões
    // precisa distinguir isso de "ainda não perguntei"
    api.getAccounts.mockResolvedValue([]);
    await useAccountsStore.getState().fetchAccounts();
    expect(useAccountsStore.getState().hasLoadedOnce).toBe(true);
    expect(useAccountsStore.getState().error).toBeNull();
  });
});

describe("faturas por cartão", () => {
  it("guarda a resposta e a janela pedida", async () => {
    api.getAccountInvoices.mockResolvedValue(payload());
    await useAccountsStore.getState().fetchInvoices("acc-cartao", 12);
    expect(api.getAccountInvoices).toHaveBeenCalledWith("acc-cartao", 12);
    const slot = useAccountsStore.getState().invoices["acc-cartao"];
    expect(slot.data?.accountName).toBe("Ultravioleta ····1234");
    expect(slot.months).toBe(12);
    expect(slot.isLoading).toBe(false);
  });

  it("cada cartão tem seu próprio estado", async () => {
    api.getAccountInvoices
      .mockResolvedValueOnce(payload())
      .mockRejectedValueOnce(problem(404));
    await useAccountsStore.getState().fetchInvoices("acc-cartao");
    await useAccountsStore.getState().fetchInvoices("outro-cartao");
    const invoices = useAccountsStore.getState().invoices;
    expect(invoices["acc-cartao"].error).toBeNull();
    expect(invoices["outro-cartao"].error).toContain("Não encontramos");
  });

  it("trocar a janela não pisca a lista: o que está na tela continua", async () => {
    api.getAccountInvoices.mockResolvedValue(payload());
    await useAccountsStore.getState().fetchInvoices("acc-cartao", 6);

    let liberar: (value: unknown) => void = () => {};
    api.getAccountInvoices.mockReturnValueOnce(
      new Promise((resolve) => {
        liberar = resolve;
      }),
    );
    const emVoo = useAccountsStore.getState().fetchInvoices("acc-cartao", 12);

    const durante = useAccountsStore.getState().invoices["acc-cartao"];
    expect(durante.isLoading).toBe(true);
    expect(durante.data).not.toBeNull();

    liberar(payload({ cycleSource: "CALENDAR_MONTH" }));
    await emVoo;
    expect(
      useAccountsStore.getState().invoices["acc-cartao"].data?.cycleSource,
    ).toBe("CALENDAR_MONTH");
  });

  it("400 de conta que não é cartão vira frase de produto", async () => {
    api.getAccountInvoices.mockRejectedValue(problem(400));
    await useAccountsStore.getState().fetchInvoices("acc-conta");
    expect(useAccountsStore.getState().invoices["acc-conta"].error).toContain(
      "não tem fatura",
    );
  });

  it("erro preserva a fatura que já estava na tela", async () => {
    api.getAccountInvoices.mockResolvedValueOnce(payload());
    await useAccountsStore.getState().fetchInvoices("acc-cartao");
    api.getAccountInvoices.mockRejectedValueOnce(new Error("offline"));
    await useAccountsStore.getState().fetchInvoices("acc-cartao", 3);

    const slot = useAccountsStore.getState().invoices["acc-cartao"];
    expect(slot.data).not.toBeNull();
    expect(slot.error).toContain("Tente de novo");
    expect(slot.isLoading).toBe(false);
  });

  it("pedido IDÊNTICO com um em voo não dispara outra chamada", async () => {
    let liberar: (value: unknown) => void = () => {};
    api.getAccountInvoices.mockReturnValueOnce(
      new Promise((resolve) => {
        liberar = resolve;
      }),
    );
    const emVoo = useAccountsStore.getState().fetchInvoices("acc-cartao");
    await useAccountsStore.getState().fetchInvoices("acc-cartao");
    expect(api.getAccountInvoices).toHaveBeenCalledTimes(1);
    liberar(payload());
    await emVoo;
  });

  it("trocar a janela DURANTE o carregamento não é descartado em silêncio", async () => {
    // A corrida de verdade, e não a versão que espera a primeira terminar:
    // o usuário toca "12 meses" enquanto os 6 ainda estão no ar. A guarda
    // antiga descartava o pedido novo, o de 6 chegava e gravava `months: 6`,
    // e as deps do efeito da tela já não mudavam mais — seletor em 12, lista
    // de 6, sem sinal e sem saída
    let liberarSeis: (value: unknown) => void = () => {};
    api.getAccountInvoices.mockReturnValueOnce(
      new Promise((resolve) => {
        liberarSeis = resolve;
      }),
    );
    const seis = useAccountsStore.getState().fetchInvoices("acc-cartao", 6);

    api.getAccountInvoices.mockResolvedValueOnce(
      payload({ cycleSource: "CALENDAR_MONTH" }),
    );
    const doze = useAccountsStore.getState().fetchInvoices("acc-cartao", 12);

    expect(api.getAccountInvoices).toHaveBeenCalledTimes(2);
    expect(api.getAccountInvoices).toHaveBeenLastCalledWith("acc-cartao", 12);
    await doze;

    // A resposta atrasada da janela abandonada chega DEPOIS e não pode
    // sobrescrever a que o usuário está vendo
    liberarSeis(payload({ cycleSource: "PROVIDER_CLOSING_DAY" }));
    await seis;

    const slot = useAccountsStore.getState().invoices["acc-cartao"];
    expect(slot.months).toBe(12);
    expect(slot.data?.cycleSource).toBe("CALENDAR_MONTH");
    expect(slot.isLoading).toBe(false);
  });

  it("erro da janela abandonada não apaga o carregamento da janela pedida", async () => {
    let falharSeis: (reason: unknown) => void = () => {};
    api.getAccountInvoices.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        falharSeis = reject;
      }),
    );
    const seis = useAccountsStore.getState().fetchInvoices("acc-cartao", 6);

    api.getAccountInvoices.mockResolvedValueOnce(payload());
    await useAccountsStore.getState().fetchInvoices("acc-cartao", 12);

    falharSeis(problem(404));
    await seis;

    const slot = useAccountsStore.getState().invoices["acc-cartao"];
    expect(slot.error).toBeNull();
    expect(slot.months).toBe(12);
    expect(slot.data).not.toBeNull();
  });
});

describe("fim de sessão", () => {
  it("reset zera contas, mapa, faturas E o cache", async () => {
    // Sem zerar `hasLoadedOnce`, `fetchAccounts()` devolveria na hora e o mapa
    // da conta anterior sobreviveria a um login com outra conta até o app
    // reiniciar — com os nomes dos cartões dela já desenhados nos chips
    api.getAccounts.mockResolvedValue([account()]);
    api.getAccountInvoices.mockResolvedValue(payload());
    await useAccountsStore.getState().fetchAccounts();
    await useAccountsStore.getState().fetchInvoices("acc-cartao");
    expect(useAccountsStore.getState().byId.size).toBe(1);

    useAccountsStore.getState().reset();

    const state = useAccountsStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.byId.size).toBe(0);
    expect(state.invoices).toEqual({});
    expect(state.error).toBeNull();
    expect(state.hasLoadedOnce).toBe(false);
  });

  it("depois do reset a próxima tela pergunta de novo", async () => {
    api.getAccounts.mockResolvedValue([account()]);
    await useAccountsStore.getState().fetchAccounts();
    useAccountsStore.getState().reset();
    await useAccountsStore.getState().fetchAccounts();
    expect(api.getAccounts).toHaveBeenCalledTimes(2);
  });
});
