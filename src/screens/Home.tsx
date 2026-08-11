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
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Bitcoin,
  ChartPie,
  ChevronRight,
  Eye,
  EyeOff,
  Sparkles,
  Star,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import Animated from "react-native-reanimated";

import { Indicator, isCurrencyData } from "../services/api";
import { colors } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import useNewsData from "../hooks/useNewsData";
import { useAuthStore } from "../store/authStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";
import { useFavoritesStore } from "../store/favoritesStore";
import { usePreferencesStore } from "../store/preferencesStore";

import HighlightCard from "../components/HighlightCard";
import Skeleton from "../components/Skeleton";
import ScreenHeader from "../components/ScreenHeader";
import CustomModal from "../components/CustomModal";
import HistoricalChart from "../components/HistoricalChart";
import AssistantFAB from "../components/AssistantFAB";

export default function Home() {
  const navigation = useNavigation();
  const t = useTheme();
  // Entrada em cascata sutil dos blocos da Home (máx. 4 seções animadas)
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
  const { fetchTransactions: fetchBank, calculateMetrics } = useBankStore();
  const { transactions: walletTxs, fetchTransactions: fetchWallet } =
    useWalletStore();
  const { favorites } = useFavoritesStore();

  useEffect(() => {
    fetchIndicators();
    fetchNews();
    fetchBank();
    fetchWallet();
  }, []);

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      fetchIndicators(),
      fetchNews(),
      fetchBank(),
      fetchWallet(),
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const bankMetrics = calculateMetrics();
  const bankBalance = bankMetrics.income - bankMetrics.expense;

  const walletBalance = useMemo(() => {
    return walletTxs.reduce((total, tx) => {
      const indicator = indicators.find((i) => i.code === tx.assetCode);
      const currentPrice = indicator ? indicator.buy : tx.priceAtTransaction;
      return total + tx.quantity * currentPrice;
    }, 0);
  }, [walletTxs, indicators]);

  const totalNetWorth = bankBalance + walletBalance;

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

  // Lógica de Favoritos Dinâmicos
  const highlights: Indicator[] = useMemo(() => {
    if (favorites.length > 0) {
      return indicators.filter((item) => favorites.includes(item.id));
    }

    const defaultCodes = ["USD", "CDI", "EUR", "BTC", "IBOVESPA"];
    const seen = new Set();

    return indicators.filter((item) => {
      const match =
        defaultCodes.includes(item.code) || defaultCodes.includes(item.name);
      if (match && !seen.has(item.code)) {
        seen.add(item.code);
        return true;
      }
      return false;
    });
  }, [indicators, favorites]);

  const recentNews = useMemo(() => (news ? news.slice(0, 3) : []), [news]);
  const isContentLoading = indicatorsLoading || newsLoading;

  const toggleBalance = () => {
    Haptics.selectionAsync();
    toggleHideBalance();
  };

  const firstName = userName ? userName.split(" ")[0] : "Investidor";

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader
        title={`Olá, ${firstName}`}
        subtitle="Resumo do Mercado"
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
        contentContainerClassName="pb-10 pt-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isContentLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Patrimônio */}
        <Animated.View
          entering={cardEntering}
          className="mx-5 mb-8 bg-surface border border-border rounded-3xl p-6 overflow-hidden relative"
        >
          {/* Elementos decorativos de fundo (halo sutil da marca) */}
          <View className="absolute -right-10 -top-10 w-32 h-32 rounded-full bg-accentMuted" />
          <View className="absolute -left-8 -bottom-8 w-24 h-24 rounded-full bg-accentMuted" />

          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-elevated rounded-full justify-center items-center mr-2">
                <Wallet size={16} color={t.accent.neon} />
              </View>
              <Text className="text-textSecondary text-sm font-medium">
                Patrimônio Total
              </Text>
            </View>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={toggleBalance}
                accessibilityLabel={
                  showBalance ? "Ocultar saldo" : "Mostrar saldo"
                }
                accessibilityRole="button"
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {showBalance ? (
                  <Eye size={20} color={t.text.primary} />
                ) : (
                  <EyeOff size={20} color={t.text.primary} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-textPrimary text-4xl font-bold tracking-tight mb-3">
            {showBalance ? `R$ ${totalNetWorth.toFixed(2)}` : "R$ •••••••"}
          </Text>

          {walletPerformance !== null && (
            <View className="flex-row items-center mt-1">
              <View
                className={`px-2 py-1 rounded-full flex-row items-center ${
                  walletPerformance >= 0 ? "bg-success/15" : "bg-danger/15"
                }`}
              >
                {walletPerformance >= 0 ? (
                  <TrendingUp size={14} color={t.semantic.success} />
                ) : (
                  <TrendingDown size={14} color={t.semantic.danger} />
                )}
                <Text
                  className={`text-xs font-bold ml-1 ${
                    walletPerformance >= 0 ? "text-success" : "text-danger"
                  }`}
                >
                  {walletPerformance >= 0 ? "+" : ""}
                  {walletPerformance.toFixed(2)}%
                </Text>
              </View>
              <Text className="text-textTertiary text-xs ml-2">
                rentabilidade da carteira
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Quick Actions */}
        <Animated.View
          entering={listItemEntering(1)}
          className="flex-row justify-between px-6 mb-8"
        >
          <QuickAction
            Icon={TrendingUp}
            label="Investimentos"
            onPress={() =>
              // Sem o destino da aba, o TopTab caía sempre em "Carteira"
              (navigation as any).navigate("Finanças", { screen: "Carteira" })
            }
          />
          <QuickAction
            Icon={ArrowLeftRight}
            label="Extratos"
            onPress={() =>
              (navigation as any).navigate("Finanças", { screen: "Extrato" })
            }
          />
          <QuickAction
            Icon={ChartPie}
            label="Relatórios"
            onPress={() => navigation.navigate("Relatórios" as never)}
          />
          <QuickAction
            Icon={Sparkles}
            label="Assistente"
            onPress={() => navigation.navigate("IA Assist" as never)}
            isNew
          />
        </Animated.View>

        {/* Destaques do Mercado (Favoritos) */}
        <Animated.View entering={listItemEntering(2)} className="mb-8">
          <Text className="px-5 text-lg font-bold text-textPrimary mb-4">
            {favorites.length > 0 ? "Favoritados" : "Mercado Agora"}
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

        {/* Notícias */}
        <Animated.View entering={listItemEntering(3)} className="px-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-textPrimary">
              Radar de Notícias
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notícias" as never)}
            >
              <Text className="text-primary font-bold text-sm">Ver Mais</Text>
            </TouchableOpacity>
          </View>

          {recentNews.map((article, index) => (
            <TouchableOpacity
              key={index}
              className="bg-surface rounded-2xl p-4 mb-3 flex-row items-center border border-border"
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
              <View className="w-10 h-10 bg-background rounded-full justify-center items-center">
                <ChevronRight size={18} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Modal de Detalhes do Indicador na Home */}
      {selectedIndicator && (
        <CustomModal
          visible={!!selectedIndicator}
          onClose={() => setSelectedIndicator(null)}
        >
          <ScrollView
            contentContainerClassName="p-6"
            showsVerticalScrollIndicator={false}
          >
            <View className="w-14 h-1.5 bg-border rounded-full self-center mb-6" />
            <View className="items-center justify-center mb-6 border-b border-border pb-4">
              <Text className="text-2xl font-bold text-textPrimary text-center">
                {selectedIndicator.name}
              </Text>
            </View>

            {isCurrencyData(selectedIndicator) ? (
              <View className="flex-row justify-around items-center mb-8 bg-elevated p-5 rounded-2xl border border-border">
                <View className="items-center">
                  <Text className="text-xs text-textSecondary mb-1 font-bold uppercase tracking-wider">
                    Compra
                  </Text>
                  <Text className="text-2xl font-bold text-textPrimary">
                    R$ {selectedIndicator.buy.toFixed(2)}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="items-center mb-6">
                <Text className="text-4xl font-bold text-textPrimary tracking-tighter">
                  {(selectedIndicator.points || 0).toLocaleString("pt-BR")} pts
                </Text>
              </View>
            )}

            <View className="items-center mb-6">
              <View
                className={`px-4 py-2 rounded-full flex-row items-center ${selectedIndicator.variation >= 0 ? "bg-success/15" : "bg-danger/15"}`}
              >
                {selectedIndicator.variation >= 0 ? (
                  <ArrowUpRight size={18} color={t.semantic.success} />
                ) : (
                  <ArrowDownRight size={18} color={t.semantic.danger} />
                )}
                <Text
                  className={`text-lg font-bold ml-1 ${selectedIndicator.variation >= 0 ? "text-success" : "text-danger"}`}
                >
                  {Math.abs(selectedIndicator.variation).toFixed(2)}% (Hoje)
                </Text>
              </View>
            </View>

            {isCurrencyData(selectedIndicator) && (
              <HistoricalChart currencyCode={selectedIndicator.code} />
            )}
          </ScrollView>
        </CustomModal>
      )}

      <AssistantFAB />
    </View>
  );
}

function QuickAction({
  Icon,
  label,
  onPress,
  isNew,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
  isNew?: boolean;
}) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={pressStyle}>
      <TouchableOpacity
        className="items-center"
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={label}
        accessibilityRole="button"
        activeOpacity={0.7}
      >
        <View className="w-14 h-14 bg-surface rounded-2xl justify-center items-center border border-border mb-2">
          <Icon size={24} color={colors.primary} />
          {isNew && (
            <View className="absolute -top-2 -right-2 bg-secondary px-1.5 py-0.5 rounded-full border border-surface">
              <Text className="text-[8px] font-bold text-primaryDark">IA</Text>
            </View>
          )}
        </View>
        <Text className="text-xs font-medium text-textSecondary">{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
