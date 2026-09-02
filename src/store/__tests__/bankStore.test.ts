import * as DocumentPicker from "expo-document-picker";

import { getBankTransactions, uploadBankStatement } from "../../services/api";
import { useBankStore } from "../bankStore";

import type { BankTransaction } from "../../services/api";

jest.mock("../../services/api", () => ({
  getBankTransactions: jest.fn(),
  uploadBankStatement: jest.fn(),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

const mockGet = getBankTransactions as jest.MockedFunction<typeof getBankTransactions>;
const mockUpload = uploadBankStatement as jest.MockedFunction<typeof uploadBankStatement>;
const mockPicker = DocumentPicker.getDocumentAsync as jest.MockedFunction<
  typeof DocumentPicker.getDocumentAsync
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
    });
  });

  it("carrega o extrato", async () => {
    mockGet.mockResolvedValue([tx("t1", -45.9)]);

    await useBankStore.getState().fetchTransactions();

    expect(useBankStore.getState().transactions).toHaveLength(1);
    expect(useBankStore.getState().isLoading).toBe(false);
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
});
