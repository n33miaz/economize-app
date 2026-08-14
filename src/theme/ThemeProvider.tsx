import { useEffect } from "react";
import { useColorScheme } from "react-native";
import { colorScheme as nativewindColorScheme } from "nativewind";

import { darkTheme, lightTheme } from "./colors";
import { usePreferencesStore } from "../store/preferencesStore";

// União (e não typeof darkTheme) porque os hexas são literais `as const`;
// estruturalmente os dois temas são idênticos, então o consumo é transparente
export type Theme = typeof darkTheme | typeof lightTheme;

// Hook puro (sem Context): o Zustand já propaga a troca de preferência e o
// useColorScheme reage ao sistema — um provider aqui seria camada morta
export function useTheme(): Theme {
  const theme = usePreferencesStore((s) => s.theme);
  const systemColorScheme = useColorScheme();
  const resolved = theme === "system" ? systemColorScheme : theme;
  // Dark é o default da marca: qualquer valor indefinido cai no escuro
  return resolved === "light" ? lightTheme : darkTheme;
}

/**
 * Repassa a preferência de tema para o NativeWind, que mantém o próprio estado
 * de color scheme. Sem isso as classes (`bg-surface`, `text-textPrimary`) e o
 * estilo inline do `useTheme()` divergiam: escolher "Claro" trocava só metade
 * da tela. Chamado uma única vez, no App.
 */
export function useThemeSync() {
  const theme = usePreferencesStore((s) => s.theme);

  useEffect(() => {
    nativewindColorScheme.set(theme);
  }, [theme]);
}
