import { Platform } from "react-native";

import { typography } from "./typography";

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
} as const;

/**
 * Respiro interno de uma folha do `CustomModal`.
 *
 * O modal entrega só a superfície: quem desenha o conteúdo é que precisa
 * afastá-lo das bordas. Enquanto isso foi combinado de cabeça, três telas
 * copiaram este mesmo objeto como constante local — e a folha que não copiou
 * (a oferta de biometria) abria com o texto e os botões colados nas duas
 * laterais.
 *
 * O topo é menor que a base porque acima do conteúdo já existe o grabber da
 * folha, e abaixo dela vem o rodapé do aparelho.
 */
export const SHEET_PADDING = {
  paddingHorizontal: spacing[5],
  paddingTop: spacing[3],
  paddingBottom: spacing[6],
} as const;

/**
 * Título de uma folha ou diálogo.
 *
 * <p>Escolha 11 do comparador de 16/09: **18/700**. Antes deste token as
 * folhas tinham títulos de 16, 18 e 20 — CategoryPicker, CycleAnchor,
 * NewVersion, PremiumOffer e ReportDetail em 20, sete outras em 18. Todas
 * abrem pelo mesmo gesto e se empilham na mesma superfície, então a diferença
 * não lia como hierarquia: lia como descuido.
 *
 * <p>18 e não 20 porque a folha já é o foco da tela — ela não disputa
 * atenção com nada atrás dela, e um título grande só rouba altura do conteúdo
 * que a pessoa abriu a folha para ver. A `lineHeight` é explícita para a soma
 * das alturas fechar igual em todas as plataformas.
 */
export const SHEET_TITLE = {
  fontSize: 18,
  lineHeight: 24,
  fontWeight: "700",
} as const;

// Raios um nível mais generosos que o padrão de mercado — parte da
// identidade (geometria arredondada, moderna)
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 18,
  "2xl": 28,
  "3xl": 36,
  full: 9999,
} as const;

export const shadow = {
  none: {},
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 1 },
    },
    android: { elevation: 1 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.08,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  lg: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  glow: {
    shadowColor: "#F2C14E",
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
} as const;

export const motion = {
  duration: {
    instant: 150,
    fast: 250,
    base: 300,
    slow: 450,
  },
  easing: {
    standard: [0.2, 0.0, 0.0, 1.0] as const,
    emphasized: [0.3, 0.0, 0.8, 0.15] as const,
    // desaceleração suave para entradas de card/lista — nunca linear
    soft: [0.22, 0.61, 0.36, 1.0] as const,
  },
} as const;

export const ds = {
  spacing,
  sheetPadding: SHEET_PADDING,
  sheetTitle: SHEET_TITLE,
  radius,
  shadow,
  typography,
  motion,
} as const;
