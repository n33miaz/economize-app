import { create } from "zustand";

type ToastType = "success" | "error" | "warning" | "info";

/** Tempo de leitura de um toast. */
const TOAST_VISIBLE_MS = 4000;

/**
 * Janela em que a MESMA frase não volta. Três telas falhando juntas no mesmo
 * cold start mostravam três vezes "sem conexão", uma por cima da outra — o
 * usuário lia repetição, não informação.
 */
export const TOAST_DEDUPE_MS = 10000;

interface ToastState {
  visible: boolean;
  message: string;
  type: ToastType;
  /** Última frase mostrada e quando — é o que sustenta a deduplicação. */
  lastMessage: string;
  lastShownAt: number;
  showToast: (message: string, type?: ToastType) => void;
  hideToast: () => void;
  /** Fim de sessão: recolhe o aviso e esquece o texto. */
  reset: () => void;
}

// Um relógio só: sem guardar o anterior, o toast novo era apagado pelo
// timeout do velho antes de dar tempo de ler
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useToastStore = create<ToastState>((set, get) => ({
  visible: false,
  message: "",
  type: "info",
  lastMessage: "",
  lastShownAt: 0,

  showToast: (message, type = "info") => {
    // Frase vazia não é aviso. É o que a leitura comum de falhas devolve para
    // a resposta de uma sessão encerrada: quem faz `showToast(falha.message)`
    // não precisa saber que esse caso existe
    if (!message) return;
    const now = Date.now();
    const { lastMessage, lastShownAt } = get();
    if (message === lastMessage && now - lastShownAt < TOAST_DEDUPE_MS) return;

    if (hideTimer) clearTimeout(hideTimer);
    set({ visible: true, message, type, lastMessage: message, lastShownAt: now });
    hideTimer = setTimeout(() => {
      hideTimer = null;
      set({ visible: false });
    }, TOAST_VISIBLE_MS);
  },

  hideToast: () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ visible: false });
  },

  // Fim de sessão: o aviso na tela pode citar o que a pessoa acabou de fazer
  // ("Categoria Mesada do Pedro removida") e ficaria alguns segundos por cima
  // do Login. Só na SAÍDA: o "sessão expirou" do 401 é mostrado depois dela, e
  // limpar na entrada cortaria o "biometria ativada" que o Login mostra
  // meio segundo antes de entrar
  reset: () => {
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
    set({ visible: false, message: "", lastMessage: "", lastShownAt: 0 });
  },
}));
