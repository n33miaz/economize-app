import { create } from "zustand";
import {
  BankTransaction,
  StatementUploadResult,
  getBankTransactions,
  getTransactions,
  uploadBankStatement,
} from "../services/api";
import {
  describeLoadFailure,
  describeSaveFailure,
} from "../services/requestFailure";
import { Platform } from "react-native";
import * as DocumentPicker from "expo-document-picker";
import { calculateBankMetrics } from "../utils/bankMetrics";
import { replaceTransaction } from "../utils/transactions";
import { addDays, todayIso, type AnalysisRange } from "../utils/cycleWindow";
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
 * Quantos dias para trás a primeira pintura do Extrato cobre.
 *
 * O histórico inteiro (1.970 linhas, 1,5 MB) levava de 3 a 10 s no servidor
 * grátis, e a tela esperava tudo para mostrar os lançamentos da semana. Três
 * meses é o que se rola de fato ao abrir a aba; o resto chega em seguida.
 */
export const RECENT_WINDOW_DAYS = 90;

/**
 * Teto da janela de `/transactions` (`AnalysisWindow.MAX_DAYS` na API): datas
 * INCLUSIVAS, `end - start + 1` dias, e acima disso a resposta é 400.
 */
const API_MAX_WINDOW_DAYS = 366;

/**
 * A janela da primeira fase: 90 dias para trás e o resto do teto para a frente.
 *
 * A folga para a frente pega lançamento com data futura (parcela, agendamento)
 * que o histórico inteiro também traria — sem ela a lista mudaria de forma na
 * segunda fase. Ela também torna irrelevante a diferença entre o "hoje" do
 * aparelho e o corte em UTC do servidor: as bordas ficam longe do dia de hoje.
 */
export function recentStatementRange(now: Date = new Date()): AnalysisRange {
  const start = addDays(todayIso(now), -RECENT_WINDOW_DAYS);
  return {
    kind: "window",
    start,
    end: addDays(start, API_MAX_WINDOW_DAYS - 1),
  };
}

/**
 * Qual busca é a mais nova. Sobe a cada busca do extrato e no `reset`; uma
 * resposta só escreve se a geração dela ainda for a atual.
 *
 * O interceptor da API já descarta a resposta de sessão encerrada, mas não
 * ordena duas buscas da MESMA sessão: a segunda fase pedida antes de uma
 * importação chegaria depois da busca pós-importação e devolveria a lista sem
 * o arquivo novo. Fica fora do estado porque não é dado de tela.
 */
let geracao = 0;
/** A busca em primeiro plano em andamento (fase 1 ou busca completa). */
let cargaEmVoo: Promise<void> | null = null;
/** A busca do histórico inteiro em andamento (fase 2 ou busca completa). */
let historicoEmVoo: Promise<void> | null = null;
/**
 * Edições confirmadas depois que o histórico inteiro foi pedido. O servidor
 * pode ter montado a resposta antes de gravar a edição; sem reaplicá-las, a
 * troca pela lista completa desfaria um apelido que a pessoa acabou de salvar.
 */
let editadasNoVoo: Map<string, BankTransaction> | null = null;

