import api from "../../services/api";
import { useWalletStore } from "../walletStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn(), post: jest.fn(), delete: jest.fn() },
}));

const mockApi = api as unknown as {
  get: jest.Mock;
  post: jest.Mock;
  delete: jest.Mock;
};

const operacao = (id: string, ativo = "PETR4") => ({
  id,
  assetCode: ativo,
  type: "BUY",
  quantity: 100,
  priceAtTransaction: 38.42,
  transactionDate: "2026-09-01T12:00:00Z",
});

describe("walletStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useWalletStore.setState({ transactions: [], isLoading: false, error: null });
  });

  it("carrega as operações da carteira", async () => {
    mockApi.get.mockResolvedValue({ data: [operacao("t1"), operacao("t2", "VALE3")] });

    await useWalletStore.getState().fetchTransactions();

    const state = useWalletStore.getState();
    expect(state.transactions).toHaveLength(2);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("falha ao carregar não deixa a tela girando para sempre", async () => {
    mockApi.get.mockRejectedValue(new Error("offline"));

    await useWalletStore.getState().fetchTransactions();

    expect(useWalletStore.getState().error).toMatch(/carteira/i);
    expect(useWalletStore.getState().isLoading).toBe(false);
  });

  it("a operação nova entra no TOPO, sem refazer a lista", async () => {
    useWalletStore.setState({ transactions: [operacao("antiga")] as never });
    mockApi.post.mockResolvedValue({ data: operacao("nova") });

    await useWalletStore.getState().addTransaction({
      assetCode: "PETR4",
      type: "BUY",
      quantity: 100,
      priceAtTransaction: 38.42,
    } as never);

    // A lista é ordenada da mais recente para a mais antiga: a que acabou de
    // ser gravada é a mais recente por definição
    expect(useWalletStore.getState().transactions.map((t) => t.id))
      .toEqual(["nova", "antiga"]);
    expect(mockApi.get).not.toHaveBeenCalled();
  });

  it("falha ao gravar PROPAGA: quem chamou precisa saber que não salvou", async () => {
    mockApi.post.mockRejectedValue(new Error("400"));

    await expect(
      useWalletStore.getState().addTransaction({
        assetCode: "PETR4",
        type: "BUY",
        quantity: 100,
        priceAtTransaction: 38.42,
      } as never),
    ).rejects.toThrow();

    // Engolir o erro faria a tela fechar o formulário como se tivesse salvado
    expect(useWalletStore.getState().error).toMatch(/adicionar/i);
    expect(useWalletStore.getState().transactions).toEqual([]);
  });

  it("remover tira só a operação pedida", async () => {
    useWalletStore.setState({
      transactions: [operacao("t1"), operacao("t2")] as never,
    });
    mockApi.delete.mockResolvedValue({});

    await useWalletStore.getState().removeTransaction("t1");

    expect(useWalletStore.getState().transactions.map((t) => t.id)).toEqual(["t2"]);
    expect(mockApi.delete).toHaveBeenCalledWith("/wallet/transactions/t1");
  });

  it("falha ao remover não apaga da tela o que continua no banco", async () => {
    useWalletStore.setState({ transactions: [operacao("t1")] as never });
    mockApi.delete.mockRejectedValue(new Error("404"));

    await expect(
      useWalletStore.getState().removeTransaction("t1"),
    ).rejects.toThrow();

    expect(useWalletStore.getState().transactions).toHaveLength(1);
  });
});
