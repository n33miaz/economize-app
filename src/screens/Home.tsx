import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Bitcoin,
  ChartColumn,
  ChartPie,
  ChevronRight,
  Eye,
  EyeOff,
  ListChecks,
  Star,
  TrendingUp,
  Upload,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import { Indicator } from "../services/api";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import useNewsData from "../hooks/useNewsData";
import { useAuthStore } from "../store/authStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { useAnalyticsStore } from "../store/analyticsStore";
import { useWalletStore } from "../store/walletStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useReviewStore } from "../store/reviewStore";

import CategoryIcon, { resolveCategoryColor } from "../components/CategoryIcon";
import HighlightCard from "../components/HighlightCard";
import Skeleton from "../components/Skeleton";
import ScreenHeader from "../components/ScreenHeader";
import IndicatorDetailSheet from "../components/IndicatorDetailSheet";
import AssistantFAB from "../components/AssistantFAB";
import { formatMonthLabel } from "../components/MonthSelector";

const HIDDEN = "R$ •••••";

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  });
}

/**
 * A Home é a tela do MÊS. O extrato é o produto: o primeiro bloco responde
 * "quanto entrou, quanto saiu, sobrou quanto", o segundo mostra o que exige
 * decisão (revisão) e o terceiro para onde o dinheiro foi. Carteira, mercado e
 * notícias vêm depois — são contexto, não a razão de abrir o app.
 */
