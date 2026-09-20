import React from "react";
import { View, type ViewStyle } from "react-native";

import BrandGradient from "./BrandGradient";
import { useTheme } from "../theme/ThemeProvider";

/** Largura do desvanecimento. 24 é o que cobre meia letra de um chip. */
const LARGURA = 24;

interface Props {
  children: React.ReactNode;
  /**
   * Cor de onde o desvanecimento nasce. Padrão: o fundo da página. Passe
   * outra quando a fileira estiver sobre um card (`surface`) — um degradê que
   * termina na cor errada desenha uma barra visível em vez de desaparecer.
   */
  cor?: string;
  style?: ViewStyle;
}

/**
 * Desvanecimento nas duas pontas de uma fileira que rola na horizontal.
 *
 * <p>Escolha 10 do dono em 16/09/2026, na mesma linha dos chips: <i>"chips com
 * 8 px de respiro e desvanecimento nas pontas"</i>. O respiro de 8 já existia;
 * o desvanecimento é o que faltava.
 *
 * <p><b>Para que serve.</b> Uma fileira que rola e termina num corte seco
 * parece uma fileira que acabou. O chip cortado ao meio sob o degradê é o que
 * diz "tem mais para o lado" sem gastar uma seta nem uma barra de rolagem —
 * que no telefone não aparece de todo jeito.
 *
 * <p>Os dois degradês não recebem toque (`pointerEvents: "none"`): eles ficam
 * POR CIMA da fileira, e sem isso o primeiro e o último chip perderiam 24 px
 * de área de toque para um enfeite.
 */
export default function EdgeFade({ children, cor, style }: Props) {
  const t = useTheme();
  const solida = cor ?? t.background.base;
  // O mesmo tom com alfa zero. A palavra "transparent" interpola a partir de
  // rgba(0,0,0,0) e escurece a emenda no iOS — o mesmo cuidado que o
  // `Skeleton` documenta para a faixa dourada
  const invisivel = comAlfaZero(solida);

  return (
    <View style={[{ position: "relative" }, style]}>
      {children}
      <BrandGradient
        colors={[solida, invisivel]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: LARGURA,
          pointerEvents: "none",
        }}
      />
      <BrandGradient
        colors={[invisivel, solida]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: LARGURA,
          pointerEvents: "none",
        }}
      />
    </View>
  );
}

/**
 * A mesma cor com alfa zero, aceitando hexa (`#181713`) e `rgba(...)`.
 *
 * <p>Os tokens de fundo do tema são hexa, mas nada impede alguém passar um
 * `rgba` — e um degradê que termine numa cor diferente da do fundo desenha uma
 * barra visível em vez de desaparecer.
 */
export function comAlfaZero(cor: string): string {
  const hexa = /^#([0-9a-f]{6})$/i.exec(cor.trim());
  if (hexa) {
    const n = parseInt(hexa[1], 16);
    // eslint-disable-next-line no-bitwise
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, 0)`;
  }
  const rgb = /^rgba?\(([^)]+)\)$/i.exec(cor.trim());
  if (rgb) {
    const [r, g, b] = rgb[1].split(",").map((parte) => parte.trim());
    return `rgba(${r}, ${g}, ${b}, 0)`;
  }
  // Cor que não se sabe compor: melhor não desenhar degradê nenhum do que
  // desenhar uma barra preta em cima dos chips
  return cor;
}
