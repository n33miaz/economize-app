import React, { useCallback, useMemo, useState } from "react";
import {
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ArrowDownRight from "lucide-react-native/dist/esm/icons/arrow-down-right";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import CalendarDays from "lucide-react-native/dist/esm/icons/calendar-days";
import ChartPie from "lucide-react-native/dist/esm/icons/chart-pie";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import ClipboardList from "lucide-react-native/dist/esm/icons/clipboard-list";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import type { CategorySlice, MonthlyAnalytics } from "../services/api";
import { useAnalyticsStore } from "../store/analyticsStore";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets } from "../theme/motionPresets";
import BlockGrid from "../components/BlockGrid";
import CategoryIcon, { resolveCategoryColor } from "../components/CategoryIcon";
import CycleAnchorSheet from "../components/CycleAnchorSheet";
import CycleWindowChip from "../components/CycleWindowChip";
import MonthSelector from "../components/MonthSelector";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import { usePreferencesStore, selectCycleAnchorDay } from "../store/preferencesStore";
import {
  cycleChipLabel,
  cycleMonthKeys,
  cycleWindowForMonth,
  describeWindow,
  formatMonthLabel,
  formatWindowLabel,
} from "../utils/cycleWindow";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { formatBRL, formatBRLCompact } from "../utils/money";

// Os dois temas são estruturalmente idênticos; o cast só normaliza os
// literais `as const` para o tipo que CategoryIcon/resolveCategoryColor esperam
function useAppTheme(): AppTheme {
  return useTheme() as AppTheme;
}

// Positivo ganha "+" explícito; o negativo já vem com o sinal do Intl
function formatSignedBRL(value: number) {
  return `${value > 0 ? "+" : ""}${formatBRL(value)}`;
}

