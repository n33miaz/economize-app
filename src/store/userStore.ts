import { create } from "zustand";
import { UserMe, getUserMe, updateUserMe } from "../services/api";

interface UserState {
  me: UserMe | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetchMe: () => Promise<void>;
  updateName: (name: string) => Promise<boolean>;
}

export const useUserStore = create<UserState>((set) => ({
  me: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchMe: async () => {
    set({ isLoading: true, error: null });
    try {
      const me = await getUserMe();
      set({ me, isLoading: false });
    } catch {
      set({ error: "Falha ao carregar seus dados.", isLoading: false });
    }
  },

  updateName: async (name) => {
    set({ isSaving: true, error: null });
    try {
      const me = await updateUserMe(name);
      set({ me, isSaving: false });
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
