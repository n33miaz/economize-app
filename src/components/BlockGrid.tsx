import React from "react";
import { View } from "react-native";

import { splitIntoColumns } from "../utils/layout";

/**
 * Peso relativo de altura por bloco, indexado pela `key` do elemento.
 *
 * É uma dica estática de quem monta a grade: a altura real só existe depois
 * do layout, e redistribuir a partir dela faria os blocos pularem de coluna
 * na frente do usuário. A escala é livre — só a proporção entre os blocos da
 * MESMA tela importa. Bloco sem entrada aqui pesa 1.
 */
export type BlockWeights = Record<string, number>;

interface BlockGridProps {
  /** Vem do `useBreakpoint().columns` — 1 no celular, 2 no miolo largo. */
  columns: number;
  /** Pesos por `key` de bloco; sem isto, todos pesam igual (rodízio puro). */
  weights?: BlockWeights;
  /**
   * Blocos já na ordem de PRIORIDADE. Entradas condicionais podem chegar como
   * `false`/`null`: elas são descartadas antes da distribuição, senão
   * ocupariam vaga de coluna sem desenhar nada.
   */
  children: React.ReactNode[];
}

/**
 * Grade de blocos de tela. Uma coluna no celular (nada muda), duas no
 * desktop — e é sempre o mesmo componente decidindo, para que Home e Análise
 * não desenvolvam duas ideias diferentes de "duas colunas".
 *
 * Os blocos trazem o próprio `px-5`: duas colunas encostadas formam 40 px de
 * gutter sozinhas, e um `gap` por cima disso desalinharia os cards das colunas
 * em relação aos blocos de largura cheia acima e abaixo da grade.
 */
export default function BlockGrid({
  columns,
  weights,
  children,
}: BlockGridProps) {
  const blocks = children.filter(Boolean) as React.ReactElement[];

  // Grade com menos blocos do que colunas é meia tela em branco: na Análise,
  // um mês sem receita categorizada (quem só importa cartão nunca tem) deixava
  // o ranking de gastos na esquerda e a metade direita vazia de cima a baixo.
  // Bloco sozinho é bloco de largura cheia — isso é decisão de produto, por
  // isso mora aqui e não na função pura que só sabe repartir listas.
  if (columns <= 1 || blocks.length < columns) return <>{blocks}</>;

  const weightOf = (block: React.ReactElement) => {
    const key = typeof block.key === "string" ? block.key : null;
    return (key && weights?.[key]) || 1;
  };

  return (
    // `flex-start`: colunas de alturas diferentes não devem esticar os cards
    // da mais curta para empatar com a mais longa
    <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
      {splitIntoColumns(blocks, columns, weightOf).map((bucket, index) => (
        // `testID` nomeado: é por ele que o teste sabe em QUAL coluna cada
        // bloco caiu — sem isso a asserção só provaria que os blocos existem
        <View key={`coluna-${index}`} testID={`coluna-${index}`} style={{ flex: 1 }}>
          {bucket}
        </View>
      ))}
    </View>
  );
}
