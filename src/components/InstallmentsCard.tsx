import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRLCompact } from "../utils/money";
import {
  describeInstallmentProgress,
  type InstallmentsSummary,
} from "../utils/installments";

/** Quantas séries o card mostra antes de mandar para a lista inteira. */
const TETO_DE_LINHAS = 3;

/**
 * Os parcelamentos em andamento, na Home.
 *
 * <p>Pedido direto do dono em 15/09/2026: <i>"quero ver meus parcelamentos na
 * tela inicial também"</i>. Eles existiam no app — a projeção por série está na
 * API desde o EC-217 —, mas na Home apareciam como <b>um número solto</b> num
 * tile dentro do bloco do calendário, sem toque e sem dizer de quê. E o tile
 * sumia junto com o bloco quando o mês não tinha dias com movimento.
 *
 * <p><b>O número que este card existe para entregar é o `monthlyLoad`</b>: a
 * soma das parcelas mensais das séries abertas. É a resposta para "por que a
 * minha fatura nunca baixa" — é quanto da próxima fatura já está travado antes
 * de qualquer compra nova. O total que ainda falta pagar vem depois, como
 * contexto, porque é o número que assusta e não o que ajuda a decidir.
 *
 * <p><b>A barra mostra pagas sobre o total</b>, e "pagas" é `total - remaining`
 * — nunca quantas o extrato mostra. O histórico importado pode começar no meio
 * da compra: uma série 5/10 vista a partir da quinta parcela tem quatro
 * pagamentos que aconteceram antes de o app existir, e eles contam.
 */
export default function InstallmentsCard({
  summary,
  showValues,
  onPressAll,
}: {
  summary: InstallmentsSummary;
  showValues: boolean;
  onPressAll: () => void;
}) {
  const t = useTheme();

  const visiveis = summary.open.slice(0, TETO_DE_LINHAS);
  const restantes = summary.count - visiveis.length;

  return (
    <View
      style={{
        backgroundColor: t.background.surface,
        borderWidth: 1,
        borderColor: t.border.subtle,
        borderRadius: radius["2xl"],
        padding: spacing[4],
      }}
    >
      <TouchableOpacity
        onPress={onPressAll}
        accessibilityRole="button"
        accessibilityLabel={`${summary.count} ${
          summary.count === 1 ? "parcelamento" : "parcelamentos"
        } em andamento, ${
          showValues ? formatBRLCompact(summary.monthlyLoad) : "valor oculto"
        } por mês. Ver no extrato`}
        activeOpacity={0.8}
        style={{ flexDirection: "row", alignItems: "center" }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.full,
            backgroundColor: t.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CreditCard size={18} color={t.accent.neon} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
            {`${summary.count} ${
              summary.count === 1 ? "parcelamento" : "parcelamentos"
            } em andamento`}
          </Text>
          <Text
            numberOfLines={1}
            style={{
              color: t.text.primary,
              fontSize: 16,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {showValues
              ? `${formatBRLCompact(summary.monthlyLoad)} por mês`
              : "•••••"}
          </Text>
        </View>
        <ChevronRight size={18} color={t.text.tertiary} />
      </TouchableOpacity>

      <View style={{ marginTop: spacing[3], gap: spacing[3] }}>
        {visiveis.map((item) => (
          <View key={item.key}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: t.text.primary,
                  fontSize: 13,
                  fontWeight: "600",
                  marginRight: spacing[2],
                }}
              >
                {item.description}
              </Text>
              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 12,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {showValues ? formatBRLCompact(item.installmentAmount) : "•••"}
              </Text>
            </View>

            {/* A barra é o progresso, não o valor: parcelamento é uma coisa que
                ACABA, e ver o fim chegando é o que o número sozinho não dá */}
            <View
              style={{
                height: 6,
                borderRadius: radius.full,
                backgroundColor: t.border.subtle,
                overflow: "hidden",
                marginTop: spacing[2],
              }}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <View
                style={{
                  width: `${Math.round(item.progress * 100)}%`,
                  height: "100%",
                  backgroundColor: t.accent.neon,
                }}
              />
            </View>

            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                marginTop: spacing[1],
              }}
            >
              {`${describeInstallmentProgress(item)} · falta${
                item.remaining === 1 ? "" : "m"
              } ${item.remaining}`}
            </Text>
          </View>
        ))}
      </View>

      {restantes > 0 && (
        <TouchableOpacity
          onPress={onPressAll}
          accessibilityRole="button"
          accessibilityLabel={`Ver os outros ${restantes} parcelamentos`}
          activeOpacity={0.7}
          style={{ minHeight: 36, justifyContent: "center", marginTop: spacing[1] }}
        >
          <Text
            style={{ color: t.accent.neon, fontSize: 12, fontWeight: "700" }}
          >
            {`Ver ${
              restantes === 1 ? "o outro" : `os outros ${restantes}`
            }`}
          </Text>
        </TouchableOpacity>
      )}

      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 11,
          lineHeight: 16,
          marginTop: spacing[2],
        }}
      >
        {showValues
          ? `${formatBRLCompact(summary.remainingTotal)} ainda a pagar no total`
          : "total a pagar oculto"}
      </Text>
    </View>
  );
}
