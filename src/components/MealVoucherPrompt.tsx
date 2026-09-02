import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import Utensils from "lucide-react-native/dist/esm/icons/utensils";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL } from "../utils/money";
import { describeLanding } from "../utils/mealVoucher";
import { formatDueDate } from "../utils/wishes";
import type { MealVoucherAsk } from "../utils/mealVoucher";

/**
 * O pedido ativo de extrato na data provável do VR (EC-137).
 *
 * <p>Não é alerta, é pedido: o usuário não fez nada errado, o app é que não
 * tem como saber de uma compra feita no cartão do vale. Por isso o tom é de
 * convite e a cor é a da marca, não a de perigo.
 *
 * <p>Tem "Agora não" de propósito. Aviso sem saída fica na tela para sempre e
 * ensina a ignorar tudo o que se parece com ele.
 */
export default function MealVoucherPrompt({
  ask,
  onImport,
  onDismiss,
}: {
  ask: MealVoucherAsk | null;
  onImport: () => void;
  onDismiss: () => void;
}) {
  const t = useTheme();

  if (!ask) return null;

  return (
    <View
      style={{
        marginHorizontal: spacing[5],
        marginBottom: spacing[5],
        backgroundColor: t.background.elevated,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: t.border.subtle,
        borderLeftWidth: 3,
        borderLeftColor: t.accent.neon,
        padding: spacing[4],
      }}
      accessibilityRole="summary"
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Utensils size={16} color={t.accent.neon} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing[2],
            color: t.text.primary,
            fontSize: 14,
            fontWeight: "700",
          }}
        >
          {ask.sourceName} já caiu
        </Text>
      </View>

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 12,
          marginTop: spacing[2],
          fontVariant: ["tabular-nums"],
        }}
      >
        {describeLanding(ask.daysAgo)} ({formatDueDate(ask.landedOn)})
        {ask.amount != null ? ` · ${formatBRL(ask.amount)}` : ""}
      </Text>

      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: 19,
          marginTop: spacing[2],
        }}
      >
        Se você já usou, falta o extrato ou a nota da compra. Esse gasto
        pertence ao próximo ciclo, não a este.
      </Text>

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[3],
          marginTop: spacing[4],
        }}
      >
        <TouchableOpacity
          onPress={onImport}
          accessibilityRole="button"
          accessibilityLabel="Importar extrato"
          activeOpacity={0.85}
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: radius.lg,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
          }}
        >
          <Text
            style={{
              color: t.text.inverse,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            Importar extrato
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onDismiss}
          accessibilityRole="button"
          accessibilityLabel="Agora não"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={{ paddingHorizontal: spacing[2], minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ color: t.text.tertiary, fontSize: 13, fontWeight: "700" }}>
            Agora não
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