function formatSignedPct(value: number) {
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

/**
 * Card destacado com o saldo do período e a comparação com o anterior.
 *
 * O chip de janela NÃO mora mais aqui: ele é o único acesso à âncora nesta
 * tela, e este card não é renderizado quando o ciclo está vazio — justamente a
 * situação em que o usuário precisa corrigir a âncora. Subiu para o corpo da
 * tela, onde existe nos dois ramos.
 */
function MonthHero({ data }: { data: MonthlyAnalytics }) {
  const t = useAppTheme();
  const { cardEntering } = useMotionPresets();

  const prev = data.previous;
  const prevHasData = prev.totalIncome !== 0 || prev.totalExpense !== 0;
  // Sem `month` na resposta o recorte é uma janela — e aí o comparável deixa de
  // ser o mês anterior do calendário
  const isWindowMode = !data.month;
  const previousLabel = prev.month
    ? formatMonthLabel(prev.month)
    : (formatWindowLabel(prev.start, prev.end) ?? "a janela anterior");
  const netDelta = data.net - prev.net;
  const expenseDeltaPct =
    prev.totalExpense > 0
      ? ((data.totalExpense - prev.totalExpense) / prev.totalExpense) * 100
      : null;

  const netDeltaColor = netDelta >= 0 ? t.chart.up : t.chart.down;
  const NetArrow = netDelta >= 0 ? ArrowUpRight : ArrowDownRight;
  // Para saídas a leitura inverte: gastar mais é ruim, gastar menos é bom
  const expenseColor =
    expenseDeltaPct !== null && expenseDeltaPct > 0
      ? t.chart.down
      : expenseDeltaPct !== null && expenseDeltaPct < 0
        ? t.chart.up
        : t.chart.neutral;
  const ExpenseArrow =
    expenseDeltaPct !== null && expenseDeltaPct < 0
      ? ArrowDownRight
      : ArrowUpRight;

  return (
    <Animated.View
      entering={cardEntering}
      style={{
        marginHorizontal: spacing[5],
        marginTop: spacing[4],
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
        {isWindowMode ? "Saldo do ciclo" : "Saldo do mês"}
      </Text>
      <Text
        style={{
          ...typography.numericDisplay,
          color: t.text.primary,
          marginTop: spacing[1],
        }}
        numberOfLines={1}
        adjustsFontSizeToFit
        // O que a tela abrevia, o leitor de tela fala por extenso
        accessibilityLabel={`${
          isWindowMode ? "Saldo do ciclo" : "Saldo do mês"
        }: ${formatBRL(data.net)}`}
      >
        {/* Abreviar em vez de espremer: na web o `adjustsFontSizeToFit` é
            ignorado, então o valor cheio simplesmente cortava */}
        {formatBRLCompact(data.net)}
      </Text>

      <View
        style={{
          flexDirection: "row",
          // 12 e não 16: cada ponto de vão sai da largura do número, e este é
          // o mesmo slot de duas colunas que corta na web
          gap: spacing[3],
          marginTop: spacing[5],
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>Entradas</Text>
          <Text
            style={{
              // `numericMd`: metade de card é o slot mais estreito do app —
              // ver o comentário do token em theme/typography.ts
              ...typography.numericMd,
              color: t.chart.up,
              marginTop: spacing[1],
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`Entradas: ${formatBRL(data.totalIncome)}`}
          >
            {formatBRLCompact(data.totalIncome)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>Saídas</Text>
          <Text
            style={{
              ...typography.numericMd,
              color: t.chart.down,
              marginTop: spacing[1],
            }}
            numberOfLines={1}
            adjustsFontSizeToFit
            accessibilityLabel={`Saídas: ${formatBRL(data.totalExpense)}`}
          >
            {formatBRLCompact(data.totalExpense)}
          </Text>
        </View>
      </View>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: t.border.subtle,
          marginTop: spacing[4],
          paddingTop: spacing[3],
        }}
      >
        {prevHasData ? (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              flexWrap: "wrap",
              gap: spacing[3],
            }}
          >
            <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
              vs {previousLabel}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <NetArrow size={14} color={netDeltaColor} />
              <Text
                style={{
                  color: netDeltaColor,
                  fontSize: 12,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  marginLeft: 2,
                }}
              >
                {formatSignedBRL(netDelta)}
              </Text>
              <Text
                style={{ color: t.text.tertiary, fontSize: 12, marginLeft: 4 }}
              >
                saldo
              </Text>
            </View>
            {expenseDeltaPct !== null && (
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <ExpenseArrow size={14} color={expenseColor} />
                <Text
                  style={{
                    color: expenseColor,
                    fontSize: 12,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                    marginLeft: 2,
                  }}
                >
                  {formatSignedPct(expenseDeltaPct)}
                </Text>
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 12,
                    marginLeft: 4,
                  }}
                >
                  saídas
                </Text>
              </View>
            )}
          </View>
        ) : (
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
            {isWindowMode
              ? "Sem dados na janela anterior"
              : "Sem dados do mês anterior"}
          </Text>
        )}

        {/* Regra da casa: o número comparado tem que estar explicado na tela.
            Em modo janela o comparável não é o mês passado, e migrar de um modo
            para o outro muda os percentuais acima */}
        {isWindowMode && (
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              lineHeight: 16,
              marginTop: spacing[2],
            }}
          >
            Seu ciclo não é o mês do calendário, então a comparação é com a
            janela anterior de mesmo tamanho, terminando na véspera do início.
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Linha do ranking de gastos: ícone, nome, valor, share das saídas e barra
 * proporcional na cor da categoria (a cor segue a entidade, nunca o rank).
 */
function ExpenseRow({
  slice,
  totalExpense,
  index,
  isLast,
  expanded = false,
  onToggle,
  onPressReview,
}: {
  slice: CategorySlice;
  totalExpense: number;
  index: number;
  isLast: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onPressReview: () => void;
}) {
  const t = useAppTheme();
  const { listItemEntering } = useMotionPresets();

  const color = resolveCategoryColor(slice, t);
  const share = totalExpense > 0 ? (slice.expenseTotal / totalExpense) * 100 : 0;
  const isUncategorized = slice.categoryId === null;
  const children =
    slice.children?.filter(
      (c) => c.expenseTotal > 0 || c.previousExpenseTotal > 0,
    ) ?? [];
  // Categoria que zerou fica esmaecida: continua legível, mas não disputa
  // atenção com o que realmente pesou no mês
  const isZeroed = slice.expenseTotal === 0 && slice.previousExpenseTotal > 0;
  const delta = slice.expenseDeltaPct;
  const deltaColor =
    delta === null || delta === 0
      ? t.chart.neutral
      : delta > 0
        ? t.chart.down
        : t.chart.up;

  const content = (
    <View style={{ flexDirection: "row", opacity: isZeroed ? 0.6 : 1 }}>
      <CategoryIcon category={slice} theme={t} size={36} />
      <View style={{ flex: 1, marginLeft: spacing[3] }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text
            style={{
              flex: 1,
              marginRight: spacing[2],
              color: t.text.primary,
              fontSize: 14,
              fontWeight: "600",
            }}
            numberOfLines={1}
          >
            {slice.name}
          </Text>
          {delta === null ? (
            <Text
              style={{ color: t.text.tertiary, fontSize: 12, fontWeight: "700" }}
            >
              novo
            </Text>
          ) : (
            <Text
              style={{
                color: deltaColor,
                fontSize: 12,
                fontWeight: "700",
                fontVariant: ["tabular-nums"],
              }}
            >
              {formatSignedPct(delta)}
            </Text>
          )}
        </View>

        <View
          style={{
            flexDirection: "row",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginTop: spacing[1],
          }}
        >
          <Text
            style={{
              color: t.text.primary,
              fontSize: 14,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
            }}
          >
            {formatBRL(slice.expenseTotal)}
          </Text>
          <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
            {Math.round(share)}% das saídas
          </Text>
        </View>

        <View
          style={{
            marginTop: spacing[2],
            height: 8,
            borderRadius: radius.full,
            backgroundColor: t.border.subtle,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              // piso de 1.5% para a barra não sumir em shares muito pequenos
              width: `${Math.min(100, Math.max(share, 1.5))}%`,
              height: 8,
              borderRadius: radius.full,
              backgroundColor: color,
            }}
          />
        </View>

        {isUncategorized && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[2],
            }}
          >
            <Text
              style={{
                color: t.semantic.warning,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              Toque para categorizar na revisão
            </Text>
            <ChevronRight size={14} color={t.semantic.warning} />
          </View>
        )}

        {children.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[2],
            }}
          >
            <Text
              style={{ color: t.text.tertiary, fontSize: 12, fontWeight: "700" }}
            >
              {expanded
                ? "ocultar detalhe"
                : `ver ${children.length} ${children.length === 1 ? "subcategoria" : "subcategorias"}`}
            </Text>
            <ChevronDown
              size={14}
              color={t.text.tertiary}
              style={{
                marginLeft: 2,
                transform: [{ rotate: expanded ? "180deg" : "0deg" }],
              }}
            />
          </View>
        )}
      </View>
    </View>
  );

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{ marginBottom: isLast ? 0 : spacing[4] }}
    >
      {isUncategorized ? (
        <TouchableOpacity
          onPress={onPressReview}
          activeOpacity={0.7}
          accessibilityLabel="Transações sem categoria: abrir revisão para categorizar"
          accessibilityRole="button"
        >
          {content}
        </TouchableOpacity>
      ) : children.length > 0 ? (
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          accessibilityLabel={`${slice.name}. Toque para ${expanded ? "ocultar" : "ver"} as subcategorias`}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
        >
          {content}
        </TouchableOpacity>
      ) : (
        content
      )}

      {expanded && children.length > 0 && (
        <View
          style={{
            marginTop: spacing[3],
            marginLeft: spacing[6],
            paddingLeft: spacing[3],
            borderLeftWidth: 1,
            borderLeftColor: t.border.subtle,
          }}
        >
          {children.map((child) => (
            <View
              key={child.categoryId ?? child.name}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: spacing[2],
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  color: t.text.secondary,
                  fontSize: 13,
                  marginRight: spacing[2],
                }}
              >
                {child.name}
              </Text>
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 13,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatBRL(child.expenseTotal)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Animated.View>
  );
}

/** Linha compacta de receita: só nome e valor, sem barra. */
function IncomeRow({
  slice,
  index,
  isLast,
}: {
  slice: CategorySlice;
  index: number;
  isLast: boolean;
}) {
  const t = useAppTheme();
  const { listItemEntering } = useMotionPresets();
  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        marginBottom: isLast ? 0 : spacing[3],
      }}
    >
      <CategoryIcon category={slice} theme={t} size={28} />
      <Text
        style={{
          flex: 1,
          marginHorizontal: spacing[3],
          color: t.text.primary,
          fontSize: 14,
          fontWeight: "600",
        }}
        numberOfLines={1}
      >
        {slice.name}
      </Text>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 14,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatBRL(slice.incomeTotal)}
      </Text>
    </Animated.View>
  );
}

