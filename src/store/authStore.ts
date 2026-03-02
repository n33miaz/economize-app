import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

interface AuthState {
  token: string | null;
  userName: string | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

export const useAuthStore = create(
  persist<AuthState>(
    (set) => ({
      token: null,
      userName: null,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/auth/login", { email, password });
          set({
            token: response.data.token,
            userName: response.data.name,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error:
              error.response?.status === 401
                ? "E-mail ou senha incorretos."
                : "Erro ao conectar com o servidor.",
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/auth/register", {
            name,
            email,
            password,
          });
          set({
            token: response.data.token,
            userName: response.data.name,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error:
              error.response?.status === 409
                ? "Este e-mail já está em uso."
                : "Erro ao criar conta.",
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        set({ token: null, userName: null, error: null });
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "@auth_storage",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
