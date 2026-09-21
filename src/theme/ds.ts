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

/** O alvo de toque mínimo — 44 px, o piso das duas plataformas. */
export const TOUCH_MIN = 44;

/**
 * Cresce o alvo de toque de um ícone SEM mover nada na tela.
 *
 * <p><b>Por que não `hitSlop`.</b> Ele resolve no Android e no iOS, e é o que
 * o app usava em toda parte — mas no <b>navegador ele não faz nada</b>: o
 * react-native-web não tem como estender a área de acerto de uma caixa, e
 * quem decide o que recebe o clique é o modelo de caixas do CSS. Medido em
 * 21/09/2026: um clique 8 px fora de um botão com `hitSlop` de 10 não
 * disparou; o mesmo clique no centro disparou. E o navegador no iPhone é o
 * foco declarado do dono — ali o olho que esconde os valores era um alvo de
 * 18 × 18, do tamanho de uma unha.
 *
 * <p><b>Como isto funciona.</b> Cresce por dentro (padding) e devolve o mesmo
 * tanto por fora (margem negativa). A caixa que recebe o toque fica maior; a
 * caixa que ocupa espaço no layout continua exatamente do mesmo tamanho, e o
 * ícone não anda um pixel. Vale nas duas plataformas, e por isso substitui o
 * `hitSlop` em vez de conviver com ele.
 *
 * <p><b>Cuidado com vizinhos.</b> Dois ícones lado a lado crescem um na
 * direção do outro: a folga entre eles tem de ser pelo menos o dobro do que
 * cada um cresce, senão um passa a comer o toque do outro. Quando não houver
 * espaço, é melhor afastar os dois do que fingir que cabe.
 */
export function touchArea(visualSize: number, min: number = TOUCH_MIN) {
  const folga = Math.max(0, Math.ceil((min - visualSize) / 2));
  return folga === 0 ? {} : { padding: folga, margin: -folga };
}

/**
 * A mesma ideia, só na vertical: para link de texto, que já é largo o
 * bastante e peca só na altura ("Ver o extrato inteiro" tinha 17 px).
 */
export function touchHeight(visualHeight: number, min: number = TOUCH_MIN) {
  const folga = Math.max(0, Math.ceil((min - visualHeight) / 2));
  return folga === 0
    ? {}
    : { paddingVertical: folga, marginVertical: -folga };
}

export const ds = {
  spacing,
  sheetPadding: SHEET_PADDING,
  sheetTitle: SHEET_TITLE,
  radius,
  shadow,
  typography,
  motion,
  touchMin: TOUCH_MIN,
  touchArea,
  touchHeight,
} as const;
