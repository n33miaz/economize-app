import React from "react";
import { Text, View } from "react-native";

import { radius, spacing } from "../theme/ds";

export interface ChartLegendItem {
  /** Nome da série, como aparece ao lado do disco colorido */
  label: string;
  /** Valor já formatado: a legenda não decide formato de número */
  value: string;
  /**
   * Mesmo valor por extenso, para quem ouve. Só é necessário quando `value`
   * chega abreviado ("R$ 1,2 mi"): sem ele, o leitor de tela passaria a
   * anunciar o resumo em vez do número, e o rótulo cheio que a legenda tinha
   * seria perdido em silêncio. Ausente, o falado é o mesmo do visto.
   */
  spokenValue?: string;
  /** Cor da série — sempre um token de t.chart.*, nunca hexa solto */
  color: string;
}

/**
 * Legenda das séries de um gráfico. Vive num componente único porque o design
 * system exige legenda a partir de duas séries, e a biblioteca de gráficos não
 * traz uma: sem isto cada tela inventaria o próprio corpo de texto e recuo.
 *
 * Rótulo e valor ficam empilhados, e não na mesma linha, porque "R$ 18.129,68"
 * ao lado do nome não cabe na coluna estreita que sobra em janelas de 320px.
 */
export default function ChartLegend({ items }: { items: ChartLegendItem[] }) {
  return (
    <View className="flex-1 pl-3">
      {items.map((item) => (
        <View
          key={item.label}
          className="flex-row items-center py-1"
          // Nó acessível único por série: o leitor de tela anuncia
          // "Entradas: R$ 18.129,68" em vez de dois fragmentos soltos — e
          // sempre o número inteiro, mesmo quando o disco ao lado mostra
          // "R$ 18,1 mil" por falta de largura
          accessible
          accessibilityLabel={`${item.label}: ${item.spokenValue ?? item.value}`}
        >
          <View
            style={{
              width: 10,
              height: 10,
              borderRadius: radius.full,
              backgroundColor: item.color,
              marginRight: spacing[2],
            }}
          />
          <View className="flex-1">
            <Text className="text-textSecondary text-xs" numberOfLines={1}>
              {item.label}
            </Text>
            <Text
              className="text-textPrimary text-xs font-bold"
              numberOfLines={1}
            >
              {item.value}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}
