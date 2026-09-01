import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { formatBRL, formatPercent } from "../utils/money";
import { debtKindLabel, debtKindMeaning, describeInstallment } from "../utils/debt";
import type { DebtOverview } from "../services/api";

/**
 * Quanto do período é dívida, e de que tipo (EC-139).
 *
 * <p>A parcela do financiamento e o mercado eram a mesma linha "despesa". São
 * coisas opostas: uma é consumo deste mês, a outra é compromisso assumido em
 * outro mês que ainda está cobrando. Sem separar, "por que não sobra nada?"
 * não tem resposta.
 */
export default function DebtBreakdown({ debt }: { debt: DebtOverview | null }) {
  const t = useTheme();
  const [aberto, setAberto] = useState<string | null>(null);

  // Sem dívida nenhuma o bloco não aparece: um card dizendo "R$ 0,00 em
  // dívidas" ocupa espaço para não informar nada
  if (!debt || debt.groups.length === 0) return null;

  return (
    <View className="mx-5 mb-5">
      <Text
        accessibilityRole="header"
        style={{
          color: t.text.tertiary,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: spacing[2],
        }}
      >
        Dívidas do período
      </Text>

      <View className="bg-cardBackground rounded-2xl p-4 border border-border">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-2xl font-bold text-textPrimary">
              {formatBRL(debt.totalDebt)}
            </Text>
            <Text className="text-xs text-textSecondary mt-0.5">
              de {formatBRL(debt.totalExpense)} que saíram
            </Text>
          </View>
          {debt.shareOfExpense != null && (
            <View
              className="px-2 py-1 rounded-lg"
              style={{ backgroundColor: t.background.elevated }}
            >
              <Text className="text-xs font-bold" style={{ color: t.text.secondary }}>
                {formatPercent(debt.shareOfExpense, { decimals: 1 })} do mês
              </Text>
            </View>
          )}
        </View>

        {/* O rotativo é a dívida mais cara do país: some no meio dos outros
            tipos se não tiver alarme próprio */}
        {debt.revolvingAlert && (
          <View
            className="flex-row items-center rounded-xl p-3 mt-3"
            style={{ backgroundColor: t.semantic.dangerMuted }}
          >
            <TriangleAlert size={16} color={t.semantic.danger} />
            <Text
              className="text-xs flex-1 ml-2 font-bold"
              style={{ color: t.semantic.danger }}
            >
              Há rotativo ou parcelamento de fatura aqui — é o juro mais caro
              que existe. Quitar isso vale mais que qualquer economia.
            </Text>
          </View>
        )}

        <View className="mt-4">
          {debt.groups.map((group) => {
            const expandido = aberto === group.kind;
            return (
              <View key={group.kind} className="mb-2">
                <Pressable
                  onPress={() => setAberto(expandido ? null : group.kind)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: expandido }}
                  accessibilityLabel={`${debtKindLabel(group.kind)}: ${formatBRL(
                    group.total,
                  )} em ${group.count} ${group.count === 1 ? "lançamento" : "lançamentos"}`}
                  className="flex-row items-center py-2"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-sm font-bold text-textPrimary">
                      {debtKindLabel(group.kind)}
                    </Text>
                    <Text className="text-[11px] text-textSecondary mt-0.5">
                      {debtKindMeaning(group.kind)}
                    </Text>
                  </View>
                  <Text
                    className="text-sm font-bold text-textPrimary mr-2"
                    style={{ fontVariant: ["tabular-nums"] }}
                  >
                    {formatBRL(group.total)}
                  </Text>
                  <View
                    style={{
                      transform: [{ rotate: expandido ? "180deg" : "0deg" }],
                    }}
                  >
                    <ChevronDown size={16} color={t.text.tertiary} />
                  </View>
                </Pressable>

                {expandido &&
                  group.items.map((item) => (
                    <View
                      key={item.transactionId}
                      className="flex-row items-center justify-between py-1.5 pl-3"
                    >
                      <View className="flex-1 pr-2">
                        <Text className="text-xs text-textPrimary" numberOfLines={1}>
                          {item.description}
                        </Text>
                        {describeInstallment(item) && (
                          <Text className="text-[11px] text-textSecondary mt-0.5">
                            {describeInstallment(item)}
                          </Text>
                        )}
                      </View>
                      <Text
                        className="text-xs text-textSecondary"
                        style={{ fontVariant: ["tabular-nums"] }}
                      >
                        {formatBRL(item.amount)}
                      </Text>
                    </View>
                  ))}

                {expandido && group.count > group.items.length && (
                  <Text className="text-[11px] text-textSecondary pl-3 pt-1">
                    e mais {group.count - group.items.length} lançamento
                    {group.count - group.items.length === 1 ? "" : "s"}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}
