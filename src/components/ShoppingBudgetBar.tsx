import React from "react";
import { Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { budgetProgress, describeBudget } from "../utils/shopping";

interface Props {
  total: number;
  /** Sem orçamento a barra não desenha nada — um teto inventado seria mentira. */
  budget: number | null;
  /** Altura da trilha; a manchete usa a cheia, o card da lista a fina. */
  height?: number;
}

/**
 * O carrinho contra o orçamento da compra.
 *
 * <p>A cor é semântica e muda ANTES de estourar: até 85% é o accent normal,
 * dali ao teto vira atenção, e passou vira aviso. É a diferença entre "posso
 * pegar mais um" e "melhor devolver algo" — respondida sem ler número, no
 * corredor, de relance.
 */
export default function ShoppingBudgetBar({ total, budget, height = 8 }: Props) {
  const t = useTheme();
  const progresso = budgetProgress(total, budget);
  if (!progresso || budget == null) return null;

  const cor =
    progresso.tone === "over"
      ? t.semantic.danger
      : progresso.tone === "warning"
        ? t.semantic.warning
        : t.accent.neon;
  const preenchido = Math.min(1, Math.max(0, progresso.ratio));
  const frase = describeBudget(progresso, budget);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={frase}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(preenchido * 100) }}
      style={{ marginTop: spacing[3] }}
    >
      <View
        style={{
          height,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${preenchido * 100}%`,
            height: "100%",
            borderRadius: radius.full,
            backgroundColor: cor,
          }}
        />
      </View>
      <Text
        style={{
          color: progresso.tone === "ok" ? t.text.tertiary : cor,
          fontSize: 12,
          marginTop: spacing[1],
        }}
      >
        {frase}
      </Text>
    </View>
  );
}
