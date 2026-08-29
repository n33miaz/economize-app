import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CalendarClock from "lucide-react-native/dist/esm/icons/calendar-clock";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import CircleCheck from "lucide-react-native/dist/esm/icons/circle-check";
import Info from "lucide-react-native/dist/esm/icons/info";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "../utils/haptics";

import type { ForecastItem, ForecastMonth } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets } from "../theme/motionPresets";
import { useBankStore } from "../store/bankStore";
import {
  FORECAST_WINDOWS,
  type ForecastWindow,
  useRecurrenceStore,
} from "../store/recurrenceStore";
import ChartLegend from "../components/ChartLegend";
import ErrorState from "../components/ErrorState";
import { formatMonthLabel } from "../components/MonthSelector";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import SegmentedControl from "../components/SegmentedControl";
import Skeleton from "../components/Skeleton";
import { calculateBankMetrics } from "../utils/bankMetrics";
import { formatBRL, formatBRLCompact } from "../utils/money";
import {
  WEEKLY_PER_MONTH_LABEL,
  WEEKLY_PER_MONTH_SPOKEN,
  isMonthAtRisk,
  splitForecastMonth,
} from "../utils/recurrence";

const WINDOW_OPTIONS = FORECAST_WINDOWS.map((months) => ({
  label: months === 1 ? "1 mês" : `${months} meses`,
  value: String(months) as `${ForecastWindow}`,
}));

// Altura das colunas do comparativo da janela — alto o bastante para a
// diferença ser visível, baixo o bastante para caber acima da dobra
const BAR_MAX_HEIGHT = 96;

