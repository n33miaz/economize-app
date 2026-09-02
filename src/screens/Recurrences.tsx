import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CalendarPlus from "lucide-react-native/dist/esm/icons/calendar-plus";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import CircleCheck from "lucide-react-native/dist/esm/icons/circle-check";
import CircleDashed from "lucide-react-native/dist/esm/icons/circle-dashed";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Radar from "lucide-react-native/dist/esm/icons/radar";
import Repeat from "lucide-react-native/dist/esm/icons/repeat";
import RotateCcw from "lucide-react-native/dist/esm/icons/rotate-ccw";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import TrendingUp from "lucide-react-native/dist/esm/icons/trending-up";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import type { LucideIcon } from "lucide-react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import * as Haptics from "../utils/haptics";

import type { RecurringSeries } from "../services/api";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import { askConfirm } from "../store/confirmStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useRecurrenceStore } from "../store/recurrenceStore";
import { useToastStore } from "../store/toastStore";
import AssistantFAB from "../components/AssistantFAB";
import CategoryIcon from "../components/CategoryIcon";
import ErrorState from "../components/ErrorState";
import { formatMonthLabel } from "../components/MonthSelector";
import PageContainer from "../components/PageContainer";
import SegmentedControl from "../components/SegmentedControl";
import Skeleton from "../components/Skeleton";
import { formatBRL, formatBRLCompact } from "../utils/money";
import {
  type SeriesMonthState,
  cadenceDetailLabel,
  cadenceSpokenLabel,
  dueSummary,
  firstRiskMonth,
  monthStateLabel,
  upcomingCommitment,
  validityLabel,
} from "../utils/recurrence";

type ListFilter = "ACTIVE" | "DISMISSED";

const FILTER_OPTIONS = [
  { label: "Ativas", value: "ACTIVE" as ListFilter },
  { label: "Descartadas", value: "DISMISSED" as ListFilter },
];

// Janela do compromisso mostrado no topo: o mês seguinte inteiro cabe aqui e é
// o horizonte em que ainda dá para reagir a uma cobrança
const COMMITMENT_WINDOW_DAYS = 30;