function reaplicarEdicoes(
  lista: BankTransaction[],
  editadas: Map<string, BankTransaction> | null,
): BankTransaction[] {
  if (!editadas || editadas.size === 0) return lista;
  return lista.map((tx) => editadas.get(tx.id) ?? tx);
}

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
  /**
   * `Date.now()` da última lista COMPLETA; null = nunca carregou. A lista
   * recente da primeira fase não conta: o próximo foco tem de buscar o resto.
   */
  fetchedAt: number | null;
  /**
   * A lista é o histórico inteiro? Falso entre as duas fases da primeira carga
   * (e se a segunda falhar). Quem soma, conta ou exporta espera por ele.
   */
  historyComplete: boolean;
  /** O histórico inteiro está a caminho (a lista na tela é a recente). */
  isLoadingHistory: boolean;

  /**
   * A URI de um arquivo que o Android mandou para cá ("Abrir com › Economize!")
   * e que ainda não foi enviado. Fica parqueada porque o arquivo pode chegar
   * com o app trancado ou deslogado: quem recebe é o `Linking`, quem envia é a
   * tela de Extrato, e entre os dois pode haver uma tela de login inteira.
   */
  arquivoRecebido: string | null;

  /**
   * Resolve quando há lista para pintar: na primeira carga, depois da fase
   * recente — o histórico inteiro segue em segundo plano.
   */
  fetchTransactions: (force?: boolean) => Promise<void>;
  /**
   * Garante o histórico inteiro na store (espera a busca em voo, ou busca).
   * Devolve false quando ele não chegou — quem exporta não gera arquivo pela
   * metade.
   */
  ensureHistory: () => Promise<boolean>;
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
  /** Fim de sessão: apaga o extrato. Ver o comentário na implementação. */
  reset: () => void;
}

