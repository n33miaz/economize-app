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
import {
  bytesDeBase64,
  formatoPelaUri,
  formatoPelosPrimeirosBytes,
  mimeDoFormato,
  nomeDoArquivoRecebido,
} from "../utils/arquivoRecebido";
import { copiarParaCache, lerInicioEmBase64 } from "../services/arquivoLocal";

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

/**
 * O envio em si, compartilhado pelos dois caminhos de importação (o seletor de
 * arquivos e o "Abrir com"). A validação de formato é do servidor — o erro dele
 * já vem com a mensagem certa e cobre formatos que o cliente nem conhece.
 */
async function enviarArquivo(
  asset: DocumentPicker.DocumentPickerAsset,
  get: () => BankState,
  set: (partial: Partial<BankState>) => void,
): Promise<StatementUploadResult> {
  const response = await uploadBankStatement(asset);
  // `force`: acabou de entrar lançamento novo, e é exatamente o momento em que
  // a lista guardada está errada — a janela de um minuto não vale aqui
  await get().fetchTransactions(true);
  set({ isImporting: false });
  return response;
}

/**
 * Transforma a URI que o Android entregou no mesmo objeto que o seletor de
 * arquivos produz, que é o que a camada de rede sabe enviar.
 *
 * Duas coisas podem faltar e são buscadas em ordem de custo: a cópia local
 * (barata, e protege a leitura de uma permissão que expira) e a assinatura nos
 * primeiros bytes (só quando a URI não disse o formato, que é o caso de todo
 * provedor que numera o arquivo em vez de nomeá-lo). As duas podem falhar sem
 * derrubar o caminho: sem cópia, envia-se a URI original; sem assinatura,
 * sobra o que a URI disser — e se nem ela disser, aí sim não dá para enviar,
 * porque o servidor escolhe o leitor pela extensão do nome.
 */
async function descreverArquivoRecebido(
  uri: string,
): Promise<DocumentPicker.DocumentPickerAsset> {
  let local = uri;
  try {
    local = await copiarParaCache(uri);
  } catch {
    // segue com a URI original: ela costuma valer enquanto o app está aberto
  }

  let formato = formatoPelaUri(uri);
  if (!formato) {
    try {
      formato = formatoPelosPrimeirosBytes(
        bytesDeBase64(await lerInicioEmBase64(local)),
      );
    } catch {
      // sem assinatura legível; a linha abaixo decide o que dizer à pessoa
    }
  }

  if (!formato) {
    throw new Error(
      "Não reconheci o formato deste arquivo. Toque em Importar e escolha o arquivo pelo seletor.",
    );
  }

  // Só `uri`, `name` e `mimeType` são lidos no envio pelo aparelho — os outros
  // campos do seletor existem para a web, que não tem "Abrir com"
  return {
    uri: local,
    name: nomeDoArquivoRecebido(uri, formato),
    mimeType: mimeDoFormato(formato),
  } as DocumentPicker.DocumentPickerAsset;
}

interface BankState {
  transactions: BankTransaction[];
  isLoading: boolean;
  // upload tem indicador próprio — compartilhar com o refresh fazia o
  // RefreshControl girar durante a importação de arquivo
  isImporting: boolean;
  error: string | null;
  /** `Date.now()` da última lista boa; null = nunca carregou. */
  fetchedAt: number | null;

  /**
   * A URI de um arquivo que o Android mandou para cá ("Abrir com › Economize!")
   * e que ainda não foi enviado. Fica parqueada porque o arquivo pode chegar
   * com o app trancado ou deslogado: quem recebe é o `Linking`, quem envia é a
   * tela de Extrato, e entre os dois pode haver uma tela de login inteira.
   */
  arquivoRecebido: string | null;

  fetchTransactions: (force?: boolean) => Promise<void>;
  importStatement: () => Promise<StatementUploadResult | null>;
  /** Guarda o arquivo que chegou de fora até alguém poder enviá-lo. */
  receberArquivo: (uri: string) => void;
  /** Esquece o arquivo parqueado — enviado, recusado ou abandonado. */
  descartarArquivoRecebido: () => void;
  /** Envia o arquivo parqueado. Devolve null quando não há nenhum. */
  importarArquivoRecebido: () => Promise<StatementUploadResult | null>;
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
  arquivoRecebido: null,

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
      return await enviarArquivo(result.assets[0], get, set);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || e.message || "Erro no upload", isImporting: false });
      throw e;
    }
  },

  receberArquivo: (uri) => set({ arquivoRecebido: uri }),

  descartarArquivoRecebido: () => set({ arquivoRecebido: null }),

  importarArquivoRecebido: async () => {
    const uri = get().arquivoRecebido;
    if (!uri) return null;
    if (get().isImporting) return null;
    // Sai da fila ANTES do envio: se a rede falhar, a tela mostra o erro e o
    // seletor de arquivos continua ali. Deixar parqueado faria a tela tentar
    // de novo sozinha a cada foco, que é a forma mais rápida de transformar um
    // arquivo problemático num laço.
    set({ isImporting: true, error: null, arquivoRecebido: null });
    try {
      const asset = await descreverArquivoRecebido(uri);
      return await enviarArquivo(asset, get, set);
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