/** Selo pequeno de origem/estado — o que distingue as séries à primeira vista. */
function Badge({
  label,
  color,
  background,
  Icon,
}: {
  label: string;
  color: string;
  background: string;
  Icon: LucideIcon;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        alignSelf: "flex-start",
        paddingHorizontal: spacing[2],
        paddingVertical: 3,
        borderRadius: radius.full,
        backgroundColor: background,
      }}
    >
      <Icon size={12} color={color} />
      <Text
        style={{ color, fontSize: 11, fontWeight: "700", marginLeft: 4 }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function SeriesCard({
  series,
  monthState,
  index,
  onEdit,
  onDiscard,
  onReactivate,
}: {
  series: RecurringSeries;
  monthState: SeriesMonthState | undefined;
  index: number;
  onEdit: () => void;
  onDiscard: () => void;
  onReactivate: () => void;
}) {
  const t = useTheme() as AppTheme;
  const { listItemEntering } = useMotionPresets();
  const category = useCategoriesStore((s) => s.byId(series.categoryId));

  const name = series.displayName ?? series.merchantKey;
  const isIncome = series.flow === "INCOME";
  const validity = validityLabel(series.startsAt, series.endsAt);
  const isDetected = series.source === "DETECTED";
  const dismissedList = !series.active;

  // Entrada e saída usam sempre chart.up/chart.down; o accent nunca marca
  // alta ou baixa de dinheiro
  const amountColor = isIncome ? t.chart.up : t.text.primary;

  // Série detectada pode não ter estimativa: "R$ 0,00" seria afirmar um valor
  // que ninguém informou
  const amount = series.expectedAmount;
  const spokenAmount =
    amount != null
      ? `${isIncome ? "Entrada" : "Saída"} de ${formatBRL(amount)}`
      : `${isIncome ? "Entrada" : "Saída"} sem valor estimado`;

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{ marginBottom: spacing[3] }}
    >
      {/* A opacidade da lista de descartadas fica num filho, nunca no
          elemento animado: a animação de entrada termina em opacity 1 e, na
          web, sobrescreveria o 0.75 (o Reanimated avisa isso a cada linha) */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "stretch",
          backgroundColor: t.background.surface,
          borderRadius: radius["2xl"],
          borderWidth: 1,
          borderColor: t.border.subtle,
          opacity: dismissedList ? 0.75 : 1,
        }}
      >
      <TouchableOpacity
        onPress={onEdit}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${name}. ${spokenAmount}. ${cadenceSpokenLabel(
          series.cadence,
          series.anchorDay,
        )}. ${
          isDetected ? "Detectada no seu extrato" : "Agendada por você"
        }. ${dueSummary(series.nextDueDate)}. Toque para editar`}
        style={{
          flex: 1,
          flexDirection: "row",
          padding: spacing[4],
          paddingRight: spacing[2],
        }}
      >
        <CategoryIcon category={category} theme={t} size={40} />
        <View style={{ flex: 1, marginLeft: spacing[3] }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              justifyContent: "space-between",
            }}
          >
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginRight: spacing[2],
                color: t.text.primary,
                fontSize: 15,
                fontWeight: "700",
              }}
            >
              {name}
            </Text>
            {amount != null ? (
              <Text
                numberOfLines={1}
                style={{
                  color: amountColor,
                  fontSize: 15,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {isIncome ? "+ " : ""}
                {formatBRLCompact(amount)}
              </Text>
            ) : (
              <Text
                numberOfLines={1}
                style={{ color: t.text.tertiary, fontSize: 12, fontWeight: "600" }}
              >
                sem estimativa
              </Text>
            )}
          </View>

          <Text
            numberOfLines={1}
            style={{
              color: t.text.secondary,
              fontSize: 12,
              marginTop: 2,
            }}
          >
            {cadenceDetailLabel(series.cadence, series.anchorDay)}
            {series.amountType === "VARIABLE" ? " · valor variável" : ""}
          </Text>

          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: spacing[2],
              marginTop: spacing[2],
            }}
          >
            <Badge
              label={isDetected ? "Detectada" : "Agendada"}
              Icon={isDetected ? Radar : CalendarPlus}
              color={isDetected ? t.semantic.info : t.accent.neon}
              background={
                isDetected ? t.semantic.infoMuted : t.accent.neonMuted
              }
            />
            {/* Sem entrada na previsão do mês (trimestral fora do ciclo, início
                futuro ou previsão indisponível) o badge é omitido: afirmar
                "previsto este mês" sem ocorrência no mês seria mentira */}
            {!dismissedList && monthState && (
              <Badge
                label={monthStateLabel(series.flow, monthState.settled)}
                Icon={monthState.settled ? CircleCheck : CircleDashed}
                color={monthState.settled ? t.semantic.success : t.text.tertiary}
                background={
                  monthState.settled
                    ? t.semantic.successMuted
                    : t.background.elevated
                }
              />
            )}
          </View>

          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 12,
              marginTop: spacing[2],
            }}
          >
            {dueSummary(series.nextDueDate)}
          </Text>
          {validity ? (
            <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
              {validity}
            </Text>
          ) : null}
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={dismissedList ? onReactivate : onDiscard}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={
          dismissedList
            ? `Reativar ${name}`
            : `Descartar ${name} da lista de recorrências`
        }
        style={{
          width: 52,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {dismissedList ? (
          <RotateCcw size={18} color={t.accent.neon} />
        ) : (
          <Trash2 size={18} color={t.text.tertiary} />
        )}
      </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

/** Esqueletos do primeiro carregamento, imitando a geometria do conteúdo. */
function RecurrencesSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
      <Skeleton width="100%" height={132} borderRadius={radius["2xl"]} />
      <View
        style={{
          flexDirection: "row",
          gap: spacing[2],
          marginTop: spacing[4],
          marginBottom: spacing[4],
        }}
      >
        <Skeleton width="55%" height={44} borderRadius={radius.full} />
        <Skeleton width="40%" height={44} borderRadius={radius.full} />
      </View>
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: spacing[3] }}>
          <Skeleton width="100%" height={116} borderRadius={radius["2xl"]} />
        </View>
      ))}
    </View>
  );
}

/**
 * Recorrências e agendamentos: o que se repete na vida financeira do usuário,
 * detectado pelo extrato ou declarado por ele, na mesma lista. Mora ao lado de
 * Carteira e Extrato porque responde a mesma pergunta que aquelas duas abas —
 * "o que eu tenho e para onde vai" — só que no eixo do tempo.
 */
export default function Recurrences() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const t = useTheme() as AppTheme;
  const { cardEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  const series = useRecurrenceStore((s) => s.series);
  const dismissed = useRecurrenceStore((s) => s.dismissed);
  const monthState = useRecurrenceStore((s) => s.monthState);
  const forecast = useRecurrenceStore((s) => s.forecast);
  const isLoading = useRecurrenceStore((s) => s.isLoading);
  const hasLoadedOnce = useRecurrenceStore((s) => s.hasLoadedOnce);
  const isLoadingDismissed = useRecurrenceStore((s) => s.isLoadingDismissed);
  const isDetecting = useRecurrenceStore((s) => s.isDetecting);
  const error = useRecurrenceStore((s) => s.error);
  const dismissedError = useRecurrenceStore((s) => s.dismissedError);
  const fetchSeries = useRecurrenceStore((s) => s.fetchSeries);
  const fetchDismissed = useRecurrenceStore((s) => s.fetchDismissed);
  const fetchMonthState = useRecurrenceStore((s) => s.fetchMonthState);
  const runDetection = useRecurrenceStore((s) => s.runDetection);
  const discardSeries = useRecurrenceStore((s) => s.discardSeries);
  const reactivateSeries = useRecurrenceStore((s) => s.reactivateSeries);

  const fetchCategories = useCategoriesStore((s) => s.fetch);
  const categoriesCount = useCategoriesStore((s) => s.items.length);

  const [filter, setFilter] = useState<ListFilter>("ACTIVE");

  // Recarrega a cada foco (e não só na montagem): importar extrato e revisar
  // acontecem em outras telas e mudam tanto as séries quanto o estado do mês
  useFocusEffect(
    useCallback(() => {
      fetchSeries();
      fetchMonthState();
    }, [fetchSeries, fetchMonthState]),
  );

  // Categorias em efeito próprio: dentro do useFocusEffect, o carregamento
  // delas (0 → N) mudava a dependência e refazia as buscas de séries à toa
  useEffect(() => {
    if (categoriesCount === 0) fetchCategories();
  }, [categoriesCount, fetchCategories]);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      fetchSeries(),
      fetchMonthState(),
      filter === "DISMISSED" ? fetchDismissed() : Promise.resolve(),
    ]);
  }, [fetchSeries, fetchMonthState, fetchDismissed, filter]);

  const handleFilterChange = useCallback(
    (next: ListFilter) => {
      setFilter(next);
      // as descartadas só saem do servidor quando alguém pede por elas
      if (next === "DISMISSED") fetchDismissed();
    },
    [fetchDismissed],
  );

  const handleDetect = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const result = await runDetection();
    Haptics.notificationAsync(
      result.ok
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Error,
    );
    showToast(result.message, result.ok ? "success" : "error");
  }, [runDetection, showToast]);

  const openForm = useCallback(
    (seriesId?: string) => {
      (navigation as any).navigate("Agendamento", seriesId ? { seriesId } : {});
    },
    [navigation],
  );

  const handleDiscard = useCallback(
    (item: RecurringSeries) => {
      const name = item.displayName ?? item.merchantKey;
      askConfirm({
        title: "Descartar recorrência",
        message: `"${name}" sai da lista e da previsão de saldo. A varredura não vai recriá-la — e você pode reativá-la em "Descartadas".`,
        confirmLabel: "Descartar",
        destructive: true,
        onConfirm: async () => {
          const result = await discardSeries(item.id);
          Haptics.notificationAsync(
            result.ok
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Error,
          );
          showToast(result.message, result.ok ? "success" : "error");
        },
      });
    },
    [discardSeries, showToast],
  );

  const handleReactivate = useCallback(
    async (item: RecurringSeries) => {
      const result = await reactivateSeries(item.id);
      Haptics.notificationAsync(
        result.ok
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Error,
      );
      showToast(result.message, result.ok ? "success" : "error");
    },
    [reactivateSeries, showToast],
  );

  const commitment = useMemo(
    () => upcomingCommitment(series, COMMITMENT_WINDOW_DAYS),
    [series],
  );
  // Só aparece se a previsão já foi calculada nesta sessão: inventar um mês
  // negativo sem saldo inicial seria alarme falso
  const riskMonth = useMemo(
    () => firstRiskMonth(forecast?.months),
    [forecast],
  );

  const visibleList = filter === "ACTIVE" ? series : dismissed;

  if (error && series.length === 0) {
    return (
      <PageContainer refadeOnFocus>
        <ErrorState message={error} onRetry={fetchSeries} />
      </PageContainer>
    );
  }

  return (
    <PageContainer refadeOnFocus style={{ position: "relative" }}>
      {!hasLoadedOnce ? (
        <RecurrencesSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[4],
            paddingBottom: insets.bottom + spacing[20],
          }}
          refreshControl={
            <RefreshControl
              refreshing={isLoading || isLoadingDismissed}
              onRefresh={onRefresh}
              tintColor={t.accent.neon}
              colors={[t.accent.neon]}
            />
          }
        >
          {/* Perspectiva de saldo: o compromisso dos próximos 30 dias sai das
              próprias séries (não depende de saldo inicial); a projeção completa
              vive na tela dedicada, que é onde o saldo base entra na conta */}
          <Animated.View entering={cardEntering}>
            <TouchableOpacity
              onPress={() => navigation.navigate("Previsão" as never)}
              activeOpacity={0.85}
              accessibilityRole="button"
              // O aviso de risco vive dentro deste Touchable: filhos de um
              // elemento com label não são lidos, então o alerta entra no label
              accessibilityLabel={`Comprometido nos próximos ${COMMITMENT_WINDOW_DAYS} dias: ${formatBRL(
                commitment.total,
              )} em ${commitment.count} ${
                commitment.count === 1 ? "recorrência" : "recorrências"
              }.${
                riskMonth
                  ? ` Atenção: saldo previsto negativo em ${formatMonthLabel(riskMonth.month)}.`
                  : ""
              } Abrir a perspectiva de saldo`}
              style={{
                backgroundColor: t.background.surface,
                borderRadius: radius["2xl"],
                borderWidth: 1,
                borderColor: t.border.subtle,
                padding: spacing[5],
              }}
            >
              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1,
                  textTransform: "uppercase",
                }}
              >
                Comprometido nos próximos {COMMITMENT_WINDOW_DAYS} dias
              </Text>
              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: t.text.primary,
                  fontSize: 30,
                  lineHeight: 36,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  marginTop: spacing[1],
                }}
              >
                {formatBRLCompact(commitment.total)}
              </Text>
              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 13,
                  marginTop: spacing[1],
                }}
                numberOfLines={1}
              >
                {commitment.count === 0
                  ? "Nenhuma cobrança prevista nesta janela"
                  : commitment.nextName
                    ? `${commitment.count} ${
                        commitment.count === 1 ? "cobrança" : "cobranças"
                      } · a próxima é ${commitment.nextName}`
                    : `${commitment.count} cobranças previstas`}
              </Text>

              {riskMonth && (
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginTop: spacing[3],
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                    borderRadius: radius.lg,
                    backgroundColor: t.semantic.dangerMuted,
                  }}
                >
                  <TriangleAlert size={14} color={t.semantic.danger} />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: spacing[2],
                      color: t.semantic.danger,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                    numberOfLines={2}
                  >
                    Saldo previsto negativo em{" "}
                    {formatMonthLabel(riskMonth.month)}
                  </Text>
                </View>
              )}

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderTopWidth: 1,
                  borderTopColor: t.border.subtle,
                  marginTop: spacing[4],
                  paddingTop: spacing[3],
                }}
              >
                <TrendingUp size={14} color={t.accent.neon} />
                <Text
                  style={{
                    flex: 1,
                    marginLeft: spacing[2],
                    color: t.accent.neon,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  Ver perspectiva de saldo
                </Text>
                <ChevronRight size={16} color={t.accent.neon} />
              </View>
            </TouchableOpacity>
          </Animated.View>

          {/* Varredura e agendamento manual: as duas formas de a lista crescer */}
          <View
            style={{
              flexDirection: "row",
              gap: spacing[2],
              marginTop: spacing[4],
            }}
          >
            <TouchableOpacity
              onPress={handleDetect}
              disabled={isDetecting}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={
                isDetecting
                  ? "Varrendo o extrato em busca de recorrências"
                  : "Varrer o extrato em busca de recorrências"
              }
              accessibilityState={{ disabled: isDetecting, busy: isDetecting }}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                borderRadius: radius.full,
                backgroundColor: t.accent.neonMuted,
                borderWidth: 1,
                borderColor: t.accent.neon,
                opacity: isDetecting ? 0.7 : 1,
              }}
            >
              {isDetecting ? (
                <ActivityIndicator size="small" color={t.accent.neon} />
              ) : (
                <Radar size={16} color={t.accent.neon} />
              )}
              <Text
                numberOfLines={1}
                style={{
                  color: t.accent.neon,
                  fontSize: 13,
                  fontWeight: "700",
                  marginLeft: spacing[2],
                }}
              >
                {isDetecting ? "Varrendo…" : "Varrer extrato"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => openForm()}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Criar um novo agendamento de gasto fixo ou renda"
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 48,
                paddingHorizontal: spacing[4],
                borderRadius: radius.full,
                backgroundColor: t.background.surface,
                borderWidth: 1,
                borderColor: t.border.default,
              }}
            >
              <Plus size={16} color={t.text.primary} />
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 13,
                  fontWeight: "700",
                  marginLeft: spacing[1],
                }}
              >
                Agendar
              </Text>
            </TouchableOpacity>
          </View>

          {/* Descartadas continuam acessíveis SEMPRE: o descarte de outra
              sessão não carrega junto, e esconder a aba quando não há ativas
              deixava a promessa "reative em Descartadas" sem porta de entrada */}
          <View style={{ marginTop: spacing[4] }}>
            <SegmentedControl
              options={FILTER_OPTIONS}
              value={filter}
              onChange={handleFilterChange}
              size="md"
            />
          </View>

          <View style={{ marginTop: spacing[4] }}>
            {visibleList.length === 0 ? (
              filter === "ACTIVE" ? (
                <EmptyActive
                  onDetect={handleDetect}
                  onSchedule={() => openForm()}
                  isDetecting={isDetecting}
                />
              ) : isLoadingDismissed ? (
                <EmptyDismissed loading />
              ) : dismissedError ? (
                // erro de rede não pode virar "nada descartado": afirma um
                // vazio que ninguém verificou
                <ErrorState message={dismissedError} onRetry={fetchDismissed} />
              ) : (
                <EmptyDismissed loading={false} />
              )
            ) : (
              visibleList.map((item, index) => (
                <SeriesCard
                  key={item.id}
                  series={item}
                  monthState={monthState[item.id]}
                  index={index}
                  onEdit={() => openForm(item.id)}
                  onDiscard={() => handleDiscard(item)}
                  onReactivate={() => handleReactivate(item)}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      <AssistantFAB />
    </PageContainer>
  );
}

/** Vazio que ensina: as duas formas de a lista deixar de estar vazia. */
function EmptyActive({
  onDetect,
  onSchedule,
  isDetecting,
}: {
  onDetect: () => void;
  onSchedule: () => void;
  isDetecting: boolean;
}) {
  const t = useTheme();
  const { cardEntering } = useMotionPresets();
  return (
    <Animated.View
      entering={cardEntering}
      style={{ alignItems: "center", paddingHorizontal: spacing[4] }}
    >
      <View
        style={{
          width: 80,
          height: 80,
          borderRadius: radius.full,
          backgroundColor: t.accent.neonMuted,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing[4],
        }}
      >
        <Repeat size={36} color={t.accent.neon} />
      </View>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 18,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        Nada se repetindo por aqui ainda
      </Text>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 14,
          lineHeight: 20,
          textAlign: "center",
          marginTop: spacing[2],
        }}
      >
        A varredura procura assinaturas, contas de consumo e salário no extrato
        que você já importou. O que o extrato ainda não provou, você mesmo
        agenda.
      </Text>
      <TouchableOpacity
        onPress={onDetect}
        disabled={isDetecting}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Varrer o extrato em busca de recorrências"
        accessibilityState={{ disabled: isDetecting }}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          alignSelf: "stretch",
          marginTop: spacing[6],
          paddingHorizontal: spacing[6],
          borderRadius: radius.full,
          backgroundColor: t.accent.neon,
          opacity: isDetecting ? 0.7 : 1,
        }}
      >
        {isDetecting ? (
          <ActivityIndicator size="small" color={t.text.inverse} />
        ) : (
          <Radar size={18} color={t.text.inverse} />
        )}
        <Text
          style={{
            color: t.text.inverse,
            fontSize: 14,
            fontWeight: "700",
            marginLeft: spacing[2],
          }}
        >
          {isDetecting ? "Varrendo…" : "Varrer meu extrato"}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onSchedule}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Agendar um gasto fixo manualmente"
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          alignSelf: "stretch",
          marginTop: spacing[2],
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: t.border.default,
        }}
      >
        <CalendarPlus size={16} color={t.text.primary} />
        <Text
          style={{
            color: t.text.primary,
            fontSize: 14,
            fontWeight: "700",
            marginLeft: spacing[2],
          }}
        >
          Agendar um gasto fixo
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function EmptyDismissed({ loading }: { loading: boolean }) {
  const t = useTheme();
  if (loading) {
    return (
      <View>
        {[0, 1].map((i) => (
          <View key={i} style={{ marginBottom: spacing[3] }}>
            <Skeleton width="100%" height={116} borderRadius={radius["2xl"]} />
          </View>
        ))}
      </View>
    );
  }
  return (
    <View style={{ alignItems: "center", paddingVertical: spacing[10] }}>
      <CircleDashed size={40} color={t.text.tertiary} />
      <Text
        style={{
          color: t.text.primary,
          fontSize: 16,
          fontWeight: "700",
          textAlign: "center",
          marginTop: spacing[3],
        }}
      >
        Nada descartado
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
        O que você descartar aparece aqui e pode voltar a qualquer momento.
      </Text>
    </View>
  );
}
