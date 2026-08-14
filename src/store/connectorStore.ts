import { create } from "zustand";
import {
  PluggyStatus,
  StatementUploadResult,
  getPluggyStatus,
  syncPluggy,
} from "../services/api";

interface ConnectorState {
  pluggy: PluggyStatus;
  isChecking: boolean;
  isSyncing: boolean;
  error: string | null;

  checkPluggy: () => Promise<void>;
  runPluggySync: (days?: number) => Promise<StatementUploadResult | null>;
}

// Estado do conector Open Finance. Nasce desligado: enquanto o servidor não
// disser `enabled`, a tela de extrato não mostra nada de Pluggy — quem não
// configurou o conector não deve nem saber que ele existe.
export const useConnectorStore = create<ConnectorState>((set, get) => ({
  pluggy: { enabled: false, configured: false, itemCount: 0 },
  isChecking: false,
  isSyncing: false,
  error: null,

  checkPluggy: async () => {
    set({ isChecking: true });
    const status = await getPluggyStatus();
    set({ pluggy: status, isChecking: false });
  },

  runPluggySync: async (days = 90) => {
    if (get().isSyncing) return null;
    set({ isSyncing: true, error: null });
    try {
      const result = await syncPluggy(days);
      set({ isSyncing: false });
      return result;
    } catch (e: any) {
      // O detalhe do ProblemDetail é a mensagem boa ("sem credenciais",
      // "indisponível para esta conta"); a do axios é genérica
      const detail = e?.response?.data?.detail;
      set({
        error: detail || e?.message || "Falha ao sincronizar",
        isSyncing: false,
      });
      throw e;
    }
  },
}));
