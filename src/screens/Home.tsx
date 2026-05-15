import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";

import { Indicator, isCurrencyData, isIndexData } from "../services/api";
import { colors } from "../theme/colors";
import useNewsData from "../hooks/useNewsData";
import { useAuthStore } from "../store/authStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";
import { useFavoritesStore } from "../store/favoritesStore";

import HighlightCard from "../components/HighlightCard";
import Skeleton from "../components/Skeleton";
import ScreenHeader from "../components/ScreenHeader";
import CustomModal from "../components/CustomModal";
import HistoricalChart from "../components/HistoricalChart";

export default function Home() {
  const navigation = useNavigation();
  const [showBalance, setShowBalance] = useState(true);
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
    return walletTxs.reduce((total, t) => {
      const indicator = indicators.find((i) => i.code === t.assetCode);
      const currentPrice = indicator ? indicator.buy : t.priceAtTransaction;
      return total + t.quantity * currentPrice;
    }, 0);
  }, [walletTxs, indicators]);

  const totalNetWorth = bankBalance + walletBalance;

  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(
    null,
  );

  // Lógica de Favoritos Dinâmicos
  const highlights: Indicator[] = useMemo(() => {
    if (favorites.length > 0) {
      return indicators.filter((item) => favorites.includes(item.id));
    }

    const defaultCodes = ["USD", "EUR", "GBP", "BTC", "IBOVESPA"];
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
    setShowBalance(!showBalance);
  };

  const firstName = userName ? userName.split(" ")[0] : "Investidor";

  return (
    <View className="flex-1 bg-background">
      <ScreenHeader title={`Olá, ${firstName}`} subtitle="Resumo do Mercado" />

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
        <View
          className="mx-5 mb-8 bg-primaryDark rounded-3xl p-6 shadow-lg shadow-blue-900/20 overflow-hidden"
          style={{ position: "relative" }}
        >
          {/* Elementos decorativos de fundo */}
          <View
            style={{
              position: "absolute",
              right: -40,
              top: -40,
              width: 128,
              height: 128,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 64,
            }}
          />
          <View
            style={{
              position: "absolute",
              left: -30,
              bottom: -30,
              width: 96,
              height: 96,
              backgroundColor: "rgba(255,255,255,0.05)",
              borderRadius: 48,
            }}
          />

          <View className="flex-row justify-between items-center mb-4">
            <View className="flex-row items-center">
              <View className="w-8 h-8 bg-white/10 rounded-full justify-center items-center mr-2">
                <Ionicons name="wallet-outline" size={16} color="#FFF" />
              </View>
              <Text className="text-white/80 text-sm font-medium">
                Patrimônio Total
              </Text>
            </View>
            <View className="flex-row gap-4">
              <TouchableOpacity
                onPress={toggleBalance}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name={showBalance ? "eye-outline" : "eye-off-outline"}
                  size={22}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </View>

          <Text className="text-white text-4xl font-bold tracking-tight mb-3">
            {showBalance ? `R$ ${totalNetWorth.toFixed(2)}` : "R$ •••••••"}
          </Text>

          <View className="flex-row items-center mt-1">
            <View className="bg-green-500/20 px-2 py-1 rounded-md flex-row items-center">
              <Ionicons name="trending-up" size={14} color="#4ADE80" />
              {/* TODO: Adicionar lógica real */}
              <Text className="text-green-400 text-xs font-bold ml-1">
                +2.4%
              </Text>
            </View>
            <Text className="text-white/60 text-xs ml-2">
              em relação ao mês passado
            </Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="flex-row justify-between px-6 mb-8">
          <QuickAction
            icon="wallet-outline"
            label="Carteira"
            onPress={() => navigation.navigate("Finanças" as never)}
          />
          <QuickAction
            icon="receipt-outline"
            label="Extrato"
            onPress={() => navigation.navigate("Finanças" as never)}
          />
          <QuickAction
            icon="sparkles-outline"
            label="Assistente"
            onPress={() => navigation.navigate("IA Assist" as never)}
            isNew
          />
          <QuickAction
            icon="swap-horizontal-outline"
            label="Câmbio"
            onPress={() => navigation.navigate("Indicadores" as never)}
          />
        </View>

        {/* Destaques do Mercado (Favoritos) */}
        <View className="mb-8">
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
                    className="bg-white rounded-2xl p-5 mx-2 border border-border min-w-[150px]"
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
                    iconName={
                      item.type === "crypto"
                        ? "logo-bitcoin"
                        : item.type === "index"
                          ? "stats-chart"
                          : "cash-outline"
                    }
                    onPress={() => setSelectedIndicator(item)}
                  />
                ))}
          </ScrollView>
        </View>

        {/* Notícias */}
        <View className="px-5">
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
              className="bg-white rounded-2xl p-4 mb-3 flex-row items-center border border-border shadow-sm"
              onPress={() => Linking.openURL(article.url)}
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
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </View>
            </TouchableOpacity>
          ))}
        </View>
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
            <View className="w-14 h-1.5 bg-slate-200 rounded-full self-center mb-6" />
            <View className="items-center justify-center mb-6 border-b border-slate-100 pb-4">
              <Text className="text-2xl font-bold text-slate-800 text-center">
                {selectedIndicator.name}
              </Text>
            </View>

            {isCurrencyData(selectedIndicator) ? (
              <View className="flex-row justify-around items-center mb-8 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">
                    Compra
                  </Text>
                  <Text className="text-2xl font-bold text-slate-800">
                    R$ {selectedIndicator.buy.toFixed(2)}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="items-center mb-6">
                <Text className="text-4xl font-bold text-slate-800 tracking-tighter">
                  {(selectedIndicator.points || 0).toLocaleString("pt-BR")} pts
                </Text>
              </View>
            )}

            <View className="items-center mb-6">
              <View
                className={`px-4 py-2 rounded-full ${selectedIndicator.variation >= 0 ? "bg-green-100" : "bg-red-100"}`}
              >
                <Text
                  className={`text-lg font-bold ${selectedIndicator.variation >= 0 ? "text-green-700" : "text-red-600"}`}
                >
                  {selectedIndicator.variation > 0 ? "▲" : "▼"}{" "}
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
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  isNew,
}: {
  icon: any;
  label: string;
  onPress: () => void;
  isNew?: boolean;
}) {
  return (
    <TouchableOpacity
      className="items-center"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="w-14 h-14 bg-white rounded-2xl justify-center items-center shadow-sm border border-border mb-2">
        <Ionicons name={icon} size={24} color={colors.primaryDark} />
        {isNew && (
          <View className="absolute -top-2 -right-2 bg-secondary px-1.5 py-0.5 rounded-md border border-white">
            <Text className="text-[8px] font-bold text-white">IA</Text>
          </View>
        )}
      </View>
      <Text className="text-xs font-medium text-textSecondary">{label}</Text>
    </TouchableOpacity>
  );
}
