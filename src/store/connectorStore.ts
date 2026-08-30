import { Platform } from "react-native";
import { create } from "zustand";
import {
  PluggyItem,
  PluggyStatus,
  StatementUploadResult,
  createPluggyConnectToken,
  getPluggyStatus,
  listPluggyItems,
  registerPluggyItem,
  syncPluggy,
  unlinkPluggyItem,
} from "../services/api";

/**
 * Onde mora a ponte do Pluggy Connect (`public/pluggy-connect.html`).
 *
 * Na web é a própria origem — a página é publicada junto do site. No aparelho
 * não existe `window`, então vem do ambiente, com o site publicado como padrão.
 */
export const WEB_BASE_URL =
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.origin
    : process.env.EXPO_PUBLIC_WEB_BASE_URL ||
      "https://economize-web.onrender.com";

interface ConnectorState {
  pluggy: PluggyStatus;
  items: PluggyItem[];
  isChecking: boolean;
  isSyncing: boolean;
  isLoadingItems: boolean;
  /** Cobre pegar o token e gravar o item — os dois travam o botão. */
  isLinking: boolean;
  error: string | null;

  checkPluggy: () => Promise<void>;
  fetchItems: () => Promise<void>;
  /** URL da ponte com o token no fragmento, ou null se o token falhar. */
  buildConnectUrl: (redirect: string) => Promise<string | null>;
  finishConnect: (itemId: string) => Promise<boolean>;
  unlink: (id: string) => Promise<boolean>;
  runPluggySync: (days?: number) => Promise<StatementUploadResult | null>;
  clearError: () => void;
  reset: () => void;
}

const vazio = () => ({
  pluggy: { enabled: false, configured: false, itemCount: 0 } as PluggyStatus,
  items: [] as PluggyItem[],
  isChecking: false,
  isSyncing: false,
  isLoadingItems: false,
  isLinking: false,
  error: null as string | null,
});

/** O `detail` do ProblemDetail é a mensagem boa; a do axios é genérica. */
function motivo(e: any, padrao: string): string {
  return e?.response?.data?.detail || e?.message || padrao;
}

// Estado do conector Open Finance. Nasce desligado: enquanto o servidor não
// disser `enabled`, a tela de extrato não mostra nada de Pluggy — quem não
// configurou o conector não deve nem saber que ele existe.
export const useConnectorStore = create<ConnectorState>((set, get) => ({
  ...vazio(),

  checkPluggy: async () => {
    set({ isChecking: true });
    const status = await getPluggyStatus();
    set({ pluggy: status, isChecking: false });
  },

  fetchItems: async () => {
    if (!get().pluggy.enabled) return;
    set({ isLoadingItems: true });
    try {
      set({ items: await listPluggyItems(), isLoadingItems: false });
    } catch {
      // Lista de conexões é acessório: falhar aqui não derruba a tela
      set({ isLoadingItems: false });
    }
  },

  buildConnectUrl: async (redirect) => {
    set({ isLinking: true, error: null });
    try {
      const token = await createPluggyConnectToken();
      set({ isLinking: false });
      // Token e destino no FRAGMENTO: fragmento não vai ao servidor, não entra
      // em log de acesso e não vaza no Referer
      const frag = `token=${encodeURIComponent(token)}&redirect=${encodeURIComponent(redirect)}`;
      return `${WEB_BASE_URL}/pluggy-connect.html#${frag}`;
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
      await registerPluggyItem(itemId);
      set({ isLinking: false });
      // Em SÉRIE, e não em paralelo: `fetchItems` só busca com o conector
      // ligado, e em paralelo ela leria o status ANTIGO e sairia pela guarda —
      // a lista ficava vazia logo depois de conectar
      await get().checkPluggy();
      await get().fetchItems();
      return true;
    } catch (e: any) {
      // 409 é a conexão já registrada — para o usuário, deu certo do mesmo
      // jeito: a conta está lá. Tratar como erro assustaria à toa
      if (e?.response?.status === 409) {
        set({ isLinking: false });
        await Promise.all([get().checkPluggy(), get().fetchItems()]);
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
      await unlinkPluggyItem(id);
      set({ items: get().items.filter((i) => i.id !== id) });
      await get().checkPluggy();
      return true;
    } catch (e: any) {
      set({ error: motivo(e, "Não foi possível desconectar.") });
      return false;
    }
  },

  runPluggySync: async (days = 90) => {
    if (get().isSyncing) return null;
    set({ isSyncing: true, error: null });
    try {
      const result = await syncPluggy(days);
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
 * Devolve `null` quando a URL não é um retorno do Pluggy.
 */
export function parsePluggyReturn(
  url: string | null | undefined,
): { itemId: string } | { cancelado: true } | { erro: string } | null {
  if (!url) return null;
  const i = url.indexOf("#");
  if (i < 0) return null;
  const p = new URLSearchParams(url.slice(i + 1));
  const item = p.get("pluggy_item");
  if (item) return { itemId: item };
  if (p.get("pluggy_cancelado")) return { cancelado: true };
  const erro = p.get("erro");
  if (erro) return { erro };
  return null;
}
