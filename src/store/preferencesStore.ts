import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type ThemeMode = "light" | "dark" | "system";
export type Currency = "BRL" | "USD" | "EUR";
export type Language = "pt-BR" | "en-US";

interface PreferencesState {
  theme: ThemeMode;
  biometricLogin: boolean;
  defaultCurrency: Currency;
  hideBalance: boolean;
  language: Language;
  notificationsEnabled: boolean;
  lastSeenVersion: string | null;
  hasHydrated: boolean;

  setTheme: (theme: ThemeMode) => void;
  toggleBiometric: () => void;
  setBiometric: (enabled: boolean) => void;
  setDefaultCurrency: (currency: Currency) => void;
  toggleHideBalance: () => void;
  setLanguage: (language: Language) => void;
  toggleNotifications: () => void;
  setLastSeenVersion: (version: string) => void;
  reset: () => void;
}

const initialState = {
  theme: "dark" as ThemeMode,
  biometricLogin: false,
  defaultCurrency: "BRL" as Currency,
  hideBalance: false,
  language: "pt-BR" as Language,
  notificationsEnabled: true,
  lastSeenVersion: null,
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
      setDefaultCurrency: (defaultCurrency) => set({ defaultCurrency }),
      toggleHideBalance: () =>
        set((state) => ({ hideBalance: !state.hideBalance })),
      setLanguage: (language) => set({ language }),
      toggleNotifications: () =>
        set((state) => ({ notificationsEnabled: !state.notificationsEnabled })),
      setLastSeenVersion: (lastSeenVersion) => set({ lastSeenVersion }),
      reset: () => set({ ...initialState }),
    }),
    {
      name: "@preferences_storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.hasHydrated = true;
        }
      },
    },
  ),
);
