import * as DocumentPicker from "expo-document-picker";

import {
  getBankTransactions,
  getTransactions,
  uploadBankStatement,
} from "../../services/api";
import { copiarParaCache, lerInicioEmBase64 } from "../../services/arquivoLocal";
import { recentStatementRange, useBankStore } from "../bankStore";

import type { BankTransaction } from "../../services/api";

jest.mock("../../services/api", () => ({
  getBankTransactions: jest.fn(),
  getTransactions: jest.fn(),
  uploadBankStatement: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

// O disco é do aparelho: aqui interessa o que o store FAZ com o que ele lê
jest.mock("../../services/arquivoLocal", () => ({
  BYTES_PARA_RECONHECER: 512,
  copiarParaCache: jest.fn(),
  lerInicioEmBase64: jest.fn(),
}));

const mockGet = getBankTransactions as jest.MockedFunction<typeof getBankTransactions>;
const mockRecent = getTransactions as jest.MockedFunction<typeof getTransactions>;
const mockUpload = uploadBankStatement as jest.MockedFunction<typeof uploadBankStatement>;
const mockPicker = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
>;
const mockCopiar = copiarParaCache as jest.MockedFunction<typeof copiarParaCache>;
const mockLerInicio = lerInicioEmBase64 as jest.MockedFunction<
  typeof lerInicioEmBase64
>;

const tx = (id: string, valor: number): BankTransaction =>
  ({
    id,
    transactionId: `ext-${id}`,
    type: valor < 0 ? "DEBIT" : "CREDIT",
    amount: valor,
    description: "Lançamento",
    date: "2026-07-10T12:00:00Z",
    categoryId: null,
    accountId: null,
    reviewStatus: "CONFIRMED",
  }) as BankTransaction;

/** Uma resposta que só chega quando o teste mandar. */
function adiada<T>() {
  let resolver!: (valor: T) => void;
  let rejeitar!: (erro: unknown) => void;
  const promessa = new Promise<T>((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });
  return { promessa, resolver, rejeitar };
}

/** Deixa as promessas encadeadas (a segunda fase) terminarem. */
const assentar = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

describe("bankStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // `reset` também esquece as buscas em voo do teste anterior, que vivem
    // fora do estado do zustand
    useBankStore.getState().reset();
    // Lista recente vazia: os testes antigos seguem pelo caminho de sempre
    // (a fase recente vazia não é publicada e cai na busca completa)
    mockRecent.mockResolvedValue([]);
    useBankStore.setState({
      transactions: [],
      isLoading: false,
      isImporting: false,
      error: null,
      // sem zerar a marca de tempo, a janela de cache do teste anterior
      // engoliria a busca deste
      fetchedAt: null,
      arquivoRecebido: null,
    });
  });

  it("carrega o extrato", async () => {
    mockGet.mockResolvedValue([tx("t1", -45.9)]);

    await useBankStore.getState().fetchTransactions();

    expect(useBankStore.getState().transactions).toHaveLength(1);
    expect(useBankStore.getState().isLoading).toBe(false);
  });

  it("voltar à aba dentro da janela não refaz a busca", async () => {
    mockGet.mockResolvedValue([tx("t1", -45.9)]);

    await useBankStore.getState().fetchTransactions();
    await useBankStore.getState().fetchTransactions();

    // A tela revalida a cada foco; o extrato é a resposta mais cara do app
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("puxar para atualizar ignora a janela", async () => {
    mockGet.mockResolvedValue([tx("t1", -45.9)]);

    await useBankStore.getState().fetchTransactions();
    await useBankStore.getState().fetchTransactions(true);

    expect(mockGet).toHaveBeenCalledTimes(2);
  });

  it("falha não vale como leitura boa: o próximo foco tenta de novo", async () => {
    mockGet.mockRejectedValueOnce(new Error("offline"));
    mockGet.mockResolvedValueOnce([tx("t1", -45.9)]);

    await useBankStore.getState().fetchTransactions();
    await useBankStore.getState().fetchTransactions();

    // Guardar o horário de uma falha deixaria a tela um minuto sem saída
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(useBankStore.getState().transactions).toHaveLength(1);
    expect(useBankStore.getState().error).toBeNull();
  });

  it("falha ao carregar vira mensagem de tela", async () => {
    mockGet.mockRejectedValue(new Error("offline"));

    await useBankStore.getState().fetchTransactions();

    expect(useBankStore.getState().error).toMatch(/extrato/i);
    expect(useBankStore.getState().isLoading).toBe(false);
  });

  it("cancelar o seletor de arquivo NÃO é erro", async () => {
    mockPicker.mockResolvedValue({ canceled: true, assets: null } as never);

    const resultado = await useBankStore.getState().importStatement();

    // Desistir de importar é uma escolha, não uma falha: mostrar erro aqui
    // seria acusar o usuário de algo que ele decidiu
    expect(resultado).toBeNull();
    expect(useBankStore.getState().error).toBeNull();
    expect(useBankStore.getState().isImporting).toBe(false);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("importar com sucesso recarrega a lista", async () => {
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://x.ofx", name: "x.ofx", mimeType: "application/x-ofx" }],
    } as never);
    mockUpload.mockResolvedValue({ transactionsImported: 3 } as never);
    mockGet.mockResolvedValue([tx("t1", -10)]);

    const resultado = await useBankStore.getState().importStatement();

    expect(resultado?.transactionsImported).toBe(3);
    // A lista precisa refletir o que acabou de entrar, sem o usuário puxar
    expect(mockGet).toHaveBeenCalled();
    expect(useBankStore.getState().isImporting).toBe(false);
  });

  it("erro do servidor mostra a MENSAGEM DELE, não uma genérica", async () => {
    mockPicker.mockResolvedValue({
      canceled: false,
      assets: [{ uri: "file://x.pdf", name: "x.pdf" }],
    } as never);
    const erro = Object.assign(new Error("Request failed"), {
      response: { data: { detail: "Nenhuma transação encontrada no arquivo" } },
    });
    mockUpload.mockRejectedValue(erro);

    await expect(useBankStore.getState().importStatement()).rejects.toThrow();

    // O backend é quem sabe por que o arquivo não serviu (EC-048)
    expect(useBankStore.getState().error).toBe("Nenhuma transação encontrada no arquivo");
    expect(useBankStore.getState().isImporting).toBe(false);
  });

  it("aplicar a versão do servidor troca só a linha alterada", () => {
    useBankStore.setState({ transactions: [tx("t1", -10), tx("t2", -20)] });

    useBankStore.getState().applyTransaction({
      ...tx("t1", -10),
      description: "APELIDO NOVO",
    } as BankTransaction);

    const lista = useBankStore.getState().transactions;
    expect(lista).toHaveLength(2);
    expect(lista.find((t) => t.id === "t1")?.description).toBe("APELIDO NOVO");
    expect(lista.find((t) => t.id === "t2")?.description).toBe("Lançamento");
  });

  it("as métricas saem da lista carregada", () => {
    useBankStore.setState({ transactions: [tx("t1", 1000), tx("t2", -300)] });

    const metricas = useBankStore.getState().calculateMetrics();

    expect(metricas.income).toBe(1000);
    expect(metricas.expense).toBe(300);
    expect(metricas.total).toBe(700);
  });

  describe("primeira carga em duas fases", () => {
    const recente = tx("r1", -12);
    const antigo = { ...tx("a1", -99), date: "2024-01-10T00:00:00Z" } as BankTransaction;

    it("a janela recente tem 90 dias para trás e cabe no teto de 366 da API", () => {
      const janela = recentStatementRange(new Date(2026, 10, 12, 21, 30));

      expect(janela).toEqual({
        kind: "window",
        start: "2026-08-14",
        // 2026-08-14 + 365 dias: inclusivo, são exatamente 366
        end: "2027-08-14",
      });
    });

    it("pinta a lista recente primeiro e depois troca pelo histórico inteiro", async () => {
      mockRecent.mockResolvedValue([recente]);
      const historico = adiada<BankTransaction[]>();
      mockGet.mockReturnValue(historico.promessa);

      await useBankStore.getState().fetchTransactions();

      // A tela já tem o que mostrar, sem esperar o histórico
      let estado = useBankStore.getState();
      expect(estado.transactions).toEqual([recente]);
      expect(estado.isLoading).toBe(false);
      expect(estado.historyComplete).toBe(false);
      expect(estado.isLoadingHistory).toBe(true);
      expect(estado.fetchedAt).toBeNull();
      expect(mockRecent).toHaveBeenCalledWith({ range: recentStatementRange() });
      expect(mockRecent.mock.invocationCallOrder[0]).toBeLessThan(
        mockGet.mock.invocationCallOrder[0],
      );

      historico.resolver([recente, antigo]);
      await assentar();

      estado = useBankStore.getState();
      expect(estado.transactions).toEqual([recente, antigo]);
      expect(estado.historyComplete).toBe(true);
      expect(estado.isLoadingHistory).toBe(false);
      expect(estado.fetchedAt).not.toBeNull();
    });

    it("foco durante a segunda fase não pede o histórico de novo", async () => {
      mockRecent.mockResolvedValue([recente]);
      const historico = adiada<BankTransaction[]>();
      mockGet.mockReturnValue(historico.promessa);

      await useBankStore.getState().fetchTransactions();
      await useBankStore.getState().fetchTransactions();

      expect(mockRecent).toHaveBeenCalledTimes(1);
      expect(mockGet).toHaveBeenCalledTimes(1);
      historico.resolver([recente, antigo]);
      await assentar();
    });

    it("se a fase recente falha, cai direto na busca completa", async () => {
      mockRecent.mockRejectedValue(new Error("offline"));
      mockGet.mockResolvedValue([recente, antigo]);

      await useBankStore.getState().fetchTransactions();

      const estado = useBankStore.getState();
      expect(estado.transactions).toEqual([recente, antigo]);
      expect(estado.historyComplete).toBe(true);
      expect(estado.error).toBeNull();
    });

    it("se o histórico falha, a lista recente fica e o próximo foco tenta de novo", async () => {
      mockRecent.mockResolvedValue([recente]);
      mockGet.mockRejectedValueOnce(new Error("offline"));

      await useBankStore.getState().fetchTransactions();
      await assentar();

      let estado = useBankStore.getState();
      expect(estado.transactions).toEqual([recente]);
      expect(estado.historyComplete).toBe(false);
      expect(estado.isLoadingHistory).toBe(false);
      expect(estado.fetchedAt).toBeNull();
      // A frase vai para o aviso compacto acima da lista, que continua lá
      expect(estado.error).toMatch(/extrato/i);

      mockGet.mockResolvedValueOnce([recente, antigo]);
      await useBankStore.getState().fetchTransactions();

      // A nova tentativa é só a busca completa: a recente já está na tela
      expect(mockRecent).toHaveBeenCalledTimes(1);
      estado = useBankStore.getState();
      expect(estado.transactions).toEqual([recente, antigo]);
      expect(estado.historyComplete).toBe(true);
      expect(estado.error).toBeNull();
    });

    it("lista recente vazia não é publicada: a tela espera o histórico", async () => {
      mockRecent.mockResolvedValue([]);
      const historico = adiada<BankTransaction[]>();
      mockGet.mockReturnValue(historico.promessa);

      const busca = useBankStore.getState().fetchTransactions();
      await assentar();

      // Publicar [] mostraria "Nenhum extrato importado" a quem tem histórico
      expect(useBankStore.getState().isLoading).toBe(true);

      historico.resolver([antigo]);
      await busca;
      expect(useBankStore.getState().transactions).toEqual([antigo]);
      expect(useBankStore.getState().isLoading).toBe(false);
    });

    it("com o histórico completo, a recarga é uma busca só", async () => {
      useBankStore.setState({
        transactions: [recente, antigo],
        historyComplete: true,
        fetchedAt: null,
      });
      mockGet.mockResolvedValue([recente, antigo]);

      await useBankStore.getState().fetchTransactions();

      expect(mockRecent).not.toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalledTimes(1);
      expect(useBankStore.getState().historyComplete).toBe(true);
    });

    it("fim de sessão entre as fases: o histórico de quem saiu não escreve", async () => {
      mockRecent.mockResolvedValue([recente]);
      const historico = adiada<BankTransaction[]>();
      mockGet.mockReturnValue(historico.promessa);

      await useBankStore.getState().fetchTransactions();
      useBankStore.getState().reset();
      historico.resolver([recente, antigo]);
      await assentar();

      const estado = useBankStore.getState();
      expect(estado.transactions).toEqual([]);
      expect(estado.historyComplete).toBe(false);
      expect(estado.fetchedAt).toBeNull();
    });

    it("edição confirmada entre as fases sobrevive à troca pela lista completa", async () => {
      mockRecent.mockResolvedValue([recente]);
      const historico = adiada<BankTransaction[]>();
      mockGet.mockReturnValue(historico.promessa);

      await useBankStore.getState().fetchTransactions();
      useBankStore
        .getState()
        .applyTransaction({ ...recente, description: "MERCADO DA ESQUINA" });
      // O servidor montou a resposta antes de gravar o apelido
      historico.resolver([recente, antigo]);
      await assentar();

      const lista = useBankStore.getState().transactions;
      expect(lista).toHaveLength(2);
      expect(lista.find((t) => t.id === "r1")?.description).toBe(
        "MERCADO DA ESQUINA",
      );
    });

    it("a busca pedida depois (importação) vence a segunda fase atrasada", async () => {
      mockRecent.mockResolvedValue([recente]);
      const atrasada = adiada<BankTransaction[]>();
      mockGet.mockReturnValueOnce(atrasada.promessa);
      const novo = tx("n1", -5);
      mockGet.mockResolvedValueOnce([novo, recente, antigo]);

      await useBankStore.getState().fetchTransactions();
      await useBankStore.getState().fetchTransactions(true);
      atrasada.resolver([recente, antigo]);
      await assentar();

      expect(useBankStore.getState().transactions).toEqual([
        novo,
        recente,
        antigo,
      ]);
    });

    it("importação com a recarga completa em voo começa outra busca", async () => {
      // Foco disparou a recarga; o "Abrir com" termina antes dela
      useBankStore.setState({
        transactions: [recente, antigo],
        historyComplete: true,
        fetchedAt: null,
      });
      const antiga = adiada<BankTransaction[]>();
      const novo = tx("n1", -5);
      mockGet.mockReturnValueOnce(antiga.promessa);
      mockGet.mockResolvedValueOnce([novo, recente, antigo]);

      void useBankStore.getState().fetchTransactions();
      expect(useBankStore.getState().isLoading).toBe(true);
      await useBankStore.getState().fetchTransactions(true);

      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(useBankStore.getState().transactions).toEqual([
        novo,
        recente,
        antigo,
      ]);
      // A resposta da busca pedida antes da importação chega depois e não
      // apaga o arquivo novo
      antiga.resolver([recente, antigo]);
      await assentar();
      expect(useBankStore.getState().transactions).toEqual([
        novo,
        recente,
        antigo,
      ]);
      expect(useBankStore.getState().isLoading).toBe(false);
    });

    it("importação durante a fase recente também começa outra busca", async () => {
      const recenteAntiga = adiada<BankTransaction[]>();
      mockRecent.mockReturnValueOnce(recenteAntiga.promessa);
      const novo = tx("n1", -5);
      mockRecent.mockResolvedValueOnce([novo, recente]);
      mockGet.mockResolvedValue([novo, recente, antigo]);

      void useBankStore.getState().fetchTransactions();
      await useBankStore.getState().fetchTransactions(true);
      recenteAntiga.resolver([recente]);
      await assentar();

      expect(mockRecent).toHaveBeenCalledTimes(2);
      expect(useBankStore.getState().transactions).toEqual([
        novo,
        recente,
        antigo,
      ]);
      expect(useBankStore.getState().historyComplete).toBe(true);
    });

    it("ensureHistory espera a segunda fase", async () => {
      mockRecent.mockResolvedValue([recente]);
      const historico = adiada<BankTransaction[]>();
      mockGet.mockReturnValue(historico.promessa);

      await useBankStore.getState().fetchTransactions();
      let resolvido: boolean | undefined;
      const garantido = useBankStore
        .getState()
        .ensureHistory()
        .then((valor) => (resolvido = valor));
      await assentar();

      // Enquanto a fase 2 não gravou, a exportação continua esperando
      expect(resolvido).toBeUndefined();
      expect(useBankStore.getState().historyComplete).toBe(false);

      historico.resolver([recente, antigo]);

      await expect(garantido).resolves.toBe(true);
      expect(useBankStore.getState().transactions).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledTimes(1);
    });

    it("ensureHistory devolve false quando o histórico não chega", async () => {
      mockRecent.mockResolvedValue([recente]);
      mockGet.mockRejectedValue(new Error("offline"));

      await expect(useBankStore.getState().ensureHistory()).resolves.toBe(false);
      // Uma tentativa a mais antes de desistir
      expect(mockGet).toHaveBeenCalledTimes(2);
      expect(useBankStore.getState().transactions).toEqual([recente]);
    });
  });

  describe("arquivo que chega de fora (\"Abrir com\")", () => {
    it("sem arquivo parqueado não faz nada", async () => {
      const resultado = await useBankStore.getState().importarArquivoRecebido();

      expect(resultado).toBeNull();
      expect(mockUpload).not.toHaveBeenCalled();
    });

    it("envia com o nome que a URI entregou, sem precisar ler bytes", async () => {
      const uri =
        "content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fextrato-agosto.ofx";
      mockCopiar.mockResolvedValue("file:///cache/copia");
      mockUpload.mockResolvedValue({ transactionsImported: 4 } as never);
      mockGet.mockResolvedValue([tx("t1", -10)]);

      useBankStore.getState().receberArquivo(uri);
      const resultado = await useBankStore.getState().importarArquivoRecebido();

      expect(resultado?.transactionsImported).toBe(4);
      // A URI já disse o formato: ler os primeiros bytes seria trabalho à toa
      expect(mockLerInicio).not.toHaveBeenCalled();
      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: "file:///cache/copia",
          name: "extrato-agosto.ofx",
          mimeType: "application/x-ofx",
        }),
      );
      // A lista tem que refletir o que entrou, como na importação manual
      expect(mockGet).toHaveBeenCalled();
      expect(useBankStore.getState().isImporting).toBe(false);
    });

    it("quando a URI não diz nada, o formato sai dos primeiros bytes", async () => {
      mockCopiar.mockResolvedValue("file:///cache/copia");
      // "OFXHEADER:100" em base64
      mockLerInicio.mockResolvedValue("T0ZYSEVBREVSOjEwMAo=");
      mockUpload.mockResolvedValue({ transactionsImported: 1 } as never);
      mockGet.mockResolvedValue([]);

      useBankStore.getState().receberArquivo("content://media/external/file/42");
      await useBankStore.getState().importarArquivoRecebido();

      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({ mimeType: "application/x-ofx" }),
      );
      expect(mockUpload.mock.calls[0][0].name).toMatch(/^extrato-\d{4}-\d{2}-\d{2}\.ofx$/);
    });

    it("se a cópia falhar, envia a URI original em vez de desistir", async () => {
      mockCopiar.mockRejectedValue(new Error("permissão revogada"));
      mockUpload.mockResolvedValue({ transactionsImported: 2 } as never);
      mockGet.mockResolvedValue([]);

      useBankStore.getState().receberArquivo("file:///sdcard/extrato.csv");
      await useBankStore.getState().importarArquivoRecebido();

      expect(mockUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: "file:///sdcard/extrato.csv",
          name: "extrato.csv",
        }),
      );
    });

    it("formato irreconhecível vira mensagem daqui, sem gastar upload", async () => {
      mockCopiar.mockResolvedValue("file:///cache/copia");
      // assinatura de PNG: não é nenhum formato de extrato
      mockLerInicio.mockResolvedValue("iVBORw0KGgo=");

      useBankStore.getState().receberArquivo("content://media/external/file/7");

      await expect(
        useBankStore.getState().importarArquivoRecebido(),
      ).rejects.toThrow(/não reconheci o formato/i);
      // Dizer isso ANTES de subir o arquivo poupa a rede e é mais rápido
      expect(mockUpload).not.toHaveBeenCalled();
      expect(useBankStore.getState().isImporting).toBe(false);
      expect(useBankStore.getState().error).toMatch(/não reconheci/i);
    });

    it("o arquivo sai da fila antes do envio, mesmo quando o envio falha", async () => {
      mockCopiar.mockResolvedValue("file:///cache/copia");
      mockUpload.mockRejectedValue(new Error("sem rede"));

      useBankStore.getState().receberArquivo("file:///sdcard/extrato.ofx");
      await expect(
        useBankStore.getState().importarArquivoRecebido(),
      ).rejects.toThrow();

      // Deixar parqueado faria a tela tentar de novo a cada foco — o jeito
      // mais rápido de transformar um arquivo problemático num laço
      expect(useBankStore.getState().arquivoRecebido).toBeNull();
    });

    it("descartar esquece o arquivo", () => {
      useBankStore.getState().receberArquivo("file:///sdcard/extrato.ofx");
      useBankStore.getState().descartarArquivoRecebido();

      expect(useBankStore.getState().arquivoRecebido).toBeNull();
    });
  });
});
