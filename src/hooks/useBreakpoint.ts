import { useWindowDimensions } from "react-native";

// Faixas escolhidas pelo que muda no layout, não por aparelho: 768 é onde cabe
// uma segunda coluna, 1024 é onde a navegação lateral passa a fazer sentido.
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

// Teto do miolo no desktop. Sem ele, um monitor de 1920 estica card e tabela
// de ponta a ponta e a leitura vira varredura horizontal.
export const CONTENT_MAX_WIDTH = 1180;

export interface Breakpoint {
  width: number;
  height: number;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** A partir daqui a navegação vai para a lateral, não para o rodapé. */
  isWide: boolean;
  /** Quantidade de colunas sugerida para grades de card. */
  columns: 1 | 2;
}

export function useBreakpoint(): Breakpoint {
  const { width, height } = useWindowDimensions();

  const isDesktop = width >= BREAKPOINTS.desktop;
  const isTablet = width >= BREAKPOINTS.tablet && !isDesktop;

  return {
    width,
    height,
    isPhone: width < BREAKPOINTS.tablet,
    isTablet,
    isDesktop,
    isWide: isDesktop,
    columns: width >= BREAKPOINTS.tablet ? 2 : 1,
  };
}
