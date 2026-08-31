import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  DEFAULT_CYCLE_ANCHOR_DAY,
  clampAnchorDay,
} from "../utils/cycleWindow";

export type ThemeMode = "light" | "dark" | "system";
export type Currency = "BRL" | "USD" | "EUR";
export type Language = "pt-BR" | "en-US";

// Recorte do carrossel de notícias do Mercado. "all" não vira parâmetro de
// rede — é a ausência de filtro, e o servidor antigo (que ignora os params)
// continua respondendo o mesmo shape.
export type NewsRegion = "all" | "br" | "global";
export type NewsCategory = "all" | "economia" | "mercados" | "cripto" | "geral";

interface PreferencesState {
  theme: ThemeMode;
  biometricLogin: boolean;
  // Se o usuário já respondeu (uma vez) ao modal pós-login que oferece a
  // biometria — a pergunta não se repete; os toggles seguem valendo
  biometricChoiceMade: boolean;
  defaultCurrency: Currency;
  hideBalance: boolean;
  language: Language;
  notificationsEnabled: boolean;
  lastSeenVersion: string | null;
  newsRegion: NewsRegion;
  newsCategory: NewsCategory;
  /**
   * Dia em que o mês financeiro do usuário vira (EC-092). Dia 1 = mês de
   * calendário. Mora aqui, e não no servidor, por decisão de projeto: o custo
   * conhecido é que a escolha não acompanha a troca de aparelho.
   */
  cycleAnchorDay: number;
  /**
   * Se o anúncio do pote vivo (EC-147) já foi mostrado. Mudança silenciosa em
   * ícone lê como bug: ninguém descobre sozinho que o pote conta o mês.
   */
  potAnnouncementSeen: boolean;
  hasHydrated: boolean;

  setTheme: (theme: ThemeMode) => void;
  toggleBiometric: () => void;
  setBiometric: (enabled: boolean) => void;
  setBiometricChoiceMade: (made: boolean) => void;
  setDefaultCurrency: (currency: Currency) => void;
  toggleHideBalance: () => void;
  setLanguage: (language: Language) => void;
  toggleNotifications: () => void;
  setLastSeenVersion: (version: string) => void;
  setNewsRegion: (region: NewsRegion) => void;
  setNewsCategory: (category: NewsCategory) => void;
  setCycleAnchorDay: (day: number) => void;
  setPotAnnouncementSeen: (seen: boolean) => void;
  reset: () => void;
}

const initialState = {
  theme: "dark" as ThemeMode,
  biometricLogin: false,
  biometricChoiceMade: false,
  defaultCurrency: "BRL" as Currency,
  hideBalance: false,
  language: "pt-BR" as Language,
  notificationsEnabled: true,
  lastSeenVersion: null,
  newsRegion: "all" as NewsRegion,
  newsCategory: "all" as NewsCategory,
  cycleAnchorDay: DEFAULT_CYCLE_ANCHOR_DAY,
  potAnnouncementSeen: false,
};

export const usePreferencesStore = create(
  persist<PreferencesState>(
    (set) => ({
      ...initialState,
      hasHydrated: false,

      setTheme: (theme) => set({ theme }),
      toggleBiometric: () =>
        set((state) => ({ biometricLogin: !state.biometricLogin })),
      setBiometric: (enabled) => set({ biometricLogin: enabled }),
      setBiometricChoiceMade: (made) => set({ biometricChoiceMade: made }),
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
      toggleHideBalance: () =>
        set((state) => ({ hideBalance: !state.hideBalance })),
      setLanguage: (language) => set({ language }),
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      setLastSeenVersion: (lastSeenVersion) => set({ lastSeenVersion }),
      setNewsRegion: (newsRegion) => set({ newsRegion }),
      setNewsCategory: (newsCategory) => set({ newsCategory }),
      // Clampa na entrada: valor fora de 1..31 viraria janela sem sentido
      setCycleAnchorDay: (day) => set({ cycleAnchorDay: clampAnchorDay(day) }),
      setPotAnnouncementSeen: (potAnnouncementSeen) => set({ potAnnouncementSeen }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "@preferences_storage",
      storage: createJSONStorage(() => AsyncStorage),
      // setState (e não mutação direta do state) para notificar os subscribers —
      // o BiometricGate depende desse re-render para armar o bloqueio
      onRehydrateStorage: () => () => {
        usePreferencesStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/**
 * Âncora já normalizada. Ler direto do estado exporia o app a um valor
 * corrompido no armazenamento (versão antiga, edição manual) — e uma âncora
 * inválida quebraria a aritmética da janela, não só o rótulo.
 */
export function selectCycleAnchorDay(state: PreferencesState): number {
  return clampAnchorDay(state.cycleAnchorDay);
}

/** Mesma leitura para quem chama fora de componente (stores, handlers). */
export function getCycleAnchorDay(): number {
  return clampAnchorDay(usePreferencesStore.getState().cycleAnchorDay);
}
