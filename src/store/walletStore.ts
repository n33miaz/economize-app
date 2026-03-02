import { create } from "zustand";
import api from "../services/api";

export interface Transaction {
  id: string;
  assetCode: string;
  type: string;
  quantity: number;
  priceAtTransaction: number;
  transactionDate: string;
}

interface WalletState {
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;
  fetchTransactions: () => Promise<void>;
  addTransaction: (
    transaction: Omit<Transaction, "id" | "transactionDate">,
  ) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<Transaction[]>("/wallet/transactions");
      set({ transactions: response.data, isLoading: false });
    } catch (error: any) {
      set({ error: "Erro ao carregar carteira", isLoading: false });
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
