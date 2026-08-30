import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";

interface LoginResult {
  token: string;
  name: string;
}

interface AuthState {
  token: string | null;
  userName: string | null;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  login: (
    email: string,
    password: string,
    options?: { deferCommit?: boolean },
  ) => Promise<LoginResult | undefined>;
  completeLogin: (token: string, userName: string) => void;
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
      hasHydrated: false,

      login: async (email, password, options) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/auth/login", { email, password });
          // Com deferCommit o token validado NÃO entra no estado: gravar o
          // token troca a árvore de navegação na hora, e o chamador ainda
          // precisa resolver o modal de biometria antes de entrar no app
          if (options?.deferCommit) {
            set({ isLoading: false });
            return {
              token: response.data.token,
              name: response.data.name,
            };
          }
          set({
            token: response.data.token,
            userName: response.data.name,
            isLoading: false,
          });
          return undefined;
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

      completeLogin: (token, userName) => {
        set({ token, userName, error: null });
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
        // O accountsStore é o único store com cache permanente
        // (`hasLoadedOnce`): sem zerá-lo AQUI, um login com outra conta
        // continuaria desenhando os cartões e as faturas da conta anterior,
        // porque nenhuma tela refaz o fetch depois do primeiro sucesso.
        // Ponto único de propósito — sair pelo Perfil, pela biometria, pelo
        // 401 do interceptor e pelo "apagar dados locais" passam todos aqui.
        //
        // Import tardio pelo mesmo motivo (e no mesmo estilo) do interceptor
        // em `services/api`: o accountsStore importa a API, que importa este
        // store, e trazer o módulo no topo fecharia o ciclo na inicialização.
        const { useAccountsStore } = require("./accountsStore");
        useAccountsStore.getState().reset();

        // Mesma razão e mesmo import tardio: as opções de IA guardam provedor,
        // modelo e os 4 últimos dígitos da chave do dono anterior, e o
        // `hasLoadedOnce` impediria a tela de perguntar de novo
        const { useAiSettingsStore } = require("./aiSettingsStore");
        useAiSettingsStore.getState().reset();
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "@auth_storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Sinaliza o fim da hidratação via setState para as rotas esperarem o
      // token persistido — sem isso o cold start pisca a tela de Login
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
