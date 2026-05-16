import { create } from "zustand";
import {
  BankTransaction,
  getBankTransactions,
  uploadBankStatement,
} from "../services/api";
import * as DocumentPicker from "expo-document-picker";
import { calculateBankMetrics } from "../utils/bankMetrics";

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
        type: [
          "application/x-ofx",
          "text/csv",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/pdf",
          "text/plain",
          "application/octet-stream",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        set({ isLoading: false });
        return 0;
      }

      const file = result.assets[0];
      const supported = [".ofx", ".csv", ".xlsx", ".xls", ".pdf", ".txt"];
      const lower = file.name.toLowerCase();
      if (!supported.some((ext) => lower.endsWith(ext))) {
        throw new Error(
          "Formato não suportado. Use OFX, CSV, XLSX, PDF ou TXT.",
        );
      }

      const response = await uploadBankStatement(file);

      await get().fetchTransactions();

      return response.transactionsImported || 0;
    } catch (e: any) {
      set({ error: e.message || "Erro no upload", isLoading: false });
      throw e;
    }
  },

  calculateMetrics: () => calculateBankMetrics(get().transactions),
}));