export const useBankStore = create<BankState>((set, get) => {
  /**
   * Busca o histórico inteiro e SUBSTITUI a lista — é a segunda fase da
   * primeira carga e também a recarga de sempre. Registra-se como o histórico
   * em voo para que focos seguidos não peçam a mesma lista de novo.
   */
  const carregarHistorico = (minha: number): Promise<void> => {
    editadasNoVoo = new Map();
    if (!get().historyComplete) set({ isLoadingHistory: true });
    const busca = (async () => {
      try {
        const data = await getBankTransactions();
        if (minha !== geracao) return;
        // `error: null` também no sucesso: a busca de uma sessão encerrada
        // pode ter escrito a sua falha DEPOIS do início desta, e lista boa com
        // erro ao lado é a tela discordando de si mesma
        set({
          transactions: reaplicarEdicoes(data, editadasNoVoo),
          isLoading: false,
          isLoadingHistory: false,
          historyComplete: true,
          error: null,
          fetchedAt: Date.now(),
        });
      } catch (e) {
        // A frase vai para o ErrorState da tela, não para toast: leitura que
        // falha se explica no lugar, com "tentar de novo" ao lado. Com a
        // lista recente na tela ele é o aviso compacto ACIMA dela — a lista
        // fica. `fetchedAt` NÃO avança: falha não vale como leitura boa, e o
        // próximo foco tem de tentar outra vez
        const message = describeLoadFailure(e, "Falha ao carregar extrato.");
        if (!message) return;
        // Falha de uma busca que já foi superada não apaga o que a nova trouxer
        if (minha !== geracao) return;
        set({
          error: message,
          isLoading: false,
          isLoadingHistory: false,
        });
      }
    })();
    historicoEmVoo = busca;
    return busca.finally(() => {
      if (historicoEmVoo === busca) {
        historicoEmVoo = null;
        editadasNoVoo = null;
      }
    });
  };

  return {
    transactions: [],
    isLoading: false,
    isImporting: false,
    error: null,
    fetchedAt: null,
    historyComplete: false,
    isLoadingHistory: false,
    arquivoRecebido: null,

    fetchTransactions: (force = false) => {
      const { fetchedAt, isLoading, historyComplete, transactions } = get();
      // Uma busca em voo também basta: dois focos no mesmo instante (montagem +
      // volta de sheet) pediam a mesma lista duas vezes. Devolve a promessa dela
      // para quem espera (a exportação) esperar a lista de verdade
      if (isLoading) return cargaEmVoo ?? Promise.resolve();
      // O histórico já está a caminho: sem `force`, ele é a busca que este foco
      // pediria. Com `force` (importação, puxar para atualizar) a busca em voo
      // foi pedida ANTES da mudança e não serve — a geração nova a descarta
      if (historicoEmVoo && !force) return Promise.resolve();
      if (
        !force &&
        fetchedAt !== null &&
        Date.now() - fetchedAt < BANK_CACHE_TTL_MS
      ) {
        return Promise.resolve();
      }

      const minha = ++geracao;
      // Duas fases só na primeira carga. Com a lista completa na tela, a recarga
      // a mantém enquanto busca: voltar para a recente seria a tela encolhendo
      // a cada foco
      const emDuasFases = !historyComplete && transactions.length === 0;
      set({ isLoading: true, error: null });

      const carga = (async () => {
        if (emDuasFases) {
          let recentes: BankTransaction[] | null = null;
          try {
            recentes = await getTransactions({ range: recentStatementRange() });
          } catch (e) {
            // Sessão encerrada não escreve nada (frase vazia). Qualquer outra
            // falha cai na busca completa abaixo, que é o caminho de antes
            if (!describeLoadFailure(e, "Falha ao carregar extrato.")) return;
          }
          if (minha !== geracao) return;
          // Lista recente VAZIA não é publicada: quem só tem lançamento antigo
          // veria "Nenhum extrato importado" até a segunda fase chegar
          if (recentes && recentes.length > 0) {
            set({ transactions: recentes, isLoading: false, error: null });
            // Sem `await` de propósito: a tela já tem o que pintar
            void carregarHistorico(minha);
            return;
          }
        }
        await carregarHistorico(minha);
      })();

      cargaEmVoo = carga;
      return carga.finally(() => {
        if (cargaEmVoo === carga) cargaEmVoo = null;
      });
    },

    ensureHistory: async () => {
      // Laço, e não uma espera só: uma busca nova (importação) pode tomar o
      // lugar da que estava em voo enquanto se espera
      const esperarBuscas = async () => {
        while (cargaEmVoo || historicoEmVoo) {
          await (cargaEmVoo ?? historicoEmVoo);
        }
      };
      await get().fetchTransactions();
      await esperarBuscas();
      if (!get().historyComplete) {
        // A segunda fase falhou: uma tentativa a mais antes de desistir
        await get().fetchTransactions(true);
        await esperarBuscas();
      }
      return get().historyComplete;
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
        const message = describeSaveFailure(e, e?.message || "Erro no upload");
        if (!message) throw e;
        set({
          error: message,
          isImporting: false,
        });
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
        const message = describeSaveFailure(e, e?.message || "Erro no upload");
        if (!message) throw e;
        set({
          error: message,
          isImporting: false,
        });
        throw e;
      }
    },

    applyTransaction: (updated) => {
      // Edição com o histórico a caminho: guardada para sobreviver à troca
      editadasNoVoo?.set(updated.id, updated);
      set({ transactions: replaceTransaction(get().transactions, updated) });
    },

    calculateMetrics: () => calculateBankMetrics(get().transactions),

    // Fim de sessão. `fetchedAt` volta a null junto com a lista: era ele que
    // fazia a próxima conta ver o extrato da anterior por até um minuto, porque
    // a janela de cache respondia "ainda está bom" sem perguntar DE QUEM era.
    // `isLoading` cai para o primeiro foco da conta nova poder buscar — a
    // resposta que ainda estiver em voo é descartada pelo interceptor da API, e
    // a geração nova a descarta também aqui (a segunda fase de quem saiu não
    // escreve na lista de quem entrou). `historyComplete` volta a false: a
    // próxima conta começa outra vez pela lista recente.
    //
    // `arquivoRecebido` fica de fora DE PROPÓSITO: é um arquivo que o Android
    // entregou ao aparelho, não dado de conta, e foi desenhado para atravessar
    // uma tela de login inteira (ver o campo). Apagá-lo aqui perderia o "Abrir
    // com" de quem estava deslogado ou saiu pela tranca da biometria
    reset: () => {
      geracao++;
      cargaEmVoo = null;
      historicoEmVoo = null;
      editadasNoVoo = null;
      set({
        transactions: [],
        isLoading: false,
        isImporting: false,
        error: null,
        fetchedAt: null,
        historyComplete: false,
        isLoadingHistory: false,
      });
    },
  };
});