function PendingReviewBanner({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  const t = useAppTheme();
  const { listItemEntering } = useMotionPresets();
  const label =
    count === 1
      ? "1 transação aguardando revisão"
      : `${count} transações aguardando revisão`;
  return (
    <Animated.View
      entering={listItemEntering(0)}
      style={{ marginHorizontal: spacing[5], marginTop: spacing[3] }}
    >
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        accessibilityLabel={`${label}. Abrir revisão`}
        accessibilityRole="button"
        style={{
          flexDirection: "row",
          alignItems: "center",
          minHeight: 44,
          backgroundColor: t.semantic.warningMuted,
          borderRadius: radius.xl,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        }}
      >
        <ClipboardList size={18} color={t.semantic.warning} />
        <Text
          style={{
            flex: 1,
            marginLeft: spacing[3],
            color: t.semantic.warning,
            fontSize: 13,
            fontWeight: "700",
          }}
        >
          {label} →
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Vazio global: o usuário ainda não importou nenhum extrato. */
function GlobalEmpty({ onImport }: { onImport: () => void }) {
  const t = useAppTheme();
  const { cardEntering } = useMotionPresets();
  return (
    <Animated.View
      entering={cardEntering}
      style={{
        alignItems: "center",
        paddingHorizontal: spacing[6],
        marginTop: spacing[12],
      }}
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
        <ChartPie size={36} color={t.accent.neon} />
      </View>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 18,
          fontWeight: "700",
          textAlign: "center",
        }}
      >
        Sua análise começa com um extrato
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
        Importe um extrato bancário e veja seus meses consolidados por
        categoria, com comparação mês a mês.
      </Text>
      <TouchableOpacity
        onPress={onImport}
        activeOpacity={0.85}
        accessibilityLabel="Importar extrato"
        accessibilityRole="button"
        style={{
          marginTop: spacing[6],
          height: 48,
          paddingHorizontal: spacing[8],
          borderRadius: radius.full,
          backgroundColor: t.accent.neon,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Text
          style={{ color: t.text.inverse, fontSize: 14, fontWeight: "700" }}
        >
          Importar extrato
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/** Vazio do período: há histórico em outros, mas este não teve movimento. */
function MonthEmpty({
  label,
  isWindowMode,
}: {
  label: string;
  isWindowMode: boolean;
}) {
  const t = useAppTheme();
  const { cardEntering } = useMotionPresets();
  return (
    <Animated.View
      entering={cardEntering}
      style={{
        alignItems: "center",
        paddingHorizontal: spacing[6],
        marginTop: spacing[10],
      }}
    >
      <CalendarDays size={44} color={t.text.tertiary} />
      <Text
        style={{
          color: t.text.primary,
          fontSize: 16,
          fontWeight: "700",
          textAlign: "center",
          marginTop: spacing[3],
        }}
      >
        Nada por aqui em {label}
      </Text>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          textAlign: "center",
          marginTop: spacing[1],
        }}
      >
        Nenhuma movimentação registrada neste período. Escolha outro acima
        {isWindowMode
          ? " — ou ajuste o dia em que seu mês vira, na engrenagem."
          : "."}
      </Text>
    </Animated.View>
  );
}

/** Skeletons do primeiro carregamento, imitando a geometria do conteúdo. */
function AnalyticsSkeleton({ showChips }: { showChips: boolean }) {
  return (
    <View style={{ paddingHorizontal: spacing[5] }}>
      {showChips && (
        <View
          style={{
            flexDirection: "row",
            gap: spacing[2],
            marginBottom: spacing[4],
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} width={92} height={44} borderRadius={radius.full} />
          ))}
        </View>
      )}
      <Skeleton width="100%" height={200} borderRadius={radius["2xl"]} />
      <View style={{ marginTop: spacing[5] }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ marginBottom: spacing[3] }}>
            <Skeleton width="100%" height={68} borderRadius={radius.xl} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Analytics() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const t = useAppTheme();
  // Gastos e receitas viram colunas irmãs a partir de 768 px de miolo
  const { columns } = useBreakpoint();

  const {
    data,
    months,
    selectedMonth,
    isLoading,
    error,
    fetchMonths,
    fetchMonthly,
  } = useAnalyticsStore();
  const anchorDay = usePreferencesStore(selectCycleAnchorDay);
  const [anchorSheetOpen, setAnchorSheetOpen] = useState(false);

  // Meses primeiro: o store cai no mês mais recente com movimento antes
  // de buscar a consolidação. No foco (e não só na montagem), porque revisar
  // pelo banner acontece em outra tela e muda o consolidado
  useFocusEffect(
    useCallback(() => {
      const load = async () => {
        await fetchMonths();
        await fetchMonthly();
      };
      load();
    }, [fetchMonths, fetchMonthly]),
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([fetchMonths(), fetchMonthly()]);
  }, [fetchMonths, fetchMonthly]);

  // Detalhe por subcategoria abre sob demanda: o ranking dos pais é a leitura
  // principal, a quebra é o segundo olhar
  const [expandedSlices, setExpandedSlices] = useState<Set<string>>(new Set());
  const toggleSlice = useCallback((id: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSlices((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const goToReview = useCallback(() => {
    navigation.navigate("Revisão" as never);
  }, [navigation]);

  const goToImport = useCallback(() => {
    (navigation as any).navigate("Main", {
      screen: "Finanças",
      params: { screen: "Extrato" },
    });
  }, [navigation]);

  // Também entra quem gastou no mês anterior e zerou neste (EC-077): some da
  // lista era pior do que aparecer com 0 e -100%, porque parecia importação
  // faltando em vez de gasto que acabou
  const expenseSlices = useMemo(
    () =>
      data?.categories.filter(
        (s) => s.expenseTotal > 0 || s.previousExpenseTotal > 0,
      ) ?? [],
    [data],
  );

  // A API ordena por gasto; para receitas reordenamos pelo que entrou
  const incomeSlices = useMemo(
    () =>
      [...(data?.categories ?? [])]
        .filter((s) => s.incomeTotal > 0)
        .sort((a, b) => b.incomeTotal - a.incomeTotal),
    [data],
  );

  const monthIsEmpty =
    data !== null && data.totalIncome === 0 && data.totalExpense === 0;

  // Os chips continuam nascendo dos meses com movimento (só o servidor sabe
  // onde há dado); em modo janela cada mês vira o mês-âncora de um ciclo, e
  // entra um a mais para os primeiros dias do histórico não ficarem órfãos
  const periodKeys = useMemo(
    () => cycleMonthKeys(anchorDay, months),
    [anchorDay, months],
  );
  const chipLabel = useCallback(
    (month: string) => cycleChipLabel(anchorDay, month),
    [anchorDay],
  );
  const chipDescription = useCallback(
    (month: string) => {
      const window = cycleWindowForMonth(anchorDay, month);
      const spoken = describeWindow(window.start, window.end);
      return spoken
        ? `Ver análise ${spoken}`
        : `Ver análise de ${chipLabel(month)}`;
    },
    [anchorDay, chipLabel],
  );
  // Rótulo do vazio: o mês quando o ciclo é o calendário, a janela quando não é
  const emptyLabel =
    data === null
      ? ""
      : data.month
        ? formatMonthLabel(data.month)
        : (formatWindowLabel(data.start, data.end) ?? "este período");

  if (error && !data) {
    return (
      <PageContainer>
        <ScreenHeader
          title="Análise"
          subtitle="Seu mês em números"
          showProfileButton={false}
        />
        <ErrorState
          message={error}
          onRetry={() => {
            fetchMonths();
            fetchMonthly();
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScreenHeader
        title="Análise"
        subtitle="Seu mês em números"
        showProfileButton={false}
      />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: spacing[4],
          paddingBottom: insets.bottom + spacing[12],
        }}
        refreshControl={
          <RefreshControl
            refreshing={isLoading && data !== null}
            onRefresh={onRefresh}
            tintColor={t.accent.neon}
          />
        }
      >
        <View style={{ marginBottom: periodKeys.length > 0 ? spacing[1] : 0 }}>
          <MonthSelector
            months={periodKeys}
            selected={selectedMonth}
            onSelect={(month) => fetchMonthly(month)}
            formatLabel={chipLabel}
            describeOption={chipDescription}
          />
        </View>

        {/* A janela somada e a engrenagem, fora do card do saldo: o ciclo vazio
            não renderiza o card, e era exatamente lá que o controle da âncora
            precisava estar. Some só quando não há extrato nenhum — aí a
            resposta é importar, não trocar o ciclo */}
        {data !== null && months.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              justifyContent: "flex-end",
              paddingHorizontal: spacing[5],
              marginTop: spacing[2],
            }}
          >
            <CycleWindowChip
              start={data.start}
              end={data.end}
              onPress={() => setAnchorSheetOpen(true)}
            />
          </View>
        )}

        {!data ? (
          <View style={{ marginTop: periodKeys.length > 0 ? spacing[4] : 0 }}>
            <AnalyticsSkeleton showChips={periodKeys.length === 0} />
          </View>
        ) : monthIsEmpty ? (
          months.length === 0 ? (
            <GlobalEmpty onImport={goToImport} />
          ) : (
            <MonthEmpty label={emptyLabel} isWindowMode={!data.month} />
          )
        ) : (
          // key pelo início do recorte: trocar de período remonta o bloco e
          // refaz a cascata (em modo janela `month` volta null e não serve)
          <View key={data.start ?? data.month ?? "atual"}>
            <MonthHero data={data} />

            {data.pendingReviewCount > 0 && (
              <PendingReviewBanner
                count={data.pendingReviewCount}
                onPress={goToReview}
              />
            )}

            {/* As duas listas de categoria respondem à mesma pergunta por
                lados opostos (para onde foi × de onde veio): no desktop elas
                ficam lado a lado e a comparação deixa de exigir rolagem */}
            <BlockGrid columns={columns}>
              {[
            expenseSlices.length > 0 && (
              <View
                key="gastos"
                style={{ marginTop: spacing[6], paddingHorizontal: spacing[5] }}
              >
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 18,
                    fontWeight: "700",
                    marginBottom: spacing[3],
                  }}
                >
                  Gastos por categoria
                </Text>
                <View
                  style={{
                    backgroundColor: t.background.surface,
                    borderRadius: radius["2xl"],
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                    padding: spacing[4],
                  }}
                >
                  {expenseSlices.map((slice, index) => (
                    <ExpenseRow
                      key={slice.categoryId ?? "sem-categoria"}
                      slice={slice}
                      totalExpense={data.totalExpense}
                      index={index}
                      isLast={index === expenseSlices.length - 1}
                      expanded={expandedSlices.has(slice.categoryId ?? "")}
                      onToggle={() => toggleSlice(slice.categoryId ?? "")}
                      onPressReview={goToReview}
                    />
                  ))}
                </View>
              </View>
            ),

            incomeSlices.length > 0 && (
              <View
                key="receitas"
                style={{ marginTop: spacing[6], paddingHorizontal: spacing[5] }}
              >
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 15,
                    fontWeight: "700",
                    marginBottom: spacing[3],
                  }}
                >
                  Receitas por categoria
                </Text>
                <View
                  style={{
                    backgroundColor: t.background.surface,
                    borderRadius: radius["2xl"],
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                    padding: spacing[4],
                  }}
                >
                  {incomeSlices.map((slice, index) => (
                    <IncomeRow
                      key={slice.categoryId ?? "sem-categoria"}
                      slice={slice}
                      index={index}
                      isLast={index === incomeSlices.length - 1}
                    />
                  ))}
                </View>
              </View>
            ),
              ]}
            </BlockGrid>
          </View>
        )}
      </ScrollView>

      <CycleAnchorSheet
        visible={anchorSheetOpen}
        onClose={() => setAnchorSheetOpen(false)}
      />
    </PageContainer>
  );
}
