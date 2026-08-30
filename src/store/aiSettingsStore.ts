import { create } from "zustand";

import {
  AiKeyTestResult,
  AiProviderCatalog,
  AiProviderId,
  AiSettings,
  deleteAiSettings,
  getAiProviders,
  getAiSettings,
  getApiErrorStatus,
  saveAiSettings,
  testAiKey,
} from "../services/api";

interface AiSettingsState {
  catalog: AiProviderCatalog | null;
  settings: AiSettings | null;
  isLoading: boolean;
  /** Separa "ainda não perguntei" de "perguntei e a instalação não aceita". */
  hasLoadedOnce: boolean;
  error: string | null;

  isSaving: boolean;
  isTesting: boolean;
  /** Último teste. Vive fora de `settings` porque testar não grava nada. */
  testResult: AiKeyTestResult | null;

  load: () => Promise<void>;
  save: (
    provider: AiProviderId,
    model: string,
    apiKey: string,
  ) => Promise<boolean>;
  remove: () => Promise<boolean>;
  test: (params: {
    provider?: AiProviderId;
    model?: string;
    apiKey?: string;
  }) => Promise<AiKeyTestResult | null>;
  clearTestResult: () => void;
  clearError: () => void;
  reset: () => void;
}

const emptyState = () => ({
  catalog: null as AiProviderCatalog | null,
  settings: null as AiSettings | null,
  isLoading: false,
  hasLoadedOnce: false,
  error: null as string | null,
  isSaving: false,
  isTesting: false,
  testResult: null as AiKeyTestResult | null,
});

/**
 * Mensagem para o usuário a partir do status HTTP. O 503 tem texto próprio
 * porque não é falha: é a instalação sem chave-mestra de criptografia, e mandar
 * "tente de novo" faria o usuário repetir algo que nunca vai funcionar.
 */
function describeFailure(error: unknown, fallback: string): string {
  const status = getApiErrorStatus(error);
  if (status === 503) {
    return "Este servidor não aceita chave própria no momento.";
  }
  if (status === 400) {
    return "Provedor ou modelo não aceito. Escolha um da lista.";
  }
  return fallback;
}

export const useAiSettingsStore = create<AiSettingsState>((set, get) => ({
  ...emptyState(),

  load: async () => {
    set({ isLoading: true, error: null });
    try {
      // As duas juntas: a tela não serve para nada com só uma delas, e duas
      // esperas em sequência dobrariam o tempo de abertura
      const [catalog, settings] = await Promise.all([
        getAiProviders(),
        getAiSettings(),
      ]);
      set({ catalog, settings, isLoading: false, hasLoadedOnce: true });
    } catch (e) {
      // hasLoadedOnce continua falso: falha não é resposta, e marcar aqui
      // deixaria a tela presa no erro até o app reiniciar
      set({
        isLoading: false,
        error: describeFailure(
          e,
          "Não foi possível carregar as opções de IA.",
        ),
      });
    }
  },

  save: async (provider, model, apiKey) => {
    set({ isSaving: true, error: null });
    try {
      const settings = await saveAiSettings(provider, model, apiKey);
      // A resposta do PUT já é o estado novo — refetch seria uma ida a mais
      set({ settings, isSaving: false, testResult: null });
      return true;
    } catch (e) {
      set({
        isSaving: false,
        error: describeFailure(e, "Não foi possível salvar a chave."),
      });
      return false;
    }
  },

  remove: async () => {
    set({ isSaving: true, error: null });
    try {
      await deleteAiSettings();
      // O DELETE responde 204: sem corpo para reaproveitar, o estado novo vem
      // de uma leitura — e é ela que traz o provedor do servidor que assume
      const settings = await getAiSettings();
      set({ settings, isSaving: false, testResult: null });
      return true;
    } catch (e) {
      set({
        isSaving: false,
        error: describeFailure(e, "Não foi possível remover a chave."),
      });
      return false;
    }
  },

  test: async (params) => {
    set({ isTesting: true, testResult: null, error: null });
    try {
      // `ok: false` chega com HTTP 200: é resultado de teste, não erro de
      // transporte. Tratar como exceção esconderia a mensagem que explica
      // o motivo (chave recusada, modelo inexistente, cota estourada…)
      const result = await testAiKey(params);
      set({ testResult: result, isTesting: false });
      return result;
    } catch (e) {
      set({
        isTesting: false,
        error: describeFailure(e, "Não foi possível testar a chave agora."),
      });
      return null;
    }
  },

  clearTestResult: () => set({ testResult: null }),
  clearError: () => set({ error: null }),
  reset: () => set(emptyState()),
}));

/** Só o essencial para a tela decidir o que mostrar, sem repetir a regra. */
export function hasOwnKey(settings: AiSettings | null): boolean {
  return settings?.source === "USER";
}

/** Chave cadastrada que a chave-mestra atual não abre mais: pede recadastro. */
export function keyIsUnreadable(settings: AiSettings | null): boolean {
  return settings?.keyStatus === "UNREADABLE";
}
