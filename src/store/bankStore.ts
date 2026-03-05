import { create } from "zustand";
import {
  BankTransaction,
  getBankTransactions,
  uploadBankStatement,
} from "../services/api";
import * as DocumentPicker from "expo-document-picker";

interface BankState {
  transactions: BankTransaction[];
  isLoading: boolean;
  error: string | null;

  fetchTransactions: () => Promise<void>;
  importStatement: () => Promise<number>;
  calculateMetrics: () => { income: number; expense: number; total: number };
}

export const useBankStore = create<BankState>((set, get) => ({
  transactions: [],
  isLoading: false,
  error: null,

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getBankTransactions();
      set({ transactions: data, isLoading: false });
    } catch (e) {
      set({ error: "Falha ao carregar extrato.", isLoading: false });
    }
  },

  importStatement: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/x-ofx", "text/*"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        set({ isLoading: false });
        return 0;
      }

      const file = result.assets[0];
      if (!file.name.toLowerCase().endsWith(".ofx")) {
        throw new Error("Formato inválido. Selecione um arquivo .OFX");
      }

      const response = await uploadBankStatement(file);

      await get().fetchTransactions();

      return response.transactionsImported || 0;
    } catch (e: any) {
      set({ error: e.message || "Erro no upload", isLoading: false });
      throw e;
    }
  },

  calculateMetrics: () => {
    const { transactions } = get();
    return transactions.reduce(
      (acc, curr) => {
        const val = curr.amount;
        if (curr.type === "CREDIT") acc.income += val;
        else acc.expense += Math.abs(val);
        acc.total += val;
        return acc;
      },
      { income: 0, expense: 0, total: 0 },
    );
  },
}));
