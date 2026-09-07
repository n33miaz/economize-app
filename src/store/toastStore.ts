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
}));
