import {
  parsePluggyReturn,
  useConnectorStore,
  WEB_BASE_URL,
} from "../connectorStore";

jest.mock("../../services/api", () => ({
  getPluggyStatus: jest.fn(),
  listPluggyItems: jest.fn(),
  createPluggyConnectToken: jest.fn(),
  registerPluggyItem: jest.fn(),
  unlinkPluggyItem: jest.fn(),
  syncPluggy: jest.fn(),
}));

const api = jest.requireMock("../../services/api");

const item = (id: string) => ({
  id,
  itemId: "pluggy-" + id,
  connectorId: 200,
  connectorName: "Meu Pluggy",
  createdAt: "2026-08-30T00:00:00Z",
  lastSyncedAt: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  useConnectorStore.getState().reset();
  api.getPluggyStatus.mockResolvedValue({
    enabled: true,
    configured: true,
    itemCount: 1,
  });
  api.listPluggyItems.mockResolvedValue([item("a")]);
});

describe("parsePluggyReturn", () => {
  it("lê o id no fragmento", () => {
    expect(parsePluggyReturn("economize://pluggy#pluggy_item=abc-123")).toEqual({
      itemId: "abc-123",
    });
  });

  it("reconhece o cancelamento como coisa diferente de erro", () => {
    // Fechar o widget é escolha do usuário; virar mensagem de falha assusta
    expect(parsePluggyReturn("economize://pluggy#pluggy_cancelado=1")).toEqual({
      cancelado: true,
    });
  });

  it("devolve o erro que a ponte mandou", () => {
    const r = parsePluggyReturn("economize://pluggy#erro=banco%20recusou");
    expect(r).toEqual({ erro: "banco recusou" });
  });

  it("ignora URL que não é retorno do Pluggy", () => {
    expect(parsePluggyReturn("economize://outra-coisa")).toBeNull();
    expect(parsePluggyReturn("https://exemplo.test/#outro=1")).toBeNull();
    expect(parsePluggyReturn(null)).toBeNull();
    expect(parsePluggyReturn("")).toBeNull();
  });
});

describe("buildConnectUrl", () => {
  it("põe token e destino no fragmento, nunca na query", async () => {
    // Fragmento não vai ao servidor: nem log de acesso nem Referer o carregam
    api.createPluggyConnectToken.mockResolvedValue("tok-secreto");

    const url = await useConnectorStore
      .getState()
      .buildConnectUrl("economize://pluggy");

    expect(url).toBe(
      `${WEB_BASE_URL}/pluggy-connect.html#token=tok-secreto&redirect=economize%3A%2F%2Fpluggy`,
    );
    expect(url!.split("#")[0]).not.toContain("tok-secreto");
  });

  it("falha ao pegar o token vira mensagem, não exceção", async () => {
    api.createPluggyConnectToken.mockRejectedValue({
      response: { data: { detail: "conector desligado" } },
    });

    const url = await useConnectorStore
      .getState()
      .buildConnectUrl("economize://pluggy");

    expect(url).toBeNull();
    expect(useConnectorStore.getState().error).toBe("conector desligado");
    expect(useConnectorStore.getState().isLinking).toBe(false);
  });
});

describe("finishConnect", () => {
  it("registra e recarrega status e lista juntos", async () => {
    api.registerPluggyItem.mockResolvedValue(item("b"));

    const ok = await useConnectorStore.getState().finishConnect("pluggy-b");

    expect(ok).toBe(true);
    expect(api.registerPluggyItem).toHaveBeenCalledWith("pluggy-b");
    expect(api.getPluggyStatus).toHaveBeenCalled();
    expect(api.listPluggyItems).toHaveBeenCalled();
  });

  it("409 conta como sucesso — a conta já está conectada", async () => {
    // O usuário pediu para conectar e a conexão existe. Mostrar erro aqui
    // faria ele tentar de novo um problema que não existe
    api.registerPluggyItem.mockRejectedValue({ response: { status: 409 } });

    const ok = await useConnectorStore.getState().finishConnect("pluggy-a");

    expect(ok).toBe(true);
    expect(useConnectorStore.getState().error).toBeNull();
  });

  it("404 é erro de verdade e fala com o usuário", async () => {
    api.registerPluggyItem.mockRejectedValue({
      response: { status: 404, data: { detail: "conexão não encontrada" } },
    });

    const ok = await useConnectorStore.getState().finishConnect("x");

    expect(ok).toBe(false);
    expect(useConnectorStore.getState().error).toBe("conexão não encontrada");
  });
});

describe("fetchItems e unlink", () => {
  it("não pede a lista com o conector desligado", async () => {
    useConnectorStore.setState({
      pluggy: { enabled: false, configured: false, itemCount: 0 },
    });

    await useConnectorStore.getState().fetchItems();

    expect(api.listPluggyItems).not.toHaveBeenCalled();
  });

  it("desconectar tira da lista e reconfere o status", async () => {
    useConnectorStore.setState({
      pluggy: { enabled: true, configured: true, itemCount: 2 },
      items: [item("a"), item("b")],
    });
    api.unlinkPluggyItem.mockResolvedValue(undefined);

    const ok = await useConnectorStore.getState().unlink("a");

    expect(ok).toBe(true);
    expect(useConnectorStore.getState().items.map((i) => i.id)).toEqual(["b"]);
    expect(api.getPluggyStatus).toHaveBeenCalled();
  });
});
