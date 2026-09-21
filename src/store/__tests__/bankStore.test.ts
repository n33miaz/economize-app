import * as DocumentPicker from "expo-document-picker";

import { getBankTransactions, uploadBankStatement } from "../../services/api";
import { copiarParaCache, lerInicioEmBase64 } from "../../services/arquivoLocal";
import { useBankStore } from "../bankStore";

import type { BankTransaction } from "../../services/api";

jest.mock("../../services/api", () => ({
  getBankTransactions: jest.fn(),
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

describe("bankStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
