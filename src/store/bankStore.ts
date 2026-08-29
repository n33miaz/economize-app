import { create } from "zustand";
import {
  BankTransaction,
  StatementUploadResult,
  getBankTransactions,
  uploadBankStatement,
} from "../services/api";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { calculateBankMetrics } from "../utils/bankMetrics";
import { replaceTransaction } from "../utils/transactions";

const MIME_TYPES = [
  "application/x-ofx",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/pdf",
  "text/plain",
  "application/octet-stream",
];

// No navegador a lista vira o `accept` do <input type="file">, que também
// entende extensão. Sem isso o .ofx do Inter aparecia esmaecido no seletor,
// porque nenhum browser conhece o MIME "application/x-ofx". No Android o
// filtro é por MIME e uma extensão solta invalidaria o intent.
const PICKER_TYPES =
  Platform.OS === "web"
    ? [...MIME_TYPES, ".ofx", ".csv", ".xlsx", ".pdf", ".txt"]
    : MIME_TYPES;

interface BankState {
  transactions: BankTransaction[];
  isLoading: boolean;
  // upload tem indicador próprio — compartilhar com o refresh fazia o
  // RefreshControl girar durante a importação de arquivo
  isImporting: boolean;
  error: string | null;

  fetchTransactions: () => Promise<void>;
  importStatement: () => Promise<StatementUploadResult | null>;
  /** Aplica a versão que o servidor devolveu (ex.: rename) sem refazer a lista. */
  applyTransaction: (updated: BankTransaction) => void;
  calculateMetrics: () => { income: number; expense: number; total: number };
}

export const useBankStore = create<BankState>((set, get) => ({
  transactions: [],
  isLoading: false,
  isImporting: false,
  error: null,

  fetchTransactions: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getBankTransactions();
      set({ transactions: data, isLoading: false });
    } catch {
      set({ error: "Falha ao carregar extrato.", isLoading: false });
    }
  },

  importStatement: async () => {
    set({ isImporting: true, error: null });
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: PICKER_TYPES,
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        set({ isImporting: false });
        return null;
      }

      // a validação de formato é do backend (EC-048) — o erro dele já vem
      // com a mensagem certa e cobre formatos que o cliente nem conhece
      const response: StatementUploadResult = await uploadBankStatement(
        result.assets[0],
      );

      await get().fetchTransactions();
      set({ isImporting: false });

      return response;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || e.message || "Erro no upload", isImporting: false });
      throw e;
    }
  },

  applyTransaction: (updated) =>
    set({ transactions: replaceTransaction(get().transactions, updated) }),

  calculateMetrics: () => calculateBankMetrics(get().transactions),
}));
