import { create } from "zustand";
import {
  UserMe,
  UserStats,
  getUserMe,
  getUserStats,
  updateUserMe,
} from "../services/api";
import { usePlanStore } from "./planStore";
import {
  describeLoadFailure,
  describeSaveFailure,
} from "../services/requestFailure";

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
  /** Fim de sessão: apaga o perfil e os contadores. */
  reset: () => void;
}

export const useUserStore = create<UserState>((set, get) => ({
  me: null,
  stats: null,
  isLoading: false,
  isLoadingStats: false,
  isSaving: false,
  error: null,

  fetchMe: async () => {
    // Uma busca em voo basta: dois focos no mesmo instante (montagem + volta
    // de uma folha) pediam a mesma lista duas vezes, e na instância gratuita
    // isso é o dobro de trabalho para o mesmo resultado
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const me = await getUserMe();
      set({ me, isLoading: false });
      // O plano vem junto do perfil: quem decide se há anúncio é o servidor,
      // e o planStore é só o lugar onde as telas leem isso
      usePlanStore.getState().hydrateFromUser(me);
    } catch (e) {
      const message = describeLoadFailure(e, "Falha ao carregar seus dados.");
      if (!message) return;
      set({
        error: message,
        isLoading: false,
      });
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
    } catch (e) {
      const message = describeSaveFailure(e, "Falha ao salvar o nome.");
      if (!message) return false;
      set({
        error: message,
        isSaving: false,
      });
      return false;
    }
  },

  // Fim de sessão: nome, e-mail e os contadores do hub ("1.752 lançamentos")
  // são de quem saiu. Sem isto o Perfil da conta nova abria com os da anterior
  // até o fetch responder
  reset: () =>
    set({
      me: null,
      stats: null,
      isLoading: false,
      isLoadingStats: false,
      isSaving: false,
      error: null,
    }),
}));
