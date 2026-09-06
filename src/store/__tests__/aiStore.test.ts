import api from "../../services/api";
import { useAiStore } from "../aiStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { post: jest.fn() },
}));

const mockPost = (api as unknown as { post: jest.Mock }).post;

const mensagens = () => useAiStore.getState().messages;

describe("aiStore — a conversa com o assistente", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAiStore.getState().clearHistory();
  });

  it("a pergunta aparece na hora, antes de a resposta chegar", async () => {
    mockPost.mockResolvedValue({ data: { reply: "Você gastou R$ 500." } });

    await useAiStore.getState().sendMessage("Quanto gastei?");

    const lista = mensagens();
    // Lista do mais novo para o mais antigo: resposta no topo, pergunta abaixo
    expect(lista[0].isUser).toBe(false);
    expect(lista[0].text).toBe("Você gastou R$ 500.");
    expect(lista[1].isUser).toBe(true);
    expect(lista[1].text).toBe("Quanto gastei?");
    expect(useAiStore.getState().isLoading).toBe(false);
  });

  it("a pergunta vai no corpo, para a rota do chat", async () => {
    mockPost.mockResolvedValue({ data: { reply: "ok" } });

    await useAiStore.getState().sendMessage("Oi");

    // Primeira pergunta da conversa: histórico vazio, e a saudação de boas-
    // vindas fica de fora dele — não é fala de ninguém
    expect(mockPost).toHaveBeenCalledWith("/chat", {
      message: "Oi",
      history: [],
    });
  });

  it("a conversa até aqui viaja junto, da mais ANTIGA para a mais recente", async () => {
    mockPost.mockResolvedValue({ data: { reply: "Foram R$ 400." } });
    await useAiStore.getState().sendMessage("Quanto gastei com mercado?");
    mockPost.mockClear();
    mockPost.mockResolvedValue({ data: { reply: "No mês passado, R$ 380." } });

    // Sem histórico, "e no mês passado?" chegaria ao modelo como uma primeira
    // pergunta solta — e a resposta seria necessariamente sobre nada
    await useAiStore.getState().sendMessage("E no mês passado?");

    expect(mockPost).toHaveBeenCalledWith("/chat", {
      message: "E no mês passado?",
      history: [
        { role: "user", content: "Quanto gastei com mercado?" },
        { role: "assistant", content: "Foram R$ 400." },
      ],
    });
  });

  it("pergunta que falhou não entra no histórico — ela nunca chegou ao modelo", async () => {
    mockPost.mockRejectedValueOnce(new Error("offline"));
    await useAiStore.getState().sendMessage("Pergunta perdida");
    mockPost.mockClear();
    mockPost.mockResolvedValue({ data: { reply: "ok" } });

    await useAiStore.getState().sendMessage("Outra");

    expect(mockPost).toHaveBeenCalledWith("/chat", {
      message: "Outra",
      history: [],
    });
  });

  it("o histórico para em 12 falas — cada uma é token pago", async () => {
    mockPost.mockResolvedValue({ data: { reply: "ok" } });
    for (let i = 0; i < 10; i += 1) {
      await useAiStore.getState().sendMessage(`Pergunta ${i}`);
    }
    mockPost.mockClear();

    await useAiStore.getState().sendMessage("Última");

    const corpo = mockPost.mock.calls[0][1] as { history: unknown[] };
    expect(corpo.history).toHaveLength(12);
  });

  it("falha marca a PERGUNTA como erro, e devolve falso para a tela", async () => {
    mockPost.mockRejectedValue(new Error("offline"));

    const ok = await useAiStore.getState().sendMessage("Quanto gastei?");

    // O retorno existe para a tela escolher o haptic certo: antes vibrava
    // "sucesso" até quando a resposta não vinha
    expect(ok).toBe(false);
    expect(mensagens()[0].isError).toBe(true);
    expect(useAiStore.getState().isLoading).toBe(false);
  });

  it("tentar de novo reaproveita o balão, sem duplicar a pergunta", async () => {
    mockPost.mockRejectedValueOnce(new Error("offline"));
    await useAiStore.getState().sendMessage("Quanto gastei?");
    const idDaPergunta = mensagens()[0].id;
    const quantasAntes = mensagens().length;

    mockPost.mockResolvedValueOnce({ data: { reply: "R$ 500." } });
    const ok = await useAiStore.getState().retryMessage(idDaPergunta);

    expect(ok).toBe(true);
    // Uma mensagem a mais (a resposta), e não duas
    expect(mensagens()).toHaveLength(quantasAntes + 1);
    expect(mensagens().find((m) => m.id === idDaPergunta)?.isError).toBeFalsy();
  });

  it("tentar de novo em mensagem que não falhou não faz nada", async () => {
    mockPost.mockResolvedValue({ data: { reply: "ok" } });
    await useAiStore.getState().sendMessage("Oi");
    jest.clearAllMocks();

    const ok = await useAiStore.getState().retryMessage("nao-existe");

    expect(ok).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("limpar o histórico deixa só a saudação", () => {
    useAiStore.setState({
      messages: [
        { id: "1", text: "a", isUser: true, timestamp: 1 },
        { id: "2", text: "b", isUser: false, timestamp: 2 },
      ],
    });

    useAiStore.getState().clearHistory();

    expect(mensagens()).toHaveLength(1);
    expect(mensagens()[0].isUser).toBe(false);
    expect(mensagens()[0].text).toMatch(/limpo/i);
  });

  it("a conversa não cresce sem limite", async () => {
    // 50 é o teto: sem ele, o histórico persistido cresceria para sempre no
    // armazenamento do aparelho
    useAiStore.setState({
      messages: Array.from({ length: 50 }, (_, i) => ({
        id: `m${i}`,
        text: `msg ${i}`,
        isUser: false,
        timestamp: i,
      })),
    });
    mockPost.mockResolvedValue({ data: { reply: "nova" } });

    await useAiStore.getState().sendMessage("pergunta");

    expect(mensagens().length).toBeLessThanOrEqual(50);
    expect(mensagens()[0].text).toBe("nova");
  });
});
