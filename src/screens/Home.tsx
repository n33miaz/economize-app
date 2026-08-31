import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import ArrowDownRight from "lucide-react-native/dist/esm/icons/arrow-down-right";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import Banknote from "lucide-react-native/dist/esm/icons/banknote";
import Bitcoin from "lucide-react-native/dist/esm/icons/bitcoin";
import CalendarClock from "lucide-react-native/dist/esm/icons/calendar-clock";
import CalendarRange from "lucide-react-native/dist/esm/icons/calendar-range";
import ChartColumn from "lucide-react-native/dist/esm/icons/chart-column";
import ChartPie from "lucide-react-native/dist/esm/icons/chart-pie";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Eye from "lucide-react-native/dist/esm/icons/eye";
import EyeOff from "lucide-react-native/dist/esm/icons/eye-off";
import ListChecks from "lucide-react-native/dist/esm/icons/list-checks";
import Star from "lucide-react-native/dist/esm/icons/star";
import TrendingUp from "lucide-react-native/dist/esm/icons/trending-up";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import Upload from "lucide-react-native/dist/esm/icons/upload";
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
import { hasMovement, useAnalyticsStore } from "../store/analyticsStore";
import { useWalletStore } from "../store/walletStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useRecurrenceStore } from "../store/recurrenceStore";
import { useWishStore } from "../store/wishStore";
import { describeSalaryTiming } from "../utils/wishes";
import { useReviewStore } from "../store/reviewStore";

import BlockGrid from "../components/BlockGrid";
import CategoryIcon, { resolveCategoryColor } from "../components/CategoryIcon";
import CycleAnchorSheet from "../components/CycleAnchorSheet";
import CycleWindowChip from "../components/CycleWindowChip";
import HighlightCard from "../components/HighlightCard";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import ScreenHeader from "../components/ScreenHeader";
import IndicatorDetailSheet from "../components/IndicatorDetailSheet";
import AssistantFAB from "../components/AssistantFAB";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { formatBRL, formatBRLCompact, formatDecimal, formatPercent } from "../utils/money";
import { formatMonthLabel, formatWindowLabel } from "../utils/cycleWindow";
import { favoriteDisplayItems } from "../utils/indicatorList";
import { firstRiskMonth, upcomingCommitment } from "../utils/recurrence";

// Mesma janela usada na aba de recorrências: o mês seguinte inteiro cabe aqui
const COMMITMENT_WINDOW_DAYS = 30;

const HIDDEN = "R$ •••••";

// O que o leitor de tela ouve quando o "olhinho" está fechado: dizer o valor
// que a tela esconde seria furar a própria preferência do usuário
const HIDDEN_SPOKEN = "valor oculto";

/**
 * Peso relativo de altura de cada bloco, para a grade de duas colunas.
 *
 * É estimativa de quem monta a tela, não medição: a altura real só existe
 * depois do layout. A escala não importa, só a proporção entre eles. Sem isto
 * o rodízio é cego e a Home de um usuário SEM extrato (que perde três dos oito
 * blocos) nascia com a coluna direita terminando na metade da esquerda —
 * justamente a primeiríssima tela de quem acabou de se cadastrar.
 */
const BLOCK_WEIGHTS = {
  mes: 5,
  revisao: 1,
  compromisso: 2,
  destino: 5,
  atalhos: 1,
  carteira: 2,
  mercado: 3,
  noticias: 4,
};

/**
 * A Home é a tela do MÊS. O extrato é o produto: o primeiro bloco responde
 * "quanto entrou, quanto saiu, sobrou quanto", o segundo mostra o que exige
 * decisão (revisão) e o terceiro para onde o dinheiro foi. Carteira, mercado e
 * notícias vêm depois — são contexto, não a razão de abrir o app.
 */