/** Uma linha da composição do mês: quando cai, o quê e quanto. */
function ForecastRow({ item, settled }: { item: ForecastItem; settled: boolean }) {
  const t = useTheme();
  const isIncome = item.flow === "INCOME";
  const color = settled
    ? t.text.tertiary
    : isIncome
      ? t.chart.up
      : t.chart.down;
  // Cadência semanal não tem dia único no mês (dueDay nulo) e o valor desta
  // linha já é a projeção mensal: 4,33 ocorrências. O selo assume a conta —
  // "semanal" ao lado de um valor 4,3× maior que a cobrança confundiria.
  const isWeekly = item.dueDay == null;
  const when = isWeekly ? WEEKLY_PER_MONTH_LABEL : `dia ${item.dueDay}`;
  const whenSpoken = isWeekly ? WEEKLY_PER_MONTH_SPOKEN : `dia ${item.dueDay}`;

  return (
    <View
      accessible
      accessibilityLabel={`${item.displayName}, ${whenSpoken}, ${
        isIncome ? "entrada" : "saída"
      } de ${formatBRL(item.amount)}${settled ? ", já liquidada neste mês" : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 36,
      }}
    >
      <View
        style={{
          minWidth: 62,
          paddingHorizontal: spacing[2],
          paddingVertical: 2,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {when}
        </Text>
      </View>
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          marginHorizontal: spacing[3],
          color: settled ? t.text.secondary : t.text.primary,
          fontSize: 13,
          fontWeight: "600",
        }}
      >
        {item.displayName}
      </Text>
      <Text
        style={{
          color,
          fontSize: 13,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {isIncome ? "+" : "−"}
        {formatBRLCompact(item.amount)}
      </Text>
    </View>
  );
}

/**
 * Um mês da projeção. O mês que fecha negativo veste o token de perigo (borda,
 * fundo e valor): é a única informação da tela que exige reação, e o accent —
 * cor da marca — nunca significa alta nem baixa.
 */
function ForecastMonthCard({
  month,
  index,
  expanded,
  onToggle,
}: {
  month: ForecastMonth;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const atRisk = isMonthAtRisk(month);
  const split = useMemo(() => splitForecastMonth(month), [month]);
  const label = formatMonthLabel(month.month);

  const total = month.expectedIncome + month.expectedExpense;
  const incomeShare = total > 0 ? (month.expectedIncome / total) * 100 : 0;

  const itemCount = month.items.length;

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{
        backgroundColor: atRisk ? t.semantic.dangerMuted : t.background.surface,
        borderRadius: radius["2xl"],
        borderWidth: atRisk ? 2 : 1,
        borderColor: atRisk ? t.semantic.danger : t.border.subtle,
        padding: spacing[5],
        marginBottom: spacing[3],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            flex: 1,
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        {atRisk && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[2],
              paddingVertical: 3,
              borderRadius: radius.full,
              backgroundColor: t.semantic.danger,
            }}
          >
            <TriangleAlert size={12} color={t.text.inverse} />
            <Text
              style={{
                color: t.text.inverse,
                fontSize: 11,
                fontWeight: "700",
                marginLeft: 4,
              }}
            >
              No vermelho
            </Text>
          </View>
        )}
      </View>

      <Text style={{ color: t.text.secondary, fontSize: 12, marginTop: spacing[2] }}>
        Saldo previsto no fim do mês
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`Saldo previsto no fim de ${label}: ${formatBRL(
          month.cumulativeNet,
        )}`}
        style={{
          ...typography.numericLg,
          color: atRisk ? t.semantic.danger : t.text.primary,
          marginTop: 2,
        }}
      >
        {formatBRLCompact(month.cumulativeNet)}
      </Text>

      {/* Proporção entrada × saída do mês: a barra dá a leitura de relance que
          dois números lado a lado não dão. Sem previsão no mês (tudo já
          liquidado), a trilha fica neutra — pintá-la 100% de saída afirmaria
          uma proporção que não existe */}
      <View
        style={{
          flexDirection: "row",
          height: 8,
          borderRadius: radius.full,
          overflow: "hidden",
          backgroundColor: t.border.subtle,
          marginTop: spacing[4],
        }}
      >
        {total > 0 && (
          <>
            <View
              style={{
                width: `${incomeShare}%`,
                backgroundColor: t.chart.up,
              }}
            />
            <View style={{ flex: 1, backgroundColor: t.chart.down }} />
          </>
        )}
      </View>

      <View
        style={{ flexDirection: "row", gap: spacing[4], marginTop: spacing[3] }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Entradas previstas
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Entradas previstas: ${formatBRL(month.expectedIncome)}`}
            style={{
              color: t.chart.up,
              fontSize: 15,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              marginTop: 2,
            }}
          >
            {formatBRLCompact(month.expectedIncome)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Saídas previstas
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Saídas previstas: ${formatBRL(month.expectedExpense)}`}
            style={{
              color: t.chart.down,
              fontSize: 15,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              marginTop: 2,
            }}
          >
            {formatBRLCompact(month.expectedExpense)}
          </Text>
        </View>
      </View>

      {itemCount > 0 && (
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${
            expanded ? "Ocultar" : "Ver"
          } os ${itemCount} lançamentos previstos de ${label}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 44,
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
            marginTop: spacing[3],
            paddingTop: spacing[3],
          }}
        >
          <Text
            style={{ flex: 1, color: t.text.secondary, fontSize: 13, fontWeight: "700" }}
          >
            {expanded
              ? "Ocultar o que compõe o mês"
              : `Ver o que compõe o mês (${itemCount})`}
          </Text>
          <ChevronDown
            size={16}
            color={t.text.secondary}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={{ marginTop: spacing[2], gap: spacing[1] }}>
          {split.pendingItems.map((item) => (
            <ForecastRow key={item.seriesId} item={item} settled={false} />
          ))}

          {split.settledItems.length > 0 && (
            <View style={{ marginTop: spacing[3] }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: spacing[1],
                }}
              >
                <CircleCheck size={13} color={t.semantic.success} />
                <Text
                  style={{
                    color: t.semantic.success,
                    fontSize: 11,
                    fontWeight: "700",
                    marginLeft: 4,
                  }}
                >
                  Já aconteceu — fora da soma acima
                </Text>
              </View>
              {split.settledItems.map((item) => (
                <ForecastRow key={item.seriesId} item={item} settled />
              ))}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function ForecastSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
      <Skeleton width="100%" height={48} borderRadius={radius.full} />
      <View style={{ height: spacing[4] }} />
      <Skeleton width="100%" height={150} borderRadius={radius["2xl"]} />
      <View style={{ height: spacing[4] }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginBottom: spacing[3] }}>
          <Skeleton width="100%" height={190} borderRadius={radius["2xl"]} />
        </View>
      ))}
    </View>
  );
}

/**
 * Perspectiva de saldo: para onde o saldo vai se as recorrências se
 * confirmarem. O ponto de partida vem do extrato importado — o servidor não
 * tem saldo consolidado e projetar a partir do zero seria inventar número.
 */
export default function BalanceForecast() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { cardEntering } = useMotionPresets();

  const transactions = useBankStore((s) => s.transactions);
  const fetchTransactions = useBankStore((s) => s.fetchTransactions);

  const forecast = useRecurrenceStore((s) => s.forecast);
  const isForecastLoading = useRecurrenceStore((s) => s.isForecastLoading);
  const hasLoadedForecastOnce = useRecurrenceStore(
    (s) => s.hasLoadedForecastOnce,
  );
  const forecastError = useRecurrenceStore((s) => s.forecastError);
  const fetchForecast = useRecurrenceStore((s) => s.fetchForecast);

  const [window, setWindow] = useState<ForecastWindow>(3);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [baselineReady, setBaselineReady] = useState(transactions.length > 0);
  const bankAttempted = useRef(false);

  // O saldo base é o líquido do extrato já importado: é o único saldo que o
  // app conhece, e mandá-lo é o que faz o acumulado significar alguma coisa
  const startingBalance = useMemo(
    () => calculateBankMetrics(transactions).total,
    [transactions],
  );

  useEffect(() => {
    if (transactions.length > 0) {
      setBaselineReady(true);
      return;
    }
    // uma tentativa só: sem extrato importado o baseline é zero mesmo, e
    // repetir a busca a cada render seria um laço de rede
    if (bankAttempted.current) return;
    bankAttempted.current = true;
    fetchTransactions().finally(() => setBaselineReady(true));
  }, [transactions.length, fetchTransactions]);

  useEffect(() => {
    if (!baselineReady) return;
    fetchForecast(window, startingBalance);
  }, [baselineReady, window, startingBalance, fetchForecast]);

  const handleWindowChange = useCallback((next: string) => {
    setWindow(Number(next) as ForecastWindow);
    setExpandedMonth(null);
  }, []);

  const handleToggleMonth = useCallback(
    (month: string) => {
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setExpandedMonth((prev) => (prev === month ? null : month));
    },
    [reducedMotion],
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([fetchTransactions(), fetchForecast(window, startingBalance)]);
  }, [fetchTransactions, fetchForecast, window, startingBalance]);

  const months = useMemo(() => forecast?.months ?? [], [forecast]);

  // Totais da janela alimentam a legenda: a regra do design system pede legenda
  // a partir de duas séries, e são exatamente estas duas
  const windowTotals = useMemo(() => {
    return months.reduce(
      (acc, month) => ({
        income: acc.income + month.expectedIncome,
        expense: acc.expense + month.expectedExpense,
      }),
      { income: 0, expense: 0 },
    );
  }, [months]);

  const hasProjection = months.some((month) => month.items.length > 0);
  const showSkeleton = !hasLoadedForecastOnce || !baselineReady;

  if (forecastError && !forecast) {
    return (
      <PageContainer>
        <ScreenHeader
          title="Perspectiva de saldo"
          subtitle="Para onde seu saldo vai"
          showProfileButton={false}
        />
        <ErrorState
          message={forecastError}
          onRetry={() => fetchForecast(window, startingBalance)}
        />
      </PageContainer>
    );
  }

  const chartMax = Math.max(windowTotals.income, windowTotals.expense, 1);

  return (
    <PageContainer>
      <ScreenHeader
        title="Perspectiva de saldo"
        subtitle="Para onde seu saldo vai"
        showProfileButton={false}
      />

      {showSkeleton ? (
        <ForecastSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[4],
            paddingBottom: insets.bottom + spacing[12],
          }}
          refreshControl={
            <RefreshControl
              refreshing={isForecastLoading}
              onRefresh={onRefresh}
              tintColor={t.accent.neon}
              colors={[t.accent.neon]}
            />
          }
        >
          <SegmentedControl
            options={WINDOW_OPTIONS}
            value={String(window) as `${ForecastWindow}`}
            onChange={handleWindowChange}
            size="md"
          />

          {/* Falha no refetch (trocar de janela, atualizar) mantém os dados
              antigos na tela — sem este aviso, o seletor marcaria uma janela e
              os cards mostrariam outra, em silêncio */}
          {forecastError && (
            <View
              accessible
              accessibilityLabel={`${forecastError} Os valores abaixo são da última janela carregada. Toque em tentar de novo para recarregar`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: spacing[4],
                padding: spacing[3],
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: t.semantic.danger,
                backgroundColor: t.semantic.dangerMuted,
              }}
            >
              <TriangleAlert size={16} color={t.semantic.danger} />
              <Text
                style={{
                  flex: 1,
                  marginHorizontal: spacing[2],
                  color: t.semantic.danger,
                  fontSize: 12,
                  lineHeight: 17,
                  fontWeight: "600",
                }}
              >
                {forecastError} Os valores abaixo são da última janela carregada.
              </Text>
              <TouchableOpacity
                onPress={() => fetchForecast(window, startingBalance)}
                accessibilityRole="button"
                accessibilityLabel="Tentar calcular a previsão de novo"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.8}
                style={{
                  minHeight: 36,
                  justifyContent: "center",
                  paddingHorizontal: spacing[3],
                  borderRadius: radius.full,
                  backgroundColor: t.semantic.danger,
                }}
              >
                <Text
                  style={{
                    color: t.text.inverse,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Tentar de novo
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Saldo base declarado na cara: a projeção inteira depende dele e o
              usuário precisa saber de onde ele veio para confiar no número */}
          <View
            accessible
            accessibilityLabel={`Saldo base da projeção: ${formatBRL(
              startingBalance,
            )}, somado a partir do extrato importado`}
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[4],
              padding: spacing[3],
              borderRadius: radius.xl,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.subtle,
            }}
          >
            <Info size={16} color={t.text.tertiary} />
            <Text
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: t.text.secondary,
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              Partindo de{" "}
              <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                {formatBRLCompact(startingBalance)}
              </Text>
              , o líquido do extrato que você importou.
            </Text>
          </View>

          {!hasProjection ? (
            <EmptyForecast onBack={() => navigation.goBack()} />
          ) : (
            <>
              {/* Comparativo da janela: duas séries, legenda obrigatória */}
              <Animated.View
                entering={cardEntering}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  backgroundColor: t.background.surface,
                  borderRadius: radius["2xl"],
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                  padding: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: spacing[2],
                    height: BAR_MAX_HEIGHT,
                  }}
                  // O gráfico é redundante com a legenda ao lado; anunciá-lo de
                  // novo só duplicaria os números para o leitor de tela
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View
                    style={{
                      width: 26,
                      height: Math.max(
                        6,
                        (windowTotals.income / chartMax) * BAR_MAX_HEIGHT,
                      ),
                      borderRadius: radius.md,
                      backgroundColor: t.chart.up,
                    }}
                  />
                  <View
                    style={{
                      width: 26,
                      height: Math.max(
                        6,
                        (windowTotals.expense / chartMax) * BAR_MAX_HEIGHT,
                      ),
                      borderRadius: radius.md,
                      backgroundColor: t.chart.down,
                    }}
                  />
                </View>
                <ChartLegend
                  items={[
                    {
                      label: `Entradas previstas (${months.length} ${
                        months.length === 1 ? "mês" : "meses"
                      })`,
                      value: formatBRL(windowTotals.income),
                      color: t.chart.up,
                    },
                    {
                      label: "Saídas previstas",
                      value: formatBRL(windowTotals.expense),
                      color: t.chart.down,
                    },
                  ]}
                />
              </Animated.View>

              <View style={{ marginTop: spacing[4] }}>
                {months.map((month, index) => (
                  <ForecastMonthCard
                    key={month.month}
                    month={month}
                    index={index}
                    expanded={expandedMonth === month.month}
                    onToggle={() => handleToggleMonth(month.month)}
                  />
                ))}
              </View>

              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 11,
                  lineHeight: 16,
                  marginTop: spacing[2],
                }}
              >
                O mês corrente projeta só o que ainda falta acontecer: o que já
                caiu na conta aparece marcado e fica fora da soma. Transferências
                entre suas próprias contas e séries sem ritmo definido não entram
                na projeção.
              </Text>
            </>
          )}
        </ScrollView>
      )}
    </PageContainer>
  );
}

function EmptyForecast({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  const { cardEntering } = useMotionPresets();
  return (
    <Animated.View
      entering={cardEntering}
      style={{ alignItems: "center", paddingTop: spacing[10] }}
    >
      <CalendarClock size={44} color={t.text.tertiary} />
      <Text
        style={{
          color: t.text.primary,
          fontSize: 17,
          fontWeight: "700",
          textAlign: "center",
          marginTop: spacing[3],
        }}
      >
        Ainda não há o que projetar
      </Text>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: 19,
          textAlign: "center",
          marginTop: spacing[1],
        }}
      >
        A projeção nasce das suas recorrências. Rode a varredura do extrato ou
        agende um gasto fixo para o app ter o que somar.
      </Text>
      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Voltar para as recorrências"
        style={{
          minHeight: 48,
          alignSelf: "stretch",
          marginTop: spacing[6],
          borderRadius: radius.full,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: t.accent.neon,
        }}
      >
        <Text style={{ color: t.text.inverse, fontSize: 14, fontWeight: "700" }}>
          Voltar para recorrências
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
