import React from "react";
import { View } from "react-native";

import { spacing } from "../theme/ds";

interface Props {
  /** Dois, três ou quatro. Cinco vira lista, e lista não é grade. */
  children: React.ReactNode;
}

/**
 * A grade de dois por dois — EC-222.
 *
 * <p><b>Por que dois por dois e não uma coluna.</b> Quatro números empilhados
 * em coluna ocupam uma tela inteira e forçam a rolagem antes da primeira
 * resposta. Lado a lado, os quatro cabem acima da dobra — e a comparação
 * entre eles vira um movimento de olho, não de dedo.
 *
 * <p><b>Por que não três colunas.</b> Num telefone de 360 pontos, três
 * colunas dão 100 pontos de largura útil por tile. "R$ 1.240,50" não cabe, e
 * o que não cabe vira reticências — que é o mesmo que não mostrar.
 *
 * <p>O número ímpar é previsto: o último tile ocupa a largura de um, e a
 * lacuna à direita é preferível a esticar um card sozinho, o que faria o
 * quinto elemento parecer mais importante que os outros quatro.
 */
export default function MetricGrid({ children }: Props) {
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: spacing[3],
      }}
    >
      {React.Children.toArray(children)
        .filter(Boolean)
        .map((filho, indice) => (
          <View
            // A chave é a posição porque a grade é estática por construção:
            // quem monta decide os tiles no render, e eles não se reordenam
            key={indice}
            // A largura vem de `flexBasis` com o gap descontado, e não de
            // `flex: 1`: com flex, um tile sozinho na última linha esticaria
            // até a borda e pareceria mais importante que os outros
            style={{ flexBasis: `${50}%`, flexGrow: 0, maxWidth: "48.5%" }}
          >
            {filho}
          </View>
        ))}
    </View>
  );
}
