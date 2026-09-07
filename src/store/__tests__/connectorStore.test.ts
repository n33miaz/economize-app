import {
  CONNECT_BRIDGE_PAGE,
  parseConnectReturn,
  useConnectorStore,
  WEB_BASE_URL,
} from "../connectorStore";

jest.mock("../../services/api", () => ({
  getConnectorStatus: jest.fn(),
  listConnectorItems: jest.fn(),
  createConnectToken: jest.fn(),
  registerConnectorItem: jest.fn(),
  unlinkConnectorItem: jest.fn(),
  syncConnector: jest.fn(),
}));

const api = jest.requireMock("../../services/api");

// O status "ligado" como o servidor o devolve: com o widget que a ponte vai
// carregar. Nomes de exemplo de propósito — provedor é detalhe do servidor
const STATUS_LIGADO = {
  enabled: true,
  configured: true,
  itemCount: 1,
  provider: { id: "exemplo", displayName: "Exemplo" },
  widget: {
    scriptUrl: "https://cdn.exemplo.test/widget.js",
    kind: "exemplo-connect",
  },
};

const item = (id: string) => ({
  id,
  itemId: "conexao-" + id,
  connectorId: 200,
  // O nome do conector no agregador nunca vai para a tela; a instituição vai
  connectorName: "MeuAgregador",
  institution: "Banco Inter S.A.",
  createdAt: "2026-08-30T00:00:00Z",
  lastSyncedAt: null,
});

beforeEach(() => {
  jest.clearAllMocks();
  useConnectorStore.getState().reset();
  api.getConnectorStatus.mockResolvedValue(STATUS_LIGADO);
  api.listConnectorItems.mockResolvedValue([item("a")]);
});

describe("parseConnectReturn", () => {
  it("lê o id no fragmento", () => {
    expect(parseConnectReturn("economize://conectar#item=abc-123")).toEqual({
      itemId: "abc-123",
    });
  });

  it("reconhece o cancelamento como coisa diferente de erro", () => {
    // Fechar o widget é escolha do usuário; virar mensagem de falha assusta
    expect(parseConnectReturn("economize://conectar#cancelado=1")).toEqual({
      cancelado: true,
    });
  });

  it("devolve o erro que a ponte mandou", () => {
    const r = parseConnectReturn("economize://conectar#erro=banco%20recusou");
    expect(r).toEqual({ erro: "banco recusou" });
  });

  it("ignora URL que não é retorno da ponte", () => {
    expect(parseConnectReturn("economize://outra-coisa")).toBeNull();
    expect(parseConnectReturn("https://exemplo.test/#outro=1")).toBeNull();
    expect(parseConnectReturn(null)).toBeNull();
    expect(parseConnectReturn("")).toBeNull();
  });
});

describe("buildConnectUrl", () => {
  beforeEach(() => {
    useConnectorStore.setState({ status: STATUS_LIGADO });
  });

  it("põe token, destino e o widget no fragmento, nunca na query", async () => {
    // Fragmento não vai ao servidor: nem log de acesso nem Referer o carregam.
    // O script do widget vai junto porque a ponte não conhece provedor nenhum
    api.createConnectToken.mockResolvedValue("tok-secreto");

    const url = await useConnectorStore
      .getState()
      .buildConnectUrl("economize://conectar");

    expect(url).toBe(
      `${WEB_BASE_URL}/${CONNECT_BRIDGE_PAGE}#token=tok-secreto` +
        "&redirect=economize%3A%2F%2Fconectar" +
        "&widget=https%3A%2F%2Fcdn.exemplo.test%2Fwidget.js" +
        "&kind=exemplo-connect",
    );
    expect(url!.split("#")[0]).not.toContain("tok-secreto");
    expect(url!.split("#")[0]).not.toContain("exemplo.test");
  });

  it("sem widget no status, não abre o navegador e explica", async () => {
    // Sem o script do widget a ponte só saberia mostrar erro: melhor avisar
    // aqui do que mandar o usuário para uma página que não faz nada
    useConnectorStore.setState({
      status: { enabled: true, configured: true, itemCount: 0 },
    });

    const url = await useConnectorStore
      .getState()
      .buildConnectUrl("economize://conectar");

    expect(url).toBeNull();
    expect(api.createConnectToken).not.toHaveBeenCalled();
    expect(useConnectorStore.getState().error).toMatch(/não está disponível/);
  });

  it("falha ao pegar o token vira mensagem, não exceção", async () => {
    api.createConnectToken.mockRejectedValue({
      response: { data: { detail: "conector desligado" } },
    });

    const url = await useConnectorStore
      .getState()
      .buildConnectUrl("economize://conectar");

    expect(url).toBeNull();
    expect(useConnectorStore.getState().error).toBe("conector desligado");
    expect(useConnectorStore.getState().isLinking).toBe(false);
  });
});

describe("finishConnect", () => {
  it("registra e recarrega status e lista juntos", async () => {
    api.registerConnectorItem.mockResolvedValue(item("b"));

    const ok = await useConnectorStore.getState().finishConnect("conexao-b");

    expect(ok).toBe(true);
    expect(api.registerConnectorItem).toHaveBeenCalledWith("conexao-b");
    expect(api.getConnectorStatus).toHaveBeenCalled();
    expect(api.listConnectorItems).toHaveBeenCalled();
  });

  it("409 conta como sucesso — a conta já está conectada", async () => {
    // O usuário pediu para conectar e a conexão existe. Mostrar erro aqui
    // faria ele tentar de novo um problema que não existe
    api.registerConnectorItem.mockRejectedValue({ response: { status: 409 } });

    const ok = await useConnectorStore.getState().finishConnect("conexao-a");

    expect(ok).toBe(true);
    expect(useConnectorStore.getState().error).toBeNull();
  });

  it("404 é erro de verdade e fala com o usuário", async () => {
    api.registerConnectorItem.mockRejectedValue({
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
      status: { enabled: false, configured: false, itemCount: 0 },
    });

    await useConnectorStore.getState().fetchItems();

    expect(api.listConnectorItems).not.toHaveBeenCalled();
  });

  it("desconectar tira da lista e reconfere o status", async () => {
    useConnectorStore.setState({
      status: { enabled: true, configured: true, itemCount: 2 },
      items: [item("a"), item("b")],
    });
    api.unlinkConnectorItem.mockResolvedValue(undefined);

    const ok = await useConnectorStore.getState().unlink("a");

    expect(ok).toBe(true);
    expect(useConnectorStore.getState().items.map((i) => i.id)).toEqual(["b"]);
    expect(api.getConnectorStatus).toHaveBeenCalled();
  });
});
