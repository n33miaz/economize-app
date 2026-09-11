import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL, formatBRLCompact } from "../utils/money";
import type { BudgetLine } from "../services/api";

interface Props {
  line: BudgetLine;
}

/**
 * O teto de uma categoria, desenhado — EC-204.
 *
 * <p><b>A barra tem DOIS marcadores</b>, e é isso que a distingue de qualquer
 * barra de progresso: o preenchimento é o que já se gastou, e o traço vertical
 * é onde o gasto <i>deveria</i> estar hoje. Uma barra em 20% no dia 3 e uma em
 * 20% no dia 28 contam histórias opostas, e sem o traço as duas são o mesmo
 * desenho.
 *
 * <p><b>Três estados, três cores.</b> Estourou é aviso; acima do ritmo é
 * atenção; dentro é o accent normal. Nada aqui pisca nem cresce — um teto é
 * informação, não alarme de incêndio, e o piso de materialidade já garantiu
 * que só chega aqui o que vale ser dito.
 */
export default function BudgetBar({ line }: Props) {
  const t = useTheme();

  const proporcao = line.windowLimit > 0 ? line.spent / line.windowLimit : 0;
  const preenchido = Math.min(1, Math.max(0, proporcao));
  const ritmo =
    line.windowLimit > 0
      ? Math.min(1, Math.max(0, line.expectedSoFar / line.windowLimit))
      : 0;

  const cor = line.exceeded
    ? t.semantic.danger
    : line.abovePace
      ? t.semantic.warning
      : t.accent.neon;

  const recado = line.exceeded
    ? `passou ${formatBRLCompact(line.overBy)}`
    : line.abovePace
      ? "acima do ritmo do período"
      : null;

  return (
    <View style={{ marginBottom: spacing[4] }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "baseline",
          marginBottom: spacing[1],
        }}
      >
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: t.text.primary, fontSize: 13, fontWeight: "700" }}
        >
          {line.categoryName ?? "Sem categoria"}
        </Text>
        <Text
          style={{ color: t.text.secondary, fontSize: 12 }}
          accessibilityLabel={
            `${line.categoryName ?? "Sem categoria"}: ${formatBRL(line.spent)} de ` +
            `${formatBRL(line.windowLimit)}` +
            (recado ? `, ${recado}` : ", dentro do teto")
          }
        >
          {formatBRLCompact(line.spent)}
          <Text style={{ color: t.text.tertiary }}>
            {" / "}
            {formatBRLCompact(line.windowLimit)}
          </Text>
        </Text>
      </View>

      <View
        style={{
          height: 8,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${preenchido * 100}%`,
            backgroundColor: cor,
            borderRadius: radius.full,
          }}
        />
        {/* Onde o gasto DEVERIA estar hoje. Sem este traço, 20% no dia 3 e
            20% no dia 28 são o mesmo desenho */}
        {ritmo > 0 && ritmo < 1 ? (
          <View
            style={{
              position: "absolute",
              left: `${ritmo * 100}%`,
              top: 0,
              bottom: 0,
              width: 2,
              backgroundColor: t.text.primary,
              opacity: 0.55,
            }}
          />
        ) : null}
      </View>

      {recado ? (
        <Text style={{ color: cor, fontSize: 11, marginTop: 2 }}>{recado}</Text>
      ) : null}
    </View>
  );
}
