import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL, formatPercent } from "../utils/money";
import { formatMonthLabel } from "../utils/cycleWindow";
import type { CommitmentsPanel as Panel } from "../services/api";

/**
 * Parcelas e compromissos dos próximos meses, contra a renda.
 *
 * <p>O parcelado sem juros é perto de metade das compras no crédito no Brasil,
 * e quase ninguém acompanha as parcelas. O Banco Central promete para 2027 um
 * painel que avisa quando as dívidas passam de 40% da renda; este bloco faz a
 * mesma leitura com o que o app já mede. Toda a conta vem do servidor
 * (`/analytics/commitments`) — aqui só se mostra.
 *
 * <p><b>Mora na Análise</b>, logo depois de "Dívidas do período": aquela diz
 * quanto do mês que passou foi compromisso; esta diz quanto dos próximos já
 * está prometido. Não vai para Cartões porque financiamento e empréstimo não
 * são do cartão, e a soma é de tudo.
 */
export default function CommitmentsPanel({
  panel,
  onRegisterIncome,
}: {
  panel: Panel | null;
  onRegisterIncome: () => void;
}) {
  const t = useTheme();

  // Sem compromisso nenhum o bloco não aparece, pela mesma razão de
  // "Dívidas do período": R$ 0,00 em todos os meses não informa nada
  if (!panel || panel.months.every((m) => m.total <= 0)) return null;

  const semRenda = panel.income.amount == null;
  const limite = formatPercent(panel.thresholdPct, { decimals: 0 });
  const mesesAcima = panel.months.filter((m) => m.aboveThreshold).length;
  const maior = Math.max(...panel.months.map((m) => m.total), 1);

  return (
    <View style={{ marginHorizontal: spacing[5], marginBottom: spacing[5] }}>
      <Text
        accessibilityRole="header"
        numberOfLines={1}
        style={{
          color: t.text.tertiary,
          fontSize: 11,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: spacing[2],
        }}
      >
        Parcelas e compromissos
      </Text>

      <View
        style={{
          backgroundColor: t.background.surface,
          borderWidth: 1,
          borderColor: t.border.subtle,
          borderRadius: radius.xl,
          padding: spacing[4],
        }}
      >
        {panel.aboveThreshold && (
          <View
            accessibilityRole="alert"
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              borderRadius: radius.lg,
              padding: spacing[3],
              marginBottom: spacing[3],
              backgroundColor: t.semantic.dangerMuted,
            }}
          >
            <TriangleAlert size={16} color={t.semantic.danger} />
            <View style={{ flex: 1, marginLeft: spacing[2] }}>
              <Text
                style={{ color: t.semantic.danger, fontSize: 13, fontWeight: "700" }}
              >
                {`Passa de ${limite} da renda em ${mesesAcima} ${
                  mesesAcima === 1 ? "mês" : "meses"
                }`}
              </Text>
              <Text
                style={{ color: t.text.secondary, fontSize: 11, marginTop: spacing[1] }}
              >
                {`${limite} é uma referência, não uma regra.`}
              </Text>
            </View>
          </View>
        )}

        {semRenda && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: spacing[3],
            }}
          >
            <Text
              style={{ flex: 1, color: t.text.secondary, fontSize: 12, lineHeight: 18 }}
            >
              Sem renda cadastrada, não dá para dizer quanto isso pesa.
            </Text>
            <TouchableOpacity
              onPress={onRegisterIncome}
              accessibilityRole="button"
              accessibilityLabel="Cadastrar renda"
              activeOpacity={0.7}
              style={{ minHeight: 36, justifyContent: "center", marginLeft: spacing[2] }}
            >
              <Text style={{ color: t.accent.neon, fontSize: 12, fontWeight: "700" }}>
                Cadastrar renda
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={{ gap: spacing[3] }}>
          {panel.months.map((mes) => {
            const cor = mes.aboveThreshold ? t.semantic.danger : t.accent.neon;
            const rotulo = `${formatMonthLabel(mes.month)}${mes.partial ? " · restante" : ""}`;
            return (
              <View
                key={mes.month}
                accessible
                accessibilityLabel={`${rotulo}: ${formatBRL(mes.total)}${
                  mes.shareOfIncome != null
                    ? `, ${formatPercent(mes.shareOfIncome, { decimals: 0 })} da renda`
                    : ""
                }`}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text
                    numberOfLines={1}
                    style={{ flex: 1, color: t.text.primary, fontSize: 13, fontWeight: "600" }}
                  >
                    {rotulo}
                  </Text>
                  <Text
                    style={{
                      color: t.text.primary,
                      fontSize: 13,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatBRL(mes.total)}
                  </Text>
                  {mes.shareOfIncome != null && (
                    <Text
                      style={{
                        width: 48,
                        textAlign: "right",
                        color: mes.aboveThreshold ? t.semantic.danger : t.text.tertiary,
                        fontSize: 12,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {formatPercent(mes.shareOfIncome, { decimals: 0 })}
                    </Text>
                  )}
                </View>
                {/* A barra compara os meses entre si: o mais pesado salta aos
                    olhos sem ler os valores */}
                <View
                  style={{
                    height: 6,
                    borderRadius: radius.full,
                    backgroundColor: t.border.subtle,
                    overflow: "hidden",
                    marginTop: spacing[1],
                  }}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View
                    style={{
                      width: `${Math.round((mes.total / maior) * 100)}%`,
                      height: "100%",
                      backgroundColor: cor,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {!semRenda && (
          <Text
            numberOfLines={1}
            style={{ color: t.text.tertiary, fontSize: 11, marginTop: spacing[3] }}
          >
            {`Renda de ${formatBRL(panel.income.amount ?? 0)} · ${
              panel.income.origin === "MEASURED" ? "medida no extrato" : "cadastrada"
            }`}
          </Text>
        )}
      </View>
    </View>
  );
}
