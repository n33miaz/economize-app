import React, { useEffect, useMemo, useRef } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Info from "lucide-react-native/dist/esm/icons/info";
import ShoppingBasket from "lucide-react-native/dist/esm/icons/shopping-basket";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";

import type { IncomePattern, IncomeSourcePattern } from "../services/api";
import { usePreferencesStore } from "../store/preferencesStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import {
  describeWeekdayDate,
  formatDayMonth,
  formatWeekdayDayMonth,
} from "../utils/cycleWindow";
import {
  adviceChanged,
  basisFooter,
  describeChange,
  formatRange,
  fundingNoun,
  fundingSourceOf,
  insufficientHistoryText,
  patternOriginLabel,
} from "../utils/purchaseDay";
import Badge from "./Badge";
import PotEmptyState from "./PotEmptyState";

interface Props {
  pattern: IncomePattern;
  /** "Ajustar como você compra" — abre a folha de preferência. */
  onAdjust: () => void;
  /** Sem renda cadastrada, o único caminho é cadastrar. */
  onRegisterIncome: () => void;
}

/**
 * O melhor dia para as compras (EC-237).
 *
 * <p><b>O que ele responde.</b> A pergunta do dono antes de ir ao mercado:
 * "compro agora ou espero o dinheiro cair?". O servidor olha as datas reais
 * das quedas, descobre em que dia útil cada renda costuma entrar e recomenda
 * o primeiro dia em que o dinheiro JÁ está na conta — nunca o dia em que ele
 * "deve" cair, porque comprar na mediana com o dinheiro caindo no extremo é
 * a regra que dá saldo negativo.
 *
 * <p><b>Por que a faixa e o rodapé são obrigatórios.</b> Três meses de vale
 * já mostraram dispersão de dois a três dias úteis. Uma data sozinha, em
 * corpo grande, pareceria precisão que o histórico não sustenta; a faixa
 * ("entre 25 e 29/09") e "3 meses observados · confiança média" são o que
 * impede a tela de prometer mais do que sabe.
 *
 * <p><b>Prestação de contas (EC-202).</b> O card guarda o que sugeriu da
 * última vez. Quando a data muda porque uma queda nova entrou, ele diz isso
 * com todas as letras em vez de trocar o número em silêncio — mudança
 * silenciosa em número que a pessoa vai usar para decidir lê como bug.
 */
