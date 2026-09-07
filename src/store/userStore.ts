import { create } from "zustand";
import {
  UserMe,
  UserStats,
  getUserMe,
  getUserStats,
  updateUserMe,
} from "../services/api";
import { usePlanStore } from "./planStore";

interface UserState {
  me: UserMe | null;
  /** Contadores do hub; null enquanto não chegaram. */
  stats: UserStats | null;
  isLoading: boolean;
  isLoadingStats: boolean;
  isSaving: boolean;
  error: string | null;

  fetchMe: () => Promise<void>;
  fetchStats: () => Promise<void>;
  updateName: (name: string) => Promise<boolean>;
}

export const useUserStore = create<UserState>((set) => ({
  me: null,
  stats: null,
  isLoading: false,
  isLoadingStats: false,
  isSaving: false,
  error: null,

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const me = await getUserMe();
      set({ me, isLoading: false });
      // O plano vem junto do perfil: quem decide se há anúncio é o servidor,
      // e o planStore é só o lugar onde as telas leem isso
      usePlanStore.getState().hydrateFromUser(me);
    } catch {
      set({ error: "Falha ao carregar seus dados.", isLoading: false });
    }
  },

  fetchStats: async () => {
    set({ isLoadingStats: true });
    try {
      set({ stats: await getUserStats(), isLoadingStats: false });
    } catch {
      // Contador é enfeite informativo: se falhar, o hub segue com as linhas
      // navegáveis e um traço no lugar do número — errar para menos aqui não
      // impede ninguém de chegar ao extrato
      set({ isLoadingStats: false });
    }
  },

  updateName: async (name) => {
    set({ isSaving: true, error: null });
    try {
      const me = await updateUserMe(name);
      set({ me, isSaving: false });
      usePlanStore.getState().hydrateFromUser(me);
      // mantém o nome do authStore em sincronia — Home e Profile exibem de lá
      const { useAuthStore } = require("./authStore");
      useAuthStore.setState({ userName: me.name });
      return true;
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || "Falha ao salvar o nome.", isSaving: false });
      return false;
    }
  },
}));
