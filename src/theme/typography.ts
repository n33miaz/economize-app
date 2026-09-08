import type { TextStyle } from "react-native";

/**
 * A ESCALA — e por que ela tem estes degraus e não outros.
 *
 * Medido no código em 08/09/2026: o app usava **19 tamanhos de fonte** enquanto
 * este arquivo declarava 11. Os oito de fora não eram todos iguais em peso:
 * `13` aparecia 92 vezes e `15` outras 39, espalhados por mais de vinte telas —
 * eles são degrau de verdade, e negar isso só tornava o arquivo uma ficção.
 * Já `9`, `17`, `30`, `32` e `34` eram uma ou oito ocorrências avulsas.
 *
 * Então a escala passou a dizer a verdade: os que carregam peso entraram, os
 * avulsos foram encostados no degrau vizinho. E `FONT_SIZES` abaixo existe para
 * o teste conseguir cobrar isso — sem ele, a vigésima medida entra no próximo
 * componente e ninguém percebe.
 *
 * <b>O que este arquivo NÃO resolve</b>: 12, 13, 14, 15 e 16 são cinco degraus
 * dentro de quatro pixels. Enxugar isso reflui texto em vinte telas e precisa
 * de olho na tela, um por um — continua aberto no EC-162.
 */
export const FONT_SIZES = [
  10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 36, 40,
] as const;

export type FontSize = (typeof FONT_SIZES)[number];

export const typography = {
  display: {
    fontFamily: "Roboto_700Bold",
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: 0,
  },
  heading1: {
    fontFamily: "Roboto_700Bold",
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: 0,
  },
  heading2: {
    fontFamily: "Roboto_700Bold",
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 0,
  },
  heading3: {
    fontFamily: "Roboto_700Bold",
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyLg: {
    fontFamily: "Roboto_400Regular",
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  body: {
    fontFamily: "Roboto_400Regular",
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  bodySm: {
    fontFamily: "Roboto_400Regular",
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: "Roboto_400Regular",
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0,
    textTransform: "uppercase" as const,
  },
  numericDisplay: {
    fontFamily: "Roboto_700Bold",
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
  numericLg: {
    fontFamily: "Roboto_700Bold",
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
  /**
   * Numérico de densidade dupla: para o valor que divide um card ao meio
   * (Entradas × Saídas). Esse slot é o mais estreito do app — no card de 390px
   * sobram ~140px por lado, e "R$ 99.999,99" mede 144px no corpo 24. Como o
   * `adjustsFontSizeToFit` é ignorado pelo react-native-web, lá o valor
   * simplesmente cortava; abreviar não resolvia porque o piso de abreviação é
   * 100 mil, exatamente acima do pior caso por extenso.
   */
  numericMd: {
    fontFamily: "Roboto_700Bold",
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
    fontVariant: ["tabular-nums"] as TextStyle["fontVariant"],
  },
} as const;