export default function Home() {
  const navigation = useNavigation();
  const t = useTheme();
  // A Home é uma pilha de blocos independentes — o caso mais direto de grade:
  // no desktop eles se dividem em duas colunas em vez de virar uma fita de
  // 1180 px de largura por três telas de altura
  const { columns } = useBreakpoint();
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
  const favoriteSnapshots = useIndicatorStore((s) => s.favoriteSnapshots);
  const { articles: news, loading: newsLoading, fetchNews } = useNewsData();
  // Consolidação própria da Home: o mês escolhido na Análise é dela, aqui a
  // resposta é sempre sobre o mês corrente
  const {
    homeData: monthly,
    isHomeLoading: monthlyLoading,
    months: monthsWithData,
    fetchHomeMonthly,
  } = useAnalyticsStore();
  const { transactions: walletTxs, fetchTransactions: fetchWallet } =
    useWalletStore();
  const { favorites } = useFavoritesStore();
  const fetchQueue = useReviewStore((s) => s.fetchQueue);
  const pendingReviewCount = useReviewStore((s) =>
    s.pendingTransactionsCount(),
  );
  // Só a lista de séries (chamada leve): a projeção de saldo depende do saldo
  // base do extrato e vive na tela dedicada — aqui basta o que já está
  // comprometido, que sai das próprias séries
  const recurringSeries = useRecurrenceStore((s) => s.series);
  const forecast = useRecurrenceStore((s) => s.forecast);
  const fetchRecurrences = useRecurrenceStore((s) => s.fetchSeries);
  // EC-136: o mesmo cartão de comprometimento ganha a leitura ancorada no
  // salário. Dois cartões seriam dois números sobre a mesma coisa
  const committed = useWishStore((s) => s.committed);
  const fetchCommitted = useWishStore((s) => s.fetchCommitted);

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
      fetchRecurrences();
      fetchCommitted();
    }, [fetchQueue, fetchHomeMonthly, fetchRecurrences, fetchCommitted]),
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
  const [anchorSheetOpen, setAnchorSheetOpen] = useState(false);

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

  // Duas perguntas diferentes, e confundi-las mandava importar extrato para
  // quem já tinha importado: "existe extrato?" se responde com os meses que o
  // servidor conhece; "houve movimento NESTA janela?" só com a consolidação.
  // Ciclo parado com extrato na conta é estado de período vazio, não onboarding
  const hasStatement = monthsWithData.length > 0;
  const hasMonthData = hasMovement(monthly);
  // O período já respondeu (mesmo que zerado): é o que libera a janela e a
  // engrenagem na tela, como o comentário do bloco "Para onde foi" sempre pediu
  const hasPeriod = monthly !== null;

  const recentNews = useMemo(() => (news ? news.slice(0, 3) : []), [news]);
  const isContentLoading = indicatorsLoading || newsLoading;

  // `fromFavorites` acompanha a lista para o título nunca ficar órfão:
  // "Favoritados" só aparece quando há de fato um card de favorito para
  // mostrar — favoritos sem dado renderizável (indicadores fora do ar, id
  // que não bate) caem nos destaques padrão em vez de num cabeçalho vazio
  const { items: highlights, fromFavorites } = useMemo(() => {
    // Dedup por code nos DOIS ramos: a API repete ativos e o slot liberado
    // passa naturalmente para o próximo indicador distinto
    const seen = new Set<string>();
    const isDistinct = (item: Indicator) => {
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    };

    if (favorites.length > 0) {
      // Os retratos cobrem favoritos que não vivem na lista principal
      // (favoritados a partir da busca remota do Mercado)
      const favoriteItems = favoriteDisplayItems(
        indicators,
        favoriteSnapshots,
        favorites,
      ).filter(isDistinct);
      if (favoriteItems.length > 0) {
        return { items: favoriteItems, fromFavorites: true };
      }
    }

    const defaultCodes = ["USD", "CDI", "EUR", "BTC", "IBOVESPA"];

    return {
      items: indicators.filter((item) => {
        const match =
          defaultCodes.includes(item.code) || defaultCodes.includes(item.name);
        return match && isDistinct(item);
      }),
      fromFavorites: false,
    };
  }, [indicators, favoriteSnapshots, favorites]);

  const toggleBalance = () => {
    Haptics.selectionAsync();
    toggleHideBalance();
  };

  // Compromisso dos próximos 30 dias direto das séries: número honesto sem
  // depender do saldo base, que só a tela de previsão sabe montar
  const commitment = useMemo(
    () => upcomingCommitment(recurringSeries, COMMITMENT_WINDOW_DAYS),
    [recurringSeries],
  );
  // Só quando a projeção já foi calculada nesta sessão — sem saldo base, um
  // "mês negativo" seria alarme falso
  const riskMonth = useMemo(() => firstRiskMonth(forecast?.months), [forecast]);

  const goToImport = () =>
    (navigation as any).navigate("Finanças", { screen: "Extrato" });
  const goToAnalytics = () => navigation.navigate("Análise" as never);
  const goToRecurrences = () =>
    (navigation as any).navigate("Finanças", { screen: "Recorrências" });

  const firstName = userName ? userName.split(" ")[0] : "por aqui";

  // Rótulo humano do período: mês de calendário quando a âncora é o dia 1, e o
  // recorte por extenso quando não é — dizer "agosto" sobre 12/07→11/08 seria
  // trocar o significado do número sem avisar
  const windowLabel = formatWindowLabel(monthly?.start, monthly?.end);
  const periodLabel = monthly?.month
    ? formatMonthLabel(monthly.month)
    : (windowLabel ?? "este período");
  const isWindowMode = monthly !== null && !monthly.month;
  // Janela anterior de mesmo tamanho × mês anterior do calendário: os dois
  // modos comparam coisas diferentes, e a linha do delta precisa dizer qual
  const previousLabel = monthly?.previous.month
    ? formatMonthLabel(monthly.previous.month)
    : "a janela anterior";
  const previousWindowLabel = formatWindowLabel(
    monthly?.previous.start,
    monthly?.previous.end,
  );

  return (
    // A Home era a única tela fora do PageContainer: no desktop ela corria de
    // borda a borda enquanto todas as outras paravam em 1180 px centrados.
    // `animateEntry={false}` porque os oito blocos abaixo já entram em
    // cascata: somadas, as duas animações davam 24 px de deslocamento e
    // opacidade ao quadrado no primeiro card
    <PageContainer animateEntry={false}>
      <ScreenHeader
        title={`Olá, ${firstName}`}
        subtitle={hasMonthData ? periodLabel : "Vamos organizar seu mês"}
        rightActions={[
          <TouchableOpacity
            key="market"
            className="bg-elevated active:bg-border"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
            }}
            // EC-105: a tela de favoritos foi aposentada — eles agora moram
            // no topo das abas do Mercado, para onde a estrela leva
            onPress={() =>
              (navigation as any).navigate("Main", { screen: "Indicadores" })
            }
            accessibilityLabel="Ver mercado e favoritos"
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
        {/* Tudo aqui é bloco independente: no celular sai empilhado nesta
            ordem, que é a de prioridade; a partir de 768 px de miolo os mesmos
            blocos se revezam entre duas colunas — o card do mês fica no topo
            da esquerda e o que pede ação sobe para o topo da direita, em vez
            de um card de 1180 px de largura com o número num canto */}
        <BlockGrid columns={columns} weights={BLOCK_WEIGHTS}>
          {[
            /* O mês: a resposta que o app existe para dar */
            <Animated.View
              key="mes"
              entering={cardEntering}
              className="mx-5 mb-5 bg-surface border border-border rounded-3xl p-5"
            >
              {/* O `monthly === null` explícito é o que estreita o tipo para o ramo
                  de baixo; `hasMonthData` sozinho é boolean e não estreita nada */}
              {monthly === null || !hasMonthData ? (
                monthlyLoading ? (
                  <View>
                    <Skeleton width={120} height={14} />
                    <View style={{ height: spacing[3] }} />
                    <Skeleton width="70%" height={34} />
                    <View style={{ height: spacing[4] }} />
                    <Skeleton width="100%" height={44} borderRadius={radius.full} />
                  </View>
                ) : hasStatement ? (
                  // Tem extrato, o ciclo é que está parado. Pedir importação aqui
                  // era mentira; o que falta é poder mexer no recorte, então a
                  // engrenagem vem junto do texto
                  <View style={{ alignItems: "center", paddingVertical: spacing[2] }}>
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.full,
                        backgroundColor: t.background.elevated,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: spacing[3],
                      }}
                    >
                      <CalendarRange size={26} color={t.text.tertiary} />
                    </View>
                    <Text
                      style={{
                        color: t.text.primary,
                        fontSize: 17,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      Nada movimentou {isWindowMode ? "neste ciclo" : "neste mês"}
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
                      Seu extrato está aqui, mas nenhum lançamento caiu em{" "}
                      {windowLabel ?? "no período"}. Confira o recorte ou veja o
                      histórico completo.
                    </Text>
                    <View style={{ marginTop: spacing[4] }}>
                      <CycleWindowChip
                        start={monthly?.start}
                        end={monthly?.end}
                        onPress={() => setAnchorSheetOpen(true)}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={goToImport}
                      accessibilityLabel="Ver extrato completo"
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      style={{
                        marginTop: spacing[3],
                        height: 44,
                        paddingHorizontal: spacing[5],
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: t.border.subtle,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: t.text.secondary,
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        Ver extrato
                      </Text>
                    </TouchableOpacity>
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
                      {isWindowMode
                        ? `Sobrou no ciclo ${periodLabel}`
                        : `Sobrou em ${periodLabel}`}
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

                  {/* Abreviar em vez de espremer: a partir de 100 mil o número
                      vira "R$ 123,4 mil" e mantém os 36 px da escala. O
                      `adjustsFontSizeToFit` fica como rede — e na web ele é
                      ignorado pelo react-native-web, então lá a abreviação é a
                      única defesa contra o corte */}
                  <Text
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    // O que a tela abrevia, o leitor de tela fala por extenso:
                    // "R$ 123,4 mil" é resumo de leitura, não o número
                    accessibilityLabel={
                      showBalance
                        ? `${
                            isWindowMode
                              ? `Sobrou no ciclo ${periodLabel}`
                              : `Sobrou em ${periodLabel}`
                          }: ${formatBRL(monthly.net)}`
                        : HIDDEN_SPOKEN
                    }
                    style={{
                      ...typography.numericDisplay,
                      color: monthly.net >= 0 ? t.text.primary : t.chart.down,
                      marginTop: spacing[1],
                    }}
                  >
                    {showBalance ? formatBRLCompact(monthly.net) : HIDDEN}
                  </Text>

                  <View
                    style={{
                      flexDirection: "row",
                      // 12 e não 16: cada ponto de vão sai da largura do
                      // número, que aqui é o slot mais estreito da tela
                      gap: spacing[3],
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
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            color: t.text.tertiary,
                            fontSize: 12,
                            marginLeft: 4,
                          }}
                        >
                          em saídas vs {previousLabel}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                        {isWindowMode
                          ? "Sem dados na janela anterior"
                          : "Sem dados do mês anterior"}
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

                  {/* O comparável do modo janela não é o mês passado: é uma janela
                      de mesmo tamanho terminando na véspera. Sem esta linha, o
                      percentual acima mudaria de significado em silêncio */}
                  {isWindowMode && previousWindowLabel && (
                    <Text
                      style={{
                        color: t.text.tertiary,
                        fontSize: 11,
                        lineHeight: 16,
                        marginTop: spacing[2],
                      }}
                    >
                      Comparado com a janela anterior de mesmo tamanho:{" "}
                      {previousWindowLabel}.
                    </Text>
                  )}
                </>
              )}
            </Animated.View>,

            /* Revisão pendente: o único bloco que pede ação do usuário */
            pendingReviewCount > 0 && (
              <Animated.View
                key="revisao"
                entering={listItemEntering(1)}
                className="px-5 mb-5"
              >
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
            ),

            /* O que já está comprometido: a conta que vence antes de o mês fechar */
            commitment.count > 0 && (
              <Animated.View
                key="compromisso"
                entering={listItemEntering(2)}
                className="px-5 mb-5"
              >
                <TouchableOpacity
                  onPress={goToRecurrences}
                  // Com o "olhinho" fechado o rótulo também cala: dizer o
                  // valor que a tela esconde fura a preferência do usuário
                  accessibilityLabel={`${
                    showBalance ? formatBRL(commitment.total) : HIDDEN_SPOKEN
                  } comprometidos em ${commitment.count} ${
                    commitment.count === 1 ? "recorrência" : "recorrências"
                  } nos próximos ${COMMITMENT_WINDOW_DAYS} dias. Abrir recorrências`}
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  style={{
                    backgroundColor: t.background.surface,
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                    borderRadius: radius["2xl"],
                    padding: spacing[4],
                  }}
                >
                  <View className="flex-row items-center">
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
                        A vencer em {COMMITMENT_WINDOW_DAYS} dias
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
                        {/* O rótulo de acessibilidade deste card segue com o
                            valor cheio: quem ouve não perde os centavos */}
                        {showBalance
                          ? formatBRLCompact(commitment.total)
                          : HIDDEN}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={t.text.tertiary} />
                  </View>
                  {commitment.nextName ? (
                    <Text
                      numberOfLines={1}
                      style={{
                        color: t.text.secondary,
                        fontSize: 12,
                        marginTop: spacing[2],
                      }}
                    >
                      A próxima é {commitment.nextName}
                    </Text>
                  ) : null}
                  {/* A leitura que faltava: não "em 30 dias", mas "do dinheiro
                      que ainda vai entrar". É a pergunta do fim do mês */}
                  {committed?.salaryKnown && committed.salaryDate ? (
                    <Text
                      style={{
                        color: t.text.secondary,
                        fontSize: 12,
                        marginTop: spacing[1],
                      }}
                    >
                      {describeSalaryTiming(
                        committed.daysUntilSalary,
                        committed.salaryDate,
                      )}
                      {": "}
                      {showBalance
                        ? formatBRL(committed.committedAfterSalary)
                        : HIDDEN}{" "}
                      já têm dono
                      {committed.free != null
                        ? ` · sobram ${showBalance ? formatBRL(committed.free) : HIDDEN}`
                        : ""}
                    </Text>
                  ) : null}
                  {riskMonth ? (
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
                        {/* A projeção é por MÊS DE CALENDÁRIO — ela não conhece a
                            âncora (alinhar o motor é mudança de API, ficou como
                            ticket próprio). Fora do dia 1 a tela passa a ter duas
                            réguas, e sem dizer qual é qual o usuário lê o número
                            como erro */}
                        Saldo previsto negativo em {formatMonthLabel(riskMonth.month)}
                        {isWindowMode ? " (mês do calendário)" : ""}
                      </Text>
                    </View>
                  ) : null}
                </TouchableOpacity>
              </Animated.View>
            ),

            /* Para onde foi: as 3 maiores saídas da janela. O bloco depende de
               haver período carregado, e não de haver saída — é aqui que mora a
               engrenagem do ciclo, e ela não pode sumir junto com a lista.
               (`hasStatement` só exclui quem ainda não importou nada: para esse,
               a resposta é o onboarding acima, não o recorte) */
            hasPeriod && hasStatement && (
              <Animated.View
                key="destino"
                entering={listItemEntering(3)}
                className="px-5 mb-5"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text
                    style={{
                      flex: 1,
                      marginRight: spacing[2],
                      color: t.text.primary,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Para onde foi
                  </Text>
                  <CycleWindowChip
                    start={monthly?.start}
                    end={monthly?.end}
                    onPress={() => setAnchorSheetOpen(true)}
                  />
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
                  {topExpenses.length === 0 && (
                    <Text
                      style={{
                        color: t.text.secondary,
                        fontSize: 13,
                        paddingVertical: spacing[2],
                      }}
                    >
                      Nenhuma saída categorizada nesta janela.
                    </Text>
                  )}
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
                              accessibilityLabel={
                                showBalance
                                  ? `${slice.name}: ${formatBRL(
                                      slice.expenseTotal,
                                    )}`
                                  : `${slice.name}: ${HIDDEN_SPOKEN}`
                              }
                              style={{
                                color: t.text.primary,
                                fontSize: 13,
                                fontWeight: "700",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {/* Nome da categoria e valor dividem a linha; o
                                  valor abreviado é o que impede o nome de ser
                                  cortado em "Alimenta...". Quem ouve recebe o
                                  nome e o valor cheio no mesmo nó */}
                              {showBalance
                                ? formatBRLCompact(slice.expenseTotal)
                                : HIDDEN}
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

                  {/* "Ver tudo" desceu para o rodapé do card: o topo virou a linha
                      do recorte, e um link de texto ao lado do chip disputaria o
                      mesmo canto com um alvo de toque menor que o mínimo */}
                  <TouchableOpacity
                    onPress={goToAnalytics}
                    accessibilityLabel="Ver todas as categorias na análise"
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 40,
                      borderTopWidth: 1,
                      borderTopColor: t.border.subtle,
                      marginTop: spacing[3],
                      paddingTop: spacing[3],
                    }}
                  >
                    <Text
                      style={{
                        color: t.accent.neon,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Ver todas as categorias
                    </Text>
                    <ChevronRight size={14} color={t.accent.neon} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ),

            /* Atalhos: só o que não está a um toque na tab bar */
            <Animated.View
              key="atalhos"
              entering={listItemEntering(4)}
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
            </Animated.View>,

            /* Patrimônio e mercado: contexto, não o centro da tela */
            <Animated.View
              key="carteira"
              entering={listItemEntering(5)}
              className="px-5 mb-5"
            >
              <TouchableOpacity
                onPress={() =>
                  (navigation as any).navigate("Finanças", { screen: "Carteira" })
                }
                // O valor entra AQUI: o rótulo do touchable substitui o dos
                // filhos, então um label só de ação fazia o patrimônio nunca
                // ser anunciado — e agora ele ainda é abreviado na tela
                accessibilityLabel={
                  showBalance
                    ? `Investido: ${formatBRL(walletBalance)}${
                        walletPerformance !== null
                          ? `, rentabilidade de ${formatDecimal(
                              walletPerformance,
                              1,
                            )} por cento`
                          : ""
                      }. Abrir a carteira`
                    : `Investido: ${HIDDEN_SPOKEN}. Abrir a carteira`
                }
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
                    {showBalance ? formatBRLCompact(walletBalance) : HIDDEN}
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
                    {formatPercent(walletPerformance, {
                      decimals: 1,
                      signed: true,
                    })}
                  </Text>
                )}
                <ChevronRight size={18} color={t.text.tertiary} />
              </TouchableOpacity>
            </Animated.View>,

            <Animated.View
              key="mercado"
              entering={listItemEntering(5)}
              className="mb-5"
            >
              <Text className="px-5 text-base font-bold text-textPrimary mb-3">
                {fromFavorites ? "Favoritados" : "Mercado agora"}
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
            </Animated.View>,

            <Animated.View
              key="noticias"
              entering={listItemEntering(6)}
              className="px-5 mb-5"
            >
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
        </Animated.View>,
          ]}
        </BlockGrid>
      </ScrollView>

      {/* Detalhes do indicador: sheet canônico compartilhado com as listas */}
      <IndicatorDetailSheet
        indicator={selectedIndicator}
        visible={!!selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
      />

      <CycleAnchorSheet
        visible={anchorSheetOpen}
        onClose={() => setAnchorSheetOpen(false)}
      />

      <AssistantFAB />
    </PageContainer>
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
        // Rede nativa apenas: na web o `adjustsFontSizeToFit` não existe, e é
        // o corpo `numericMd` que garante o encaixe
        accessibilityLabel={
          hidden ? `${label}: ${HIDDEN_SPOKEN}` : `${label}: ${formatBRL(value)}`
        }
        style={{ ...typography.numericMd, color, marginTop: spacing[1] }}
      >
        {/* Slot mais estreito do app: duas colunas dentro de um card que já
            pode estar numa grade de duas colunas. Medido com a fonte real,
            "R$ 99.999,99" (o pior caso POR EXTENSO, logo abaixo do piso de
            abreviação) ocupa 144 px no corpo 24 e o slot tem ~140 no celular
            de 375 px — abreviar não salvava, porque o piso é 100 mil.
            O corpo 20 traz o mesmo texto para 120 px */}
        {hidden ? HIDDEN : formatBRLCompact(value)}
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
