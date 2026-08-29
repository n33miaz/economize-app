import { useWindowDimensions, type ViewStyle } from "react-native";

// Faixas escolhidas pelo que muda no layout, não por aparelho: 768 é onde cabe
// uma segunda coluna, 1024 é onde a navegação lateral passa a fazer sentido.
export const BREAKPOINTS = {
  tablet: 768,
  desktop: 1024,
} as const;

// Teto do miolo no desktop. Sem ele, um monitor de 1920 estica card e tabela
// de ponta a ponta e a leitura vira varredura horizontal.
export const CONTENT_MAX_WIDTH = 1180;

// Largura do trilho lateral. Mora aqui, e não no componente, porque a conta de
// colunas precisa descontar o trilho: quem decide a grade é o espaço que sobra
// para o conteúdo, não a largura da janela.
export const SIDE_RAIL_WIDTH = 240;

/**
 * Trilho lateral no lugar da barra inferior. É a única regra que decide entre
 * as duas navegações — barra e trilho nunca aparecem juntos.
 */
export function shouldUseSideRail(width: number): boolean {
  return width >= BREAKPOINTS.desktop;
}

/** Largura que sobra para o conteúdo depois do trilho (quando ele existe). */
export function contentWidthFor(width: number): number {
  return shouldUseSideRail(width)
    ? Math.max(0, width - SIDE_RAIL_WIDTH)
    : width;
}

/**
 * Colunas de uma grade de card, a partir do espaço REAL de conteúdo. Duas
 * colunas abaixo de 768 espremem cada card a menos de 384 px — pior que uma
 * coluna larga. Fica em 2 de propósito: o teto de 1180 do miolo deixaria uma
 * terceira coluna com ~370 px, estreita demais para os cards financeiros
 * (valor + variação + rótulo na mesma linha).
 */
export function columnsForWidth(contentWidth: number): 1 | 2 {
  return contentWidth >= BREAKPOINTS.tablet ? 2 : 1;
}

export interface Breakpoint {
  width: number;
  height: number;
  /** Largura útil do miolo — já sem o trilho lateral. */
  contentWidth: number;
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
  const contentWidth = contentWidthFor(width);

  return {
    width,
    height,
    contentWidth,
    isPhone: width < BREAKPOINTS.tablet,
    isTablet,
    isDesktop,
    isWide: shouldUseSideRail(width),
    columns: columnsForWidth(contentWidth),
  };
}

/**
 * Estilo do teto de largura do miolo. Existe para que o "não repita maxWidth
 * em tela nenhuma" continue verdadeiro: o `PageContainer` cobre as telas de
 * pilha, e os dois hosts de abas (Finanças e Mercado) precisam do MESMO teto
 * no cabeçalho e na régua de abas — senão, num monitor de 1920, o título
 * corre até a borda enquanto o conteúdo abaixo dele para em 1180.
 *
 * Devolve `null` fora do desktop: no celular não há nada a limitar.
 */
export function useContentCapStyle(): ViewStyle | null {
  const { isDesktop } = useBreakpoint();
  if (!isDesktop) return null;
  return { width: "100%", maxWidth: CONTENT_MAX_WIDTH, alignSelf: "center" };
}
