import React from "react";
import { View, ViewStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/ds";
import { formatBRL } from "../utils/money";

/** Uma fatia da barra: quanto vale e de que cor é. */
export interface Slice {
  key: string;
  value: number;
  color: string;
  /** Nome, só para quem ouve — a barra não escreve nada. */
  label: string;
}

interface Props {
  slices: Slice[];
  height?: number;
  style?: ViewStyle;
}

/**
 * A proporção de um total, sem uma palavra escrita — EC-227.
 *
 * <p><b>Por que sem legenda.</b> Uma legenda com cinco linhas de "cor =
 * nome = valor" repete o que a lista logo abaixo já diz, ocupa mais espaço
 * que a própria barra, e obriga o olho a viajar entre a cor e o texto para
 * entender qualquer coisa. A barra existe para responder <i>uma</i> pergunta
 * — "está equilibrado?" — e essa resposta é a forma, não o número.
 *
 * <p>Quem quer o detalhe olha a lista. Quem usa leitor de tela recebe a
 * frase inteira, com nome, valor e percentual de cada fatia, porque para
 * quem não vê a forma o detalhe É a informação.
 *
 * <p><b>Fatia mínima visível.</b> Uma categoria com 0,3% do total viraria um
 * fio de meio pixel — invisível e, pior, indistinguível de "não existe". Ela
 * recebe 2% de largura. A barra passa a somar um pouco mais que 100%, e essa
 * é a troca certa: a barra é sobre proporção percebida, e a lista abaixo tem
 * o número exato.
 */
export default function ProportionBar({ slices, height = 6, style }: Props) {
  const t = useTheme();

  const total = slices.reduce((soma, fatia) => soma + Math.max(0, fatia.value), 0);
  if (total <= 0 || slices.length === 0) return null;

  const MINIMO = 0.02;
  const proporcoes = slices
    .filter((fatia) => fatia.value > 0)
    .map((fatia) => ({ ...fatia, share: Math.max(MINIMO, fatia.value / total) }));

  const falado = proporcoes
    .map(
      (fatia) =>
        `${fatia.label}, ${formatBRL(fatia.value)}, ` +
        `${Math.round((fatia.value / total) * 100)} por cento`,
    )
    .join("; ");

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Proporção do total: ${falado}`}
      style={[
        {
          flexDirection: "row",
          height,
          borderRadius: radius.full,
          overflow: "hidden",
          backgroundColor: t.background.elevated,
        },
        style,
      ]}
    >
      {proporcoes.map((fatia) => (
        <View
          key={fatia.key}
          style={{ flex: fatia.share, backgroundColor: fatia.color }}
        />
      ))}
    </View>
  );
}
