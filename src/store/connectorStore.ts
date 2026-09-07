import { Platform } from "react-native";
import { create } from "zustand";
import {
  ConnectorItem,
  ConnectorStatus,
  StatementUploadResult,
  createConnectToken,
  getConnectorStatus,
  listConnectorItems,
  registerConnectorItem,
  syncConnector,
  unlinkConnectorItem,
} from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

/**
 * Onde mora a ponte da conexão bancária (`public/conectar-banco.html`).
 *
 * Na web é a própria origem — a página é publicada junto do site. No aparelho
 * não existe `window`, então vem do ambiente, com o site publicado como padrão.
 */
export const WEB_BASE_URL =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : process.env.EXPO_PUBLIC_WEB_BASE_URL ||
      "https://economize-web.onrender.com";

/**
 * O arquivo da ponte. Sem nome de provedor no caminho: ela carrega o widget
 * que o servidor indicar, e trocar de provedor não muda a URL.
 */
export const CONNECT_BRIDGE_PAGE = "conectar-banco.html";

interface ConnectorState {
  status: ConnectorStatus;
  items: ConnectorItem[];
  isChecking: boolean;
  isSyncing: boolean;
  isLoadingItems: boolean;
  /** Cobre pegar o token e gravar o item — os dois travam o botão. */
  isLinking: boolean;
  error: string | null;

  checkStatus: () => Promise<void>;
  fetchItems: () => Promise<void>;
  /**
   * URL da ponte com token, destino e widget no fragmento; null se o token
   * falhar ou se o servidor ainda não disse qual widget carregar.
   */
  buildConnectUrl: (redirect: string) => Promise<string | null>;
  finishConnect: (itemId: string) => Promise<boolean>;
  unlink: (id: string) => Promise<boolean>;
  runSync: (days?: number) => Promise<StatementUploadResult | null>;
  clearError: () => void;
  reset: () => void;
}

const vazio = () => ({
  status: { enabled: false, configured: false, itemCount: 0 } as ConnectorStatus,
  items: [] as ConnectorItem[],
  isChecking: false,
  isSyncing: false,
  isLoadingItems: false,
  isLinking: false,
  error: null as string | null,
});

/**
 * O `detail` do ProblemDetail é a mensagem boa. Sem ele, a leitura de
 * transporte (offline, servidor acordando) vale mais do que a frase padrão —
 * e a `message` do axios ("Request failed with status code 500") não entra:
 * é inglês de biblioteca, não resposta para o usuário.
 */
function motivo(e: unknown, padrao: string): string {
  const detail = (e as { response?: { data?: { detail?: unknown } } } | null)
    ?.response?.data?.detail;
  return typeof detail === "string" && detail.length > 0
    ? detail
    : describeLoadFailure(e, padrao);
}

// Estado do conector Open Finance. Nasce desligado: enquanto o servidor não
// disser `enabled`, a tela de extrato não mostra nada de conexão bancária —
// quem não configurou o conector não deve nem saber que ele existe.
export const useConnectorStore = create<ConnectorState>((set, get) => ({
  ...vazio(),

  checkStatus: async () => {
    set({ isChecking: true });
    const status = await getConnectorStatus();
    set({ status, isChecking: false });
  },

  fetchItems: async () => {
    if (!get().status.enabled) return;
    set({ isLoadingItems: true });
    try {
      set({ items: await listConnectorItems(), isLoadingItems: false });
    } catch {
      // Lista de conexões é acessório: falhar aqui não derruba a tela
      set({ isLoadingItems: false });
    }
  },

  buildConnectUrl: async (redirect) => {
    const widget = get().status.widget;
    // Sem o script do widget a ponte só saberia mostrar erro: melhor dizer
    // aqui, antes de abrir o navegador para nada
    if (!widget?.scriptUrl || !widget.kind) {
      set({
        error:
          "A conexão bancária não está disponível agora. Tente de novo em instantes.",
      });
      return null;
    }
    set({ isLinking: true, error: null });
    try {
      const token = await createConnectToken();
      set({ isLinking: false });
      // Tudo no FRAGMENTO: fragmento não vai ao servidor, não entra em log de
      // acesso e não vaza no Referer. O script e o tipo do widget vão junto
      // porque a ponte não conhece provedor nenhum — quem sabe é o servidor
      const frag = [
        `token=${encodeURIComponent(token)}`,
        `redirect=${encodeURIComponent(redirect)}`,
        `widget=${encodeURIComponent(widget.scriptUrl)}`,
        `kind=${encodeURIComponent(widget.kind)}`,
      ].join("&");
      return `${WEB_BASE_URL}/${CONNECT_BRIDGE_PAGE}#${frag}`;
    } catch (e: any) {
      set({
        isLinking: false,
        error: motivo(e, "Não foi possível iniciar a conexão."),
      });
      return null;
    }
  },

  finishConnect: async (itemId) => {
    set({ isLinking: true, error: null });
    try {
      await registerConnectorItem(itemId);
      set({ isLinking: false });
      // Em SÉRIE, e não em paralelo: `fetchItems` só busca com o conector
      // ligado, e em paralelo ela leria o status ANTIGO e sairia pela guarda —
      // a lista ficava vazia logo depois de conectar
      await get().checkStatus();
      await get().fetchItems();
      return true;
    } catch (e: any) {
      // 409 é a conexão já registrada — para o usuário, deu certo do mesmo
      // jeito: a conta está lá. Tratar como erro assustaria à toa
      if (e?.response?.status === 409) {
        set({ isLinking: false });
        await Promise.all([get().checkStatus(), get().fetchItems()]);
        return true;
      }
      set({
        isLinking: false,
        error: motivo(e, "Não foi possível registrar a conexão."),
      });
      return false;
    }
  },

  unlink: async (id) => {
    set({ error: null });
    try {
      await unlinkConnectorItem(id);
      set({ items: get().items.filter((i) => i.id !== id) });
      await get().checkStatus();
      return true;
    } catch (e: any) {
      set({ error: motivo(e, "Não foi possível desconectar.") });
      return false;
    }
  },

  runSync: async (days = 90) => {
    if (get().isSyncing) return null;
    set({ isSyncing: true, error: null });
    try {
      const result = await syncConnector(days);
      set({ isSyncing: false });
      return result;
    } catch (e: any) {
      set({ error: motivo(e, "Falha ao sincronizar"), isSyncing: false });
      throw e;
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set(vazio()),
}));

/**
 * Lê o retorno da ponte. O id vem no fragmento — ver `buildConnectUrl`.
 * Devolve `null` quando a URL não é um retorno da ponte.
 */
export function parseConnectReturn(
  url: string | null | undefined,
): { itemId: string } | { cancelado: true } | { erro: string } | null {
  if (!url) return null;
  const i = url.indexOf("#");
  if (i < 0) return null;
  const p = new URLSearchParams(url.slice(i + 1));
  const item = p.get("item");
  if (item) return { itemId: item };
  if (p.get("cancelado")) return { cancelado: true };
  const erro = p.get("erro");
  if (erro) return { erro };
  return null;
}
