import { create } from "zustand";
import {
  BankTransaction,
  StatementUploadResult,
  getBankTransactions,
  uploadBankStatement,
} from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";
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

/**
 * Janela em que a lista já carregada é considerada boa.
 *
 * O extrato é a resposta mais cara do app (100 KB para 1.752 linhas, 1,55 s
 * medidos) e a tela revalida a cada FOCO — trocar de aba e voltar refazia a
 * busca inteira. Um minuto é curto o bastante para que uma importação ou uma
 * revisão feita em outra tela apareça, e longo o bastante para que ir ao
 * Mercado e voltar não custe nada. Puxar para atualizar ignora a janela.
 */
export const BANK_CACHE_TTL_MS = 60 * 1000;

interface BankState {
  transactions: BankTransaction[];
  isLoading: boolean;
  // upload tem indicador próprio — compartilhar com o refresh fazia o
  // RefreshControl girar durante a importação de arquivo
  isImporting: boolean;
  error: string | null;
  /** `Date.now()` da última lista boa; null = nunca carregou. */
  fetchedAt: number | null;

  fetchTransactions: (force?: boolean) => Promise<void>;
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
  fetchedAt: null,

  fetchTransactions: async (force = false) => {
    const { fetchedAt, isLoading } = get();
    // Uma busca em voo também basta: dois focos no mesmo instante (montagem +
    // volta de sheet) pediam a mesma lista duas vezes
    if (isLoading) return;
    if (
      !force &&
      fetchedAt !== null &&
      Date.now() - fetchedAt < BANK_CACHE_TTL_MS
    ) {
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const data = await getBankTransactions();
      set({ transactions: data, isLoading: false, fetchedAt: Date.now() });
    } catch (e) {
      // A frase vai para o ErrorState da tela, não para toast: leitura que
      // falha se explica no lugar, com "tentar de novo" ao lado.
      // `fetchedAt` NÃO avança: falha não vale como leitura boa, e o próximo
      // foco tem de tentar outra vez
      set({
        error: describeLoadFailure(e, "Falha ao carregar extrato."),
        isLoading: false,
      });
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

      // `force`: acabou de entrar lançamento novo, e é exatamente o momento em
      // que a lista guardada está errada — a janela de um minuto não vale aqui
      await get().fetchTransactions(true);
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
