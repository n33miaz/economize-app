import { create } from "zustand";
import api from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

export interface Transaction {
  id: string;
  assetCode: string;
  type: string;
  quantity: number;
  priceAtTransaction: number;
  transactionDate: string;
}

/**
 * Mesma janela do extrato, pela mesma razão e por uma a mais: a Home e a
 * Carteira pedem ESTA lista, cada uma na sua montagem — abrir o app e ir à
 * Carteira eram duas requisições para a mesma resposta.
 */
export const WALLET_CACHE_TTL_MS = 60 * 1000;

interface WalletState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  /** `Date.now()` da última lista boa; null = nunca carregou. */
  fetchedAt: number | null;
  fetchTransactions: (force?: boolean) => Promise<void>;
  addTransaction: (
    transaction: Omit<Transaction, "id" | "transactionDate">,
  ) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,
  fetchedAt: null,

  fetchTransactions: async (force = false) => {
    const { fetchedAt, isLoading } = get();
    if (isLoading) return;
    if (
      !force &&
      fetchedAt !== null &&
      Date.now() - fetchedAt < WALLET_CACHE_TTL_MS
    ) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Transaction[]>("/wallet/transactions");
      set({
        transactions: response.data,
        isLoading: false,
        fetchedAt: Date.now(),
      });
    } catch (error) {
      // Leitura que falhou não vira toast: a tela mostra a frase, e ela diz a
      // causa quando é de transporte (offline, servidor acordando).
      // `fetchedAt` não avança: falha não vale como leitura boa
      set({
        error: describeLoadFailure(error, "Erro ao carregar carteira"),
        isLoading: false,
      });
    }
  },

  addTransaction: async (transaction) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post<Transaction>(
        "/wallet/transactions",
        transaction,
      );
      set({
        transactions: [response.data, ...get().transactions],
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: "Erro ao adicionar transação", isLoading: false });
      throw error;
    }
  },

  removeTransaction: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/wallet/transactions/${id}`);
      set({
        transactions: get().transactions.filter((t) => t.id !== id),
        isLoading: false,
      });
    } catch (error: any) {
      set({ error: "Erro ao remover transação", isLoading: false });
      throw error;
    }
  },
}));
