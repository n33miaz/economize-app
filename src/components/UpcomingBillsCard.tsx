import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import CalendarClock from "lucide-react-native/dist/esm/icons/calendar-clock";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL, formatBRLCompact } from "../utils/money";
import {
  URGENT_DAYS,
  duePillLabel,
  type UpcomingItem,
  type UpcomingOverview,
} from "../utils/upcoming";

/**
 * O que vence antes de o mês fechar.
 *
 * <p><b>O que este card substitui.</b> Antes a Home mostrava um total
 * ("R$ 1.234 a vencer em 30 dias") e o NOME da próxima conta. Dava para saber
 * que havia algo vindo, não o que era nem quando — e o pedido do dono foi
 * explícito: <i>"saber as coisas/contas que eu tenho que pagar no futuro (se
 * tiver alguma muito em breve dar mais destaque nela)"</i>. Total sem lista não
 * dá destaque a nada; é um número que o olho lê e esquece.
 *
 * <p><b>O destaque é por DATA, não por valor.</b> O que aperta em conta de
 * pessoa física é o vencimento, não o tamanho: uma fatura de R$ 80 que vence
 * hoje decide mais do que uma de R$ 800 que vence em três semanas. Por isso a
 * pílula de data é o elemento colorido da linha, e só ela — dentro de
 * {@link URGENT_DAYS} dias ela veste o tom de perigo.
 *
 * <p><b>"A confirmar" é uma resposta.</b> Conta de luz sem histórico não tem
 * valor estimado. A linha aparece de todo jeito, com o valor em branco e fora
 * do total: esconder a conta porque não se sabe o valor é justamente perder o
 * aviso de que ela vem.
 *
 * <p>As parcelas entram como linha de rodapé e <b>fora do total</b>: elas já
 * estão dentro da fatura que a linha do cartão cobra. Somá-las de novo contaria
 * o mesmo dinheiro duas vezes — o erro que a Home cometia no saldo e que o
 * `cashPosition` veio consertar.
 */
export default function UpcomingBillsCard({
  overview,
  showValues,
  riskLabel,
  salaryLine,
  onPressItem,
  onPressAll,
}: {
  overview: UpcomingOverview;
  /** Respeita o olhinho da Home: valor escondido também não é falado. */
  showValues: boolean;
  /** "out 2026" quando a projeção prevê o período no vermelho. */
  riskLabel?: string | null;
  /** "Seu salário cai em 5 dias", quando o app sabe. */
  salaryLine?: string | null;
  onPressItem: (item: UpcomingItem) => void;
  onPressAll: () => void;
}) {
  const t = useTheme();

  // No máximo quatro linhas: o card é um aviso, não a tela de recorrências.
  // O que sobra vira "Ver os N restantes", que é o caminho para a lista inteira
  const TETO_DE_LINHAS = 4;
  const visiveis = [...overview.soon, ...overview.later].slice(0, TETO_DE_LINHAS);
  const restantes = overview.count - visiveis.length;

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
        accessibilityLabel={`${
          showValues ? formatBRL(overview.total) : "valor oculto"
        } a pagar em ${overview.count} ${
          overview.count === 1 ? "conta" : "contas"
        } nos próximos 30 dias. Abrir recorrências`}
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
          <CalendarClock size={18} color={t.accent.neon} />
        </View>
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
            A pagar em 30 dias
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
            {showValues ? formatBRLCompact(overview.total) : "•••••"}
          </Text>
        </View>
        <ChevronRight size={18} color={t.text.tertiary} />
      </TouchableOpacity>

      <View style={{ marginTop: spacing[3] }}>
        {visiveis.map((item) => {
          const urgente = item.daysUntil <= URGENT_DAYS;
          return (
            <TouchableOpacity
              key={item.key}
              onPress={() => onPressItem(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}. ${item.detail}. ${
                item.amount == null
                  ? "valor a confirmar"
                  : showValues
                    ? formatBRL(item.amount)
                    : "valor oculto"
              }`}
              activeOpacity={0.7}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 44,
                gap: spacing[3],
              }}
            >
              {/* A pílula de data é o único elemento colorido da linha: é ela
                  que responde "isto aperta agora?" */}
              <View
                style={{
                  minWidth: 52,
                  paddingHorizontal: spacing[2],
                  paddingVertical: 3,
                  borderRadius: radius.full,
                  alignItems: "center",
                  backgroundColor: urgente
                    ? t.semantic.dangerMuted
                    : t.background.elevated,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    color: urgente ? t.semantic.danger : t.text.tertiary,
                    fontSize: 11,
                    fontWeight: "700",
                  }}
                >
                  {duePillLabel(item)}
                </Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: t.text.primary,
                    fontSize: 13,
                    fontWeight: "600",
                  }}
                >
                  {item.name}
                </Text>
              </View>

              <Text
                numberOfLines={1}
                style={{
                  color: item.amount == null ? t.text.tertiary : t.text.secondary,
                  fontSize: 13,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  fontStyle: item.amount == null ? "italic" : "normal",
                }}
              >
                {item.amount == null
                  ? "a confirmar"
                  : showValues
                    ? formatBRLCompact(item.amount)
                    : "•••"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {restantes > 0 && (
        <TouchableOpacity
          onPress={onPressAll}
          accessibilityRole="button"
          accessibilityLabel={`Ver as outras ${restantes} contas`}
          activeOpacity={0.7}
          style={{ minHeight: 36, justifyContent: "center" }}
        >
          <Text
            style={{ color: t.accent.neon, fontSize: 12, fontWeight: "700" }}
          >
            {`Ver as outras ${restantes} ${restantes === 1 ? "conta" : "contas"}`}
          </Text>
        </TouchableOpacity>
      )}

      {overview.installments && (
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: spacing[2],
          }}
        >
          {`+ ${formatBRLCompact(overview.installments.amount)} em ${
            overview.installments.count
          } ${
            overview.installments.count === 1 ? "parcela" : "parcelas"
          } já dentro da fatura`}
        </Text>
      )}

      {overview.unpricedCount > 0 && (
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: spacing[1],
          }}
        >
          {overview.unpricedCount === 1
            ? "1 conta ainda sem valor estimado — ela não entra no total."
            : `${overview.unpricedCount} contas ainda sem valor estimado — elas não entram no total.`}
        </Text>
      )}

      {salaryLine ? (
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 12,
            marginTop: spacing[2],
          }}
        >
          {salaryLine}
        </Text>
      ) : null}

      {riskLabel ? (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing[2],
            paddingHorizontal: spacing[3],
            paddingVertical: spacing[2],
            borderRadius: radius.lg,
            backgroundColor: t.semantic.dangerMuted,
          }}
        >
          <TriangleAlert size={14} color={t.semantic.danger} />
          <Text
            numberOfLines={2}
            style={{
              flex: 1,
              marginLeft: spacing[2],
              color: t.semantic.danger,
              fontSize: 12,
              fontWeight: "700",
            }}
          >
            {`Saldo previsto negativo em ${riskLabel}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
