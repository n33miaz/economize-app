import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import {
  deviceLabel,
  readDeviceToken,
  saveDeviceToken,
} from "../utils/deviceIdentity";
import { clearSessionData } from "./sessionReset";

/**
 * O que o login devolve ao chamador quando ele pede para NÃO entrar ainda.
 *
 * <p>Ou veio a sessão (token + nome), ou veio o desafio do segundo fator. Os
 * dois casos são excludentes e o `kind` é o que a tela lê para saber se abre a
 * pergunta da biometria ou o campo do código.
 */
export type LoginOutcome =
  | { kind: "session"; token: string; name: string }
  | { kind: "mfa"; mfaToken: string };

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
  ) => Promise<LoginOutcome | undefined>;
  /** Segundo passo: troca o desafio + o código pela sessão. */
  submitMfaCode: (
    mfaToken: string,
    code: string,
    options?: { deferCommit?: boolean; rememberDevice?: boolean },
  ) => Promise<LoginOutcome | undefined>;
  completeLogin: (token: string, userName: string) => void;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

/**
 * A ÚNICA porta por onde uma sessão entra no estado: login direto, segundo
 * fator, cadastro e o `completeLogin` da tela passam todos aqui.
 *
 * <p>Limpa ANTES de gravar o token. O logout já limpou — mas entre a saída de
 * uma pessoa e a entrada da outra pode ter sobrado alguma coisa (uma resposta
 * atrasada, um store escrito por uma tela ainda montada), e é na entrada que
 * "nada de quem saiu aparece" tem de ser verdade. Custa um punhado de `set`
 * em stores já vazios.
 *
 * <p>Função de módulo, e não closure do `create`: usa o `setState` do
 * store pronto, o que deixa as quatro chamadas iguais e testáveis por fora.
 */
function openSession(token: string, userName: string): void {
  clearSessionData();
  useAuthStore.setState({ token, userName, isLoading: false, error: null });
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
          // O segredo do aparelho, quando existe, dispensa o segundo passo:
          // é o que faz o fator conviver com o celular de todo dia
          const response = await api.post("/auth/login", {
            email,
            password,
            deviceToken: await readDeviceToken(),
            deviceLabel: deviceLabel(),
          });

          // Segundo fator ativo: a senha conferiu, mas NÃO há sessão. O que
          // volta é um desafio de 5 minutos, e a tela assume daqui
          if (response.data?.mfaRequired) {
            set({ isLoading: false });
            return { kind: "mfa", mfaToken: response.data.mfaToken };
          }

          // Com deferCommit o token validado NÃO entra no estado: gravar o
          // token troca a árvore de navegação na hora, e o chamador ainda
          // precisa resolver o modal de biometria antes de entrar no app
          if (options?.deferCommit) {
            set({ isLoading: false });
            return {
              kind: "session",
              token: response.data.token,
              name: response.data.name,
            };
          }
          openSession(response.data.token, response.data.name);
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

      submitMfaCode: async (mfaToken, code, options) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/auth/login/mfa", {
            mfaToken,
            code,
            rememberDevice: options?.rememberDevice ?? true,
            deviceLabel: deviceLabel(),
          });
          // Guardar ANTES de abrir a sessão: se o app fechasse no meio, o
          // aparelho ficaria conhecido no servidor e desconhecido aqui — e o
          // usuário levaria um pedido de código que não devia existir
          if (response.data?.deviceToken) {
            await saveDeviceToken(response.data.deviceToken);
          }
          if (options?.deferCommit) {
            set({ isLoading: false });
            return {
              kind: "session",
              token: response.data.token,
              name: response.data.name,
            };
          }
          openSession(response.data.token, response.data.name);
          return undefined;
        } catch (error: any) {
          // O servidor responde o MESMO 401 para código errado e para desafio
          // expirado, de propósito — a mensagem aqui cobre os dois sem mentir
          set({
            error:
              error.response?.status === 401
                ? "Código inválido ou expirado. Tente de novo."
                : "Erro ao conectar com o servidor.",
            isLoading: false,
          });
          throw error;
        }
      },

      completeLogin: (token, userName) => {
        openSession(token, userName);
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post("/auth/register", {
            name,
            email,
            password,
          });
          openSession(response.data.token, response.data.name);
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
        // O token cai PRIMEIRO: é ele que faz o interceptor da API descartar
        // as respostas ainda em voo desta sessão, que de outro modo
        // repovoariam os stores logo depois de limpos
        set({ token: null, userName: null, error: null });
        // Ponto único de propósito — sair pelo Perfil, pela biometria, pelo
        // 401 do interceptor e pelo "apagar dados locais" passam todos aqui.
        // O QUE é limpo mora em `sessionReset`, com um teste que falha se um
        // store novo ficar de fora
        clearSessionData();
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