export default function PurchaseDayCard({
  pattern,
  onAdjust,
  onRegisterIncome,
}: Props) {
  const t = useTheme();
  const previous = usePreferencesStore((s) => s.lastPurchaseAdvice);
  const setLastPurchaseAdvice = usePreferencesStore(
    (s) => s.setLastPurchaseAdvice,
  );
  const advice = pattern.status === "READY" ? pattern.advice : null;

  // A comparação usa o que estava guardado NA MONTAGEM: assim que a nova
  // recomendação é gravada, `previous` vira ela mesma e o aviso sumiria no
  // render seguinte, antes de ser lido
  const previousAtMount = useRef(previous);
  const mudanca = useMemo(
    () => adviceChanged(previousAtMount.current, advice),
    [advice],
  );

  useEffect(() => {
    if (!advice) return;
    const lastOccurrence = advice.basis?.lastOccurrence ?? null;
    if (
      previous &&
      previous.bestDay === advice.bestDay &&
      previous.basisLastOccurrence === lastOccurrence
    ) {
      return;
    }
    setLastPurchaseAdvice({
      bestDay: advice.bestDay,
      basisLastOccurrence: lastOccurrence,
      seenAt: new Date().toISOString(),
    });
  }, [advice, previous, setLastPurchaseAdvice]);

  const fonte = useMemo(() => fundingSourceOf(pattern), [pattern]);

  const container = {
    backgroundColor: t.background.surface,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: t.border.subtle,
    padding: spacing[5],
  } as const;

  const titulo = (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <ShoppingBasket size={16} color={t.text.tertiary} />
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
        Melhor dia para as compras
      </Text>
    </View>
  );

  const botaoAjustar = (
    <TouchableOpacity
      onPress={onAdjust}
      accessibilityRole="button"
      accessibilityLabel="Ajustar como você compra"
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 44,
        borderTopWidth: 1,
        borderTopColor: t.border.subtle,
        marginTop: spacing[3],
        paddingTop: spacing[2],
      }}
    >
      <Text
        style={{
          flex: 1,
          color: t.accent.neon,
          fontSize: 13,
          fontWeight: "700",
        }}
      >
        Ajustar como você compra
      </Text>
      <ChevronRight size={16} color={t.accent.neon} />
    </TouchableOpacity>
  );

  if (pattern.status === "NO_INCOME") {
    return (
      <View style={container} testID="purchase-day-card">
        {titulo}
        <View style={{ marginTop: spacing[2] }}>
          <PotEmptyState
            compact
            mood="comecar"
            title="Ainda não sei quando seu dinheiro cai"
            body={
              pattern.message ??
              "Cadastre o salário e o vale com o dia de pagamento: é daí que sai o melhor dia para ir ao mercado."
            }
            actionLabel="Cadastrar renda"
            onAction={onRegisterIncome}
          />
        </View>
      </View>
    );
  }

  if (pattern.status === "INSUFFICIENT_HISTORY") {
    const observados = pattern.sources.filter(
      (s) => s.pattern?.monthsObserved,
    );
    const meses = Math.max(
      0,
      ...observados.map((s) => s.pattern?.monthsObserved ?? 0),
    );
    return (
      <View
        style={container}
        testID="purchase-day-card"
        accessible
        accessibilityLabel={`Melhor dia para as compras: ainda sem padrão. ${insufficientHistoryText(pattern)}`}
      >
        {titulo}
        <Text
          style={{
            ...typography.heading3,
            color: t.text.primary,
            marginTop: spacing[3],
          }}
        >
          Ainda não dá para dizer
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 19,
            marginTop: spacing[1],
          }}
        >
          {insufficientHistoryText(pattern)}
        </Text>
        {pattern.sources
          .filter((s) => s.upcoming.length > 0)
          .map((s) => (
            <LandingLine key={s.incomeSourceId ?? s.seriesId ?? s.name} source={s} />
          ))}
        {meses > 0 ? (
          <Text
            style={{ color: t.text.tertiary, fontSize: 11, marginTop: spacing[3] }}
          >
            {basisFooter(meses, null)}
          </Text>
        ) : null}
      </View>
    );
  }

  if (pattern.status === "CARD_CYCLE_UNKNOWN" || !advice) {
    return (
      <View
        style={container}
        testID="purchase-day-card"
        accessible
        accessibilityLabel={`Melhor dia para as compras: ${
          pattern.message ?? "não sei quando seu cartão fecha"
        }`}
      >
        {titulo}
        <Text
          style={{
            ...typography.heading3,
            color: t.text.primary,
            marginTop: spacing[3],
          }}
        >
          Não sei quando seu cartão fecha
        </Text>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 19,
            marginTop: spacing[1],
          }}
        >
          {pattern.message ??
            "Conecte o banco ou informe o dia de fechamento para eu dizer a partir de quando a compra cai na fatura seguinte."}
        </Text>
        {botaoAjustar}
      </View>
    );
  }

  const origem = patternOriginLabel(fonte?.origin ?? "MEASURED");
  const queda = fonte?.upcoming[0];
  const faixa = queda ? formatRange(queda.earliest, queda.latest) : null;
  const rodape = basisFooter(advice.basis?.monthsObserved, advice.confidence);
  const proximas =
    advice.cadence === "WEEKLY" ? advice.nextDates.slice(0, 4) : [];
  const falado = [
    `Melhor dia para as compras: ${describeWeekdayDate(advice.bestDay)}, ${origem.spoken}`,
    faixa ? `o ${fundingNoun(fonte?.kind)} cai ${faixa}` : null,
    ...advice.explanation.lines,
    rodape,
  ]
    .filter(Boolean)
    .join(". ");

  return (
    <View style={container} testID="purchase-day-card">
      <View accessible accessibilityLabel={falado}>
        {titulo}

        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing[3],
          }}
        >
          <Text
            numberOfLines={1}
            style={{ ...typography.numericLg, color: t.text.primary }}
          >
            {formatWeekdayDayMonth(advice.bestDay)}
          </Text>
          {/* EC-206: medido e informado não podem ter a mesma cara — o
              segundo é intenção de quem cadastrou, ainda sem histórico */}
          <Badge
            label={origem.badge}
            variant={origem.kind === "declared" ? "warning" : "neutral"}
            accessibilityLabel={origem.spoken}
            style={{ marginLeft: spacing[3] }}
          />
        </View>

        {faixa ? (
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              lineHeight: 19,
              marginTop: spacing[1],
            }}
          >
            {`O ${fundingNoun(fonte?.kind)} cai ${faixa}`}
            {advice.mustLastUntil
              ? ` · a compra precisa durar até ${formatDayMonth(advice.mustLastUntil)}`
              : ""}
            {advice.daysToCover != null ? ` (${advice.daysToCover} dias)` : ""}
          </Text>
        ) : null}

        {advice.explanation.lines.length > 0 ? (
          <View style={{ marginTop: spacing[3], gap: spacing[1] }}>
            {advice.explanation.lines.map((linha, index) => (
              <View
                key={`${index}-${linha.slice(0, 16)}`}
                style={{ flexDirection: "row", alignItems: "flex-start" }}
              >
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 13,
                    lineHeight: 19,
                    width: spacing[3],
                  }}
                >
                  ·
                </Text>
                <Text
                  style={{
                    flex: 1,
                    color: t.text.secondary,
                    fontSize: 13,
                    lineHeight: 19,
                  }}
                >
                  {linha}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {proximas.length > 0 ? (
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 12,
              lineHeight: 17,
              marginTop: spacing[2],
            }}
          >
            {`Próximas: ${proximas.map(formatWeekdayDayMonth).join(" · ")}`}
          </Text>
        ) : null}

        {advice.card?.warning ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[3],
              padding: spacing[3],
              borderRadius: radius.lg,
              backgroundColor: t.semantic.warningMuted,
            }}
          >
            <TriangleAlert size={14} color={t.semantic.warning} />
            <Text
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: t.semantic.warning,
                fontSize: 12,
                lineHeight: 17,
                fontWeight: "700",
              }}
            >
              {advice.card.warning}
            </Text>
          </View>
        ) : null}

        {rodape ? (
          <Text
            style={{ color: t.text.tertiary, fontSize: 11, marginTop: spacing[3] }}
          >
            {rodape}
          </Text>
        ) : null}
      </View>

      {mudanca ? (
        <View
          accessible
          accessibilityLabel={describeChange(mudanca, fonte?.kind)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: spacing[3],
            padding: spacing[3],
            borderRadius: radius.lg,
            backgroundColor: t.semantic.infoMuted,
          }}
        >
          <Info size={14} color={t.semantic.info} />
          <Text
            style={{
              flex: 1,
              marginLeft: spacing[2],
              color: t.semantic.info,
              fontSize: 12,
              lineHeight: 17,
            }}
          >
            {describeChange(mudanca, fonte?.kind)}
          </Text>
        </View>
      ) : null}

      {botaoAjustar}
    </View>
  );
}

/** "Salário: por volta de 07/10 (entre 06 e 08/10) · informado". */
function LandingLine({ source }: { source: IncomeSourcePattern }) {
  const t = useTheme();
  const queda = source.upcoming[0];
  const origem = patternOriginLabel(source.origin);
  const faixa = formatRange(queda.earliest, queda.latest);
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginTop: spacing[2],
      }}
    >
      <Text
        numberOfLines={2}
        style={{
          flex: 1,
          color: t.text.secondary,
          fontSize: 12,
          lineHeight: 17,
        }}
      >
        {`${source.name}: por volta de ${formatDayMonth(queda.expected)}`}
        {faixa && !faixa.startsWith("em ") ? ` (${faixa})` : ""}
      </Text>
      <Badge
        label={origem.badge}
        variant={origem.kind === "declared" ? "warning" : "neutral"}
        accessibilityLabel={origem.spoken}
        style={{ marginLeft: spacing[2] }}
      />
    </View>
  );
}
