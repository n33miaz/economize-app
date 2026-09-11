import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import CircleSlash from "lucide-react-native/dist/esm/icons/circle-slash";
import Repeat from "lucide-react-native/dist/esm/icons/repeat";

import Card from "./Card";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL } from "../utils/money";
import type { Subscription, SubscriptionReport } from "../services/api";

interface Props {
  report: SubscriptionReport | null;
  /** Abre a série para editar ou descartar. */
  onOpen: (subscription: Subscription) => void;
}

/**
 * O que você paga todo mês, e quanto isso é por ano — EC-203.
 *
 * <p><b>O número grande é o ANUAL, e essa é a decisão inteira.</b> Ninguém
 * cancela uma assinatura de R$ 23,90; muita gente cancela uma de R$ 286,80 por
 * ano. É o mesmo dinheiro, e o que muda é a unidade em que a decisão é tomada.
 * O concorrente lista assinaturas com o valor mensal — a lista é bonita e não
 * faz ninguém agir.
 *
 * <p><b>O denominador aparece de propósito.</b> "Olhei 24 séries" diz que o
 * filtro trabalhou, e é o que separa uma lista curta de uma lista vazia por
 * defeito. Medido contra o extrato real do dono, a regra ingênua achava 24
 * candidatas das quais duas eram assinatura — as outras eram aplicação de CDB,
 * saque redondo, Pix para pessoas e passagem de ônibus.
 *
 * <p>Quem recusa as 22 é o servidor. Aqui só se desenha o que sobrou, e a
 * ordem é a da decisão: da mais cara por ano para a mais barata.
 */
export default function SubscriptionsCard({ report, onOpen }: Props) {
  const t = useTheme();

  // Enquanto a busca não voltou não há nada honesto a dizer: um card zerado
  // afirmaria "você não tem assinaturas", que é diferente de "ainda não sei"
  if (!report) return null;

  const vazio = report.details.length === 0;

  return (
    <Card style={{ marginTop: spacing[4] }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Repeat size={14} color={t.text.tertiary} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing[2],
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          Assinaturas
        </Text>
      </View>

      {vazio ? (
        // "Olhei e não achei" é resposta; silêncio não é. Sem o denominador o
        // usuário não sabe se o caçador trabalhou ou se a tela quebrou
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            marginTop: spacing[3],
          }}
        >
          {report.seriesExamined === 0
            ? "Ainda não há séries suficientes para reconhecer uma assinatura."
            : `Olhei ${report.seriesExamined} ${
                report.seriesExamined === 1 ? "série" : "séries"
              } e nenhuma tem cara de assinatura.`}
        </Text>
      ) : (
        <>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`${formatBRL(report.yearlyTotal)} por ano em ${
              report.subscriptions
            } ${report.subscriptions === 1 ? "assinatura" : "assinaturas"}`}
            style={{
              color: t.text.primary,
              fontSize: 28,
              lineHeight: 36,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              marginTop: spacing[1],
            }}
          >
            {formatBRL(report.yearlyTotal)}
            <Text style={{ color: t.text.tertiary, fontSize: 14 }}> por ano</Text>
          </Text>

          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              marginTop: spacing[1],
            }}
          >
            {report.subscriptions}{" "}
            {report.subscriptions === 1 ? "assinatura" : "assinaturas"} ·{" "}
            {formatBRL(report.yearlyTotal / 12)} por mês
          </Text>

          <View style={{ marginTop: spacing[4] }}>
            {report.details.map((assinatura, indice) => (
              <SubscriptionRow
                key={assinatura.seriesId}
                subscription={assinatura}
                first={indice === 0}
                onPress={() => onOpen(assinatura)}
              />
            ))}
          </View>

          {report.silentCount > 0 ? (
            // Parada há mais de 45 dias é pergunta, não conclusão: ou foi
            // cancelada e o app não sabe, ou volta a cobrar de surpresa
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                marginTop: spacing[3],
              }}
            >
              {report.silentCount === 1
                ? "1 delas não cobra há mais de 45 dias."
                : `${report.silentCount} delas não cobram há mais de 45 dias.`}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

function SubscriptionRow({
  subscription,
  first,
  onPress,
}: {
  subscription: Subscription;
  first: boolean;
  onPress: () => void;
}) {
  const t = useTheme();

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={
        `${subscription.name}: ${formatBRL(subscription.monthlyAmount)} por mês, ` +
        `${formatBRL(subscription.yearlyAmount)} por ano` +
        (subscription.silent ? ", parada há mais de 45 dias" : "") +
        ". Abrir a série"
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing[3],
        borderTopWidth: first ? 0 : 1,
        borderTopColor: t.border.subtle,
      }}
    >
      <View style={{ flex: 1, paddingRight: spacing[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text
            numberOfLines={1}
            style={{
              flexShrink: 1,
              color: t.text.primary,
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {subscription.name}
          </Text>
          {subscription.silent ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginLeft: spacing[2],
                paddingHorizontal: spacing[2],
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: t.semantic.warningMuted,
              }}
            >
              <CircleSlash size={10} color={t.semantic.warning} />
              <Text
                style={{
                  marginLeft: 4,
                  color: t.semantic.warning,
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                parada
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          numberOfLines={1}
          style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}
        >
          {subscription.category ?? "Sem categoria"} ·{" "}
          {subscription.occurrences}{" "}
          {subscription.occurrences === 1 ? "cobrança" : "cobranças"}
        </Text>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        <Text
          style={{
            color: t.text.primary,
            fontSize: 14,
            fontWeight: "700",
            fontVariant: ["tabular-nums"],
          }}
        >
          {formatBRL(subscription.yearlyAmount)}
        </Text>
        <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
          {formatBRL(subscription.monthlyAmount)}/mês
        </Text>
      </View>
      <ChevronRight size={16} color={t.text.tertiary} />
    </TouchableOpacity>
  );
}