export default function Home() {
  const navigation = useNavigation();
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  // Preferência persistida: o "olhinho" sobrevive ao fechamento do app
  const hideBalance = usePreferencesStore((s) => s.hideBalance);
  const toggleHideBalance = usePreferencesStore((s) => s.toggleHideBalance);
  const showBalance = !hideBalance;
  const { userName } = useAuthStore();

  const {
    indicators,
    loading: indicatorsLoading,
    fetchIndicators,
  } = useIndicatorStore();
  const { articles: news, loading: newsLoading, fetchNews } = useNewsData();
  // Consolidação própria da Home: o mês escolhido na Análise é dela, aqui a
  // resposta é sempre sobre o mês corrente
  const {
    homeData: monthly,
    isHomeLoading: monthlyLoading,
    fetchHomeMonthly,
  } = useAnalyticsStore();
  const { transactions: walletTxs, fetchTransactions: fetchWallet } =
    useWalletStore();
  const { favorites } = useFavoritesStore();
  const fetchQueue = useReviewStore((s) => s.fetchQueue);
  const pendingReviewCount = useReviewStore((s) =>
    s.pendingTransactionsCount(),
  );

  useEffect(() => {
    fetchIndicators();
    fetchNews();
    fetchWallet();
  }, []);

  // Importar extrato ou revisar acontece em outras telas — revalida a cada
  // foco, que já cobre a montagem: uma busca só, sem duas correndo juntas
  useFocusEffect(
    useCallback(() => {
      fetchQueue();
      fetchHomeMonthly();
    }, [fetchQueue, fetchHomeMonthly]),
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      fetchIndicators(),
      fetchNews(),
      fetchWallet(),
      fetchHomeMonthly(),
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const walletBalance = useMemo(() => {
    return walletTxs.reduce((total, tx) => {
      const indicator = indicators.find((i) => i.code === tx.assetCode);
      const currentPrice = indicator ? indicator.buy : tx.priceAtTransaction;
      return total + tx.quantity * currentPrice;
    }, 0);
  }, [walletTxs, indicators]);

  // Rentabilidade real da carteira (valor atual vs custo de aquisição);
  // null quando não há base de custo — o badge some em vez de inventar número
  const walletPerformance = useMemo(() => {
    let cost = 0;
    let current = 0;
    walletTxs.forEach((tx) => {
      const indicator = indicators.find((i) => i.code === tx.assetCode);
      const currentPrice = indicator ? indicator.buy : tx.priceAtTransaction;
      cost += tx.quantity * tx.priceAtTransaction;
      current += tx.quantity * currentPrice;
    });
    if (cost <= 0) return null;
    return ((current - cost) / cost) * 100;
  }, [walletTxs, indicators]);

  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(
    null,
  );

  // Top 3 do ranking de saídas — o resto é a tela de Análise
  const topExpenses = useMemo(
    () =>
      (monthly?.categories ?? [])
        .filter((slice) => slice.expenseTotal > 0)
        .slice(0, 3),
    [monthly],
  );

  const expenseDeltaPct = useMemo(() => {
    if (!monthly || monthly.previous.totalExpense <= 0) return null;
    return (
      ((monthly.totalExpense - monthly.previous.totalExpense) /
        monthly.previous.totalExpense) *
      100
    );
  }, [monthly]);

  const hasMonthData =
    monthly !== null &&
    (monthly.totalIncome > 0 || monthly.totalExpense > 0);

  const recentNews = useMemo(() => (news ? news.slice(0, 3) : []), [news]);
  const isContentLoading = indicatorsLoading || newsLoading;

  const highlights: Indicator[] = useMemo(() => {
    // Dedup por code nos DOIS ramos: a API repete ativos e o slot liberado
    // passa naturalmente para o próximo indicador distinto
    const seen = new Set<string>();
    const isDistinct = (item: Indicator) => {
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    };

    if (favorites.length > 0) {
      return indicators
        .filter((item) => favorites.includes(item.id))
        .filter(isDistinct);
    }

    const defaultCodes = ["USD", "CDI", "EUR", "BTC", "IBOVESPA"];

    return indicators.filter((item) => {
      const match =
        defaultCodes.includes(item.code) || defaultCodes.includes(item.name);
      return match && isDistinct(item);
    });
  }, [indicators, favorites]);

  const toggleBalance = () => {
    Haptics.selectionAsync();
    toggleHideBalance();
  };

  const goToImport = () =>
    (navigation as any).navigate("Finanças", { screen: "Extrato" });
  const goToAnalytics = () => navigation.navigate("Análise" as never);

  const firstName = userName ? userName.split(" ")[0] : "por aqui";
  const monthLabel = monthly ? formatMonthLabel(monthly.month) : "este mês";

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={`Olá, ${firstName}`}
        subtitle={hasMonthData ? monthLabel : "Vamos organizar seu mês"}
        rightActions={[
          <TouchableOpacity
            key="favorites"
            className="bg-elevated active:bg-border"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={() => navigation.navigate("Favoritos" as never)}
            accessibilityLabel="Favoritos"
            accessibilityRole="button"
          >
            <Star size={18} color={t.text.primary} />
          </TouchableOpacity>,
        ]}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isContentLoading}
            onRefresh={onRefresh}
            tintColor={t.accent.neon}
          />
        }
      >
        {/* O mês: a resposta que o app existe para dar */}
        <Animated.View
          entering={cardEntering}
          className="mx-5 mb-5 bg-surface border border-border rounded-3xl p-5"
        >
          {!hasMonthData ? (
            monthlyLoading ? (
              <View>
                <Skeleton width={120} height={14} />
                <View style={{ height: spacing[3] }} />
                <Skeleton width="70%" height={34} />
                <View style={{ height: spacing[4] }} />
                <Skeleton width="100%" height={44} borderRadius={radius.full} />
              </View>
            ) : (
              <View style={{ alignItems: "center", paddingVertical: spacing[2] }}>
                <View
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: radius.full,
                    backgroundColor: t.accent.neonMuted,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: spacing[3],
                  }}
                >
                  <Upload size={26} color={t.accent.neon} />
                </View>
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 17,
                    fontWeight: "700",
                    textAlign: "center",
                  }}
                >
                  Tudo começa com um extrato
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
                  Exporte o OFX do seu banco. O Economize! categoriza sozinho e
                  fecha o mês para você.
                </Text>
                <TouchableOpacity
                  onPress={goToImport}
                  accessibilityLabel="Importar extrato"
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  style={{
                    marginTop: spacing[4],
                    height: 48,
                    alignSelf: "stretch",
                    borderRadius: radius.full,
                    backgroundColor: t.accent.neon,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text
                    style={{
                      color: t.text.inverse,
                      fontSize: 14,
                      fontWeight: "700",
                    }}
                  >
                    Importar extrato
                  </Text>
                </TouchableOpacity>
              </View>
            )
          ) : (
            <>
              <View className="flex-row justify-between items-center">
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 11,
                    fontWeight: "700",
                    letterSpacing: 1,
                    textTransform: "uppercase",
                  }}
                >
                  Sobrou em {monthLabel}
                </Text>
                <TouchableOpacity
                  onPress={toggleBalance}
                  accessibilityLabel={
                    showBalance ? "Ocultar valores" : "Mostrar valores"
                  }
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {showBalance ? (
                    <Eye size={18} color={t.text.secondary} />
                  ) : (
                    <EyeOff size={18} color={t.text.secondary} />
                  )}
                </TouchableOpacity>
              </View>

              <Text
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  ...typography.numericDisplay,
                  color: monthly.net >= 0 ? t.text.primary : t.chart.down,
                  marginTop: spacing[1],
                }}
              >
                {showBalance ? formatBRL(monthly.net) : HIDDEN}
              </Text>

              <View
                style={{
                  flexDirection: "row",
                  gap: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <MoneyColumn
                  label="Entradas"
                  value={monthly.totalIncome}
                  color={t.chart.up}
                  hidden={!showBalance}
                />
                <MoneyColumn
                  label="Saídas"
                  value={monthly.totalExpense}
                  color={t.chart.down}
                  hidden={!showBalance}
                />
              </View>

              <TouchableOpacity
                onPress={goToAnalytics}
                accessibilityLabel="Abrir a análise do mês"
                accessibilityRole="button"
                activeOpacity={0.7}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  borderTopWidth: 1,
                  borderTopColor: t.border.subtle,
                  marginTop: spacing[4],
                  paddingTop: spacing[3],
                }}
              >
                {expenseDeltaPct !== null ? (
                  <>
                    {expenseDeltaPct <= 0 ? (
                      <ArrowDownRight size={14} color={t.chart.up} />
                    ) : (
                      <ArrowUpRight size={14} color={t.chart.down} />
                    )}
                    <Text
                      style={{
                        color: expenseDeltaPct <= 0 ? t.chart.up : t.chart.down,
                        fontSize: 12,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                        marginLeft: 2,
                      }}
                    >
                      {expenseDeltaPct > 0 ? "+" : ""}
                      {expenseDeltaPct.toFixed(0)}%
                    </Text>
                    <Text
                      style={{
                        color: t.text.tertiary,
                        fontSize: 12,
                        marginLeft: 4,
                      }}
                    >
                      em saídas vs {formatMonthLabel(monthly.previous.month)}
                    </Text>
                  </>
                ) : (
                  <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                    Sem dados do mês anterior
                  </Text>
                )}
                <View style={{ flex: 1 }} />
                <Text
                  style={{
                    color: t.accent.neon,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Análise
                </Text>
                <ChevronRight size={14} color={t.accent.neon} />
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Revisão pendente: o único bloco que pede ação do usuário */}
        {pendingReviewCount > 0 && (
          <Animated.View entering={listItemEntering(1)} className="px-5 mb-5">
            <TouchableOpacity
              onPress={() => navigation.navigate("Revisão" as never)}
              accessibilityLabel={`${pendingReviewCount} ${
                pendingReviewCount === 1
                  ? "transação aguardando revisão"
                  : "transações aguardando revisão"
              }`}
              accessibilityRole="button"
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 52,
                borderRadius: radius.xl,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                backgroundColor: t.semantic.warningMuted,
              }}
            >
              <ListChecks size={18} color={t.semantic.warning} />
              <Text
                style={{
                  flex: 1,
                  marginLeft: spacing[3],
                  color: t.semantic.warning,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                {pendingReviewCount === 1
                  ? "1 transação esperando você"
                  : `${pendingReviewCount} transações esperando você`}
              </Text>
              <ChevronRight size={18} color={t.semantic.warning} />
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Para onde foi: as 3 maiores saídas do mês */}
        {topExpenses.length > 0 && (
          <Animated.View entering={listItemEntering(2)} className="px-5 mb-5">
            <View className="flex-row items-center justify-between mb-3">
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 16,
                  fontWeight: "700",
                }}
              >
                Para onde foi
              </Text>
              <TouchableOpacity
                onPress={goToAnalytics}
                accessibilityLabel="Ver todas as categorias"
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text
                  style={{
                    color: t.accent.neon,
                    fontWeight: "700",
                    fontSize: 13,
                  }}
                >
                  Ver tudo
                </Text>
              </TouchableOpacity>
            </View>
            <View
              style={{
                backgroundColor: t.background.surface,
                borderWidth: 1,
                borderColor: t.border.subtle,
                borderRadius: radius["2xl"],
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              }}
            >
              {topExpenses.map((slice, index) => {
                const color = resolveCategoryColor(slice, t as AppTheme);
                const share =
                  monthly && monthly.totalExpense > 0
                    ? (slice.expenseTotal / monthly.totalExpense) * 100
                    : 0;
                return (
                  <View
                    key={slice.categoryId ?? "sem-categoria"}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: index === 0 ? 0 : spacing[3],
                    }}
                  >
                    <CategoryIcon
                      category={slice}
                      theme={t as AppTheme}
                      size={32}
                    />
                    <View style={{ flex: 1, marginLeft: spacing[3] }}>
                      <View className="flex-row items-center justify-between">
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            marginRight: spacing[2],
                            color: t.text.primary,
                            fontSize: 13,
                            fontWeight: "600",
                          }}
                        >
                          {slice.name}
                        </Text>
                        <Text
                          style={{
                            color: t.text.primary,
                            fontSize: 13,
                            fontWeight: "700",
                            fontVariant: ["tabular-nums"],
                          }}
                        >
                          {showBalance ? formatBRL(slice.expenseTotal) : HIDDEN}
                        </Text>
                      </View>
                      <View
                        style={{
                          marginTop: 5,
                          height: 6,
                          borderRadius: radius.full,
                          backgroundColor: t.border.subtle,
                          overflow: "hidden",
                        }}
                      >
                        <View
                          style={{
                            width: `${Math.min(100, Math.max(share, 1.5))}%`,
                            height: 6,
                            borderRadius: radius.full,
                            backgroundColor: color,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* Atalhos: só o que não está a um toque na tab bar */}
        <Animated.View
          entering={listItemEntering(3)}
          className="flex-row px-5 mb-5"
          style={{ gap: spacing[3] }}
        >
          <QuickAction Icon={Upload} label="Importar" onPress={goToImport} />
          <QuickAction
            Icon={ChartColumn}
            label="Análise"
            onPress={goToAnalytics}
          />
          <QuickAction
            Icon={ChartPie}
            label="Relatórios"
            onPress={() => navigation.navigate("Relatórios" as never)}
          />
        </Animated.View>

        {/* Patrimônio e mercado: contexto, não o centro da tela */}
        <Animated.View entering={listItemEntering(4)} className="px-5 mb-5">
          <TouchableOpacity
            onPress={() =>
              (navigation as any).navigate("Finanças", { screen: "Carteira" })
            }
            accessibilityLabel="Abrir a carteira"
            accessibilityRole="button"
            activeOpacity={0.8}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: t.background.surface,
              borderWidth: 1,
              borderColor: t.border.subtle,
              borderRadius: radius["2xl"],
              padding: spacing[4],
            }}
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
              <TrendingUp size={18} color={t.accent.neon} />
            </View>
            <View style={{ flex: 1, marginLeft: spacing[3] }}>
              <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                Investido
              </Text>
              <Text
                style={{
                  color: t.text.primary,
                  fontSize: 16,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {showBalance ? formatBRL(walletBalance) : HIDDEN}
              </Text>
            </View>
            {walletPerformance !== null && (
              <Text
                style={{
                  color: walletPerformance >= 0 ? t.chart.up : t.chart.down,
                  fontSize: 13,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                  marginRight: spacing[1],
                }}
              >
                {walletPerformance >= 0 ? "+" : ""}
                {walletPerformance.toFixed(1)}%
              </Text>
            )}
            <ChevronRight size={18} color={t.text.tertiary} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View entering={listItemEntering(5)} className="mb-5">
          <Text className="px-5 text-base font-bold text-textPrimary mb-3">
            {favorites.length > 0 ? "Favoritados" : "Mercado agora"}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4"
          >
            {isContentLoading && highlights.length === 0
              ? [1, 2, 3].map((i) => (
                  <View
                    key={i}
                    className="bg-surface rounded-2xl p-5 mx-2 border border-border min-w-[150px]"
                  >
                    <Skeleton
                      width={36}
                      height={36}
                      borderRadius={18}
                      className="mb-3"
                    />
                    <Skeleton width={80} height={20} className="mb-2" />
                    <Skeleton width={50} height={16} />
                  </View>
                ))
              : highlights.map((item, index) => (
                  <HighlightCard
                    key={`${item.id}-${index}`}
                    title={item.code || item.name}
                    value={item.buy || item.points || 0}
                    variation={item.variation}
                    type={item.type}
                    Icon={
                      item.type === "crypto"
                        ? Bitcoin
                        : item.type === "index"
                          ? TrendingUp
                          : Banknote
                    }
                    onPress={() => setSelectedIndicator(item)}
                  />
                ))}
          </ScrollView>
        </Animated.View>

        <Animated.View entering={listItemEntering(6)} className="px-5">
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold text-textPrimary">
              Radar de notícias
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notícias" as never)}
              accessibilityLabel="Ver mais notícias"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text className="text-primary font-bold text-sm">Ver mais</Text>
            </TouchableOpacity>
          </View>

          {recentNews.map((article, index) => (
            <TouchableOpacity
              key={index}
              className="bg-surface rounded-2xl p-4 mb-2 flex-row items-center border border-border"
              onPress={() => Linking.openURL(article.url)}
              accessibilityLabel={`Abrir notícia: ${article.title}`}
              accessibilityRole="button"
              activeOpacity={0.7}
            >
              <View className="flex-1 pr-4">
                <Text className="text-primary text-[10px] font-bold uppercase mb-1 tracking-wider">
                  {article.source.name}
                </Text>
                <Text
                  className="text-textPrimary text-sm font-bold leading-5"
                  numberOfLines={2}
                >
                  {article.title}
                </Text>
              </View>
              <ChevronRight size={18} color={t.text.secondary} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Detalhes do indicador: sheet canônico compartilhado com as listas */}
      <IndicatorDetailSheet
        indicator={selectedIndicator}
        visible={!!selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
      />

      <AssistantFAB />
    </View>
  );
}

function MoneyColumn({
  label,
  value,
  color,
  hidden,
}: {
  label: string;
  value: number;
  color: string;
  hidden: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.text.tertiary, fontSize: 12 }}>{label}</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ ...typography.numericLg, color, marginTop: spacing[1] }}
      >
        {hidden ? HIDDEN : formatBRL(value)}
      </Text>
    </View>
  );
}

function QuickAction({
  Icon,
  label,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const { pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[pressStyle, { flex: 1 }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={label}
        accessibilityRole="button"
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 46,
          borderRadius: radius.full,
          backgroundColor: t.background.surface,
          borderWidth: 1,
          borderColor: t.border.subtle,
        }}
      >
        <Icon size={16} color={t.accent.neon} />
        <Text
          numberOfLines={1}
          style={{
            color: t.text.primary,
            fontSize: 12,
            fontWeight: "700",
            marginLeft: spacing[2],
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
