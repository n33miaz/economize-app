import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../services/api";
import {
  deviceLabel,
  readDeviceToken,
  saveDeviceToken,
} from "../utils/deviceIdentity";

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
          set({
            token: response.data.token,
            userName: response.data.name,
            isLoading: false,
          });
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

        // Idem: os desejos guardam o salário confirmado e a jornada do dono
        // anterior — o dado mais pessoal que o app tem. Sair tem de apagar.
        const { useWishStore } = require("./wishStore");
        useWishStore.getState().reset();

        // Idem: a casa guarda nome e números de OUTRAS pessoas, e o
        // `hasLoadedOnce` faria a próxima conta ver a casa da anterior
        const { useFamilyStore } = require("./familyStore");
        useFamilyStore.getState().reset();

        // Idem: o plano é da conta. Sem zerar, quem entrasse depois de um
        // Plus continuaria sem anúncios — e um gratuito depois de um Plus
        // vencido veria o rótulo errado no Perfil
        const { usePlanStore } = require("./planStore");
        usePlanStore.getState().reset();

        // Idem: posições, saldos e o perfil de investidor são o retrato mais
        // completo do patrimônio de alguém, e o cache de cinco minutos por
        // fatia sobreviveria a um login com outra conta
        const { useInvestmentStore } = require("./investmentStore");
        useInvestmentStore.getState().reset();

        // Manchete não é dado pessoal — o motivo aqui é outro: "apagar dados
        // locais" passa por este ponto e tem de esvaziar os caches de verdade,
        // e o reset também descarta as buscas em voo, pedidas com o token que
        // acabou de ser jogado fora
        const { useNewsStore } = require("./newsStore");
        useNewsStore.getState().reset();
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
