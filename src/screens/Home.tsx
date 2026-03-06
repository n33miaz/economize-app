import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { Indicator, isCurrencyData } from "../services/api";
import { colors } from "../theme/colors";
import useNewsData from "../hooks/useNewsData";
import { useIndicatorStore } from "../store/indicatorStore";
import { useAuthStore } from "../store/authStore";
import { useBankStore } from "../store/bankStore";
import { useWalletStore } from "../store/walletStore";

import HighlightCard from "../components/HighlightCard";
import Skeleton from "../components/Skeleton";

const HIGHLIGHT_ITEMS = ["USD", "EUR", "BTC", "IBOVESPA"];

export default function Home() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
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

  // Cálculos de Patrimônio
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

  const highlights: Indicator[] = useMemo(() => {
    return indicators.filter(
      (item) =>
        HIGHLIGHT_ITEMS.includes(item.code) ||
        HIGHLIGHT_ITEMS.includes(item.name),
    );
  }, [indicators]);

  const recentNews = useMemo(() => (news ? news.slice(0, 3) : []), [news]);
  const isContentLoading = indicatorsLoading || newsLoading;

  const toggleBalance = () => {
    Haptics.selectionAsync();
    setShowBalance(!showBalance);
  };

  return (
    <View className="flex-1 bg-background">
      {/* Header Premium Integrado */}
      <View
        className="bg-primaryDark px-5 pb-6 rounded-b-[32px] shadow-lg z-10"
        style={{ paddingTop: insets.top + 20 }}
      >
        <View className="flex-row justify-between items-center mb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-white/10 rounded-full justify-center items-center mr-3 border border-white/20">
              <Ionicons name="person" size={20} color="#FFF" />
            </View>
            <View>
              <Text className="text-white/70 text-sm font-regular">Olá,</Text>
              <Text className="text-white text-lg font-bold">
                {userName || "Investidor"}
              </Text>
            </View>
          </View>
          <View className="flex-row gap-4">
            <TouchableOpacity onPress={toggleBalance}>
              <Ionicons
                name={showBalance ? "eye-outline" : "eye-off-outline"}
                size={24}
                color="#FFF"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notícias" as never)}
            >
              <Ionicons name="notifications-outline" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        <View>
          <Text className="text-white/70 text-sm font-medium mb-1">
            Patrimônio Total
          </Text>
          <Text className="text-white text-3xl font-bold tracking-tight">
            {showBalance ? `R$ ${totalNetWorth.toFixed(2)}` : "R$ •••••••"}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1 -mt-4"
        contentContainerClassName="pb-10 pt-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isContentLoading}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        {/* Quick Actions */}
        <View className="flex-row justify-between px-6 mb-8">
          <QuickAction
            icon="wallet-outline"
            label="Carteira"
            onPress={() => navigation.navigate("Carteira" as never)}
          />
          <QuickAction
            icon="receipt-outline"
            label="Extrato"
            onPress={() => navigation.navigate("Open Finance" as never)}
          />
          <QuickAction
            icon="sparkles-outline"
            label="IA Assist"
            onPress={() => navigation.navigate("IA Assist" as never)}
            isNew
          />
          <QuickAction
            icon="swap-horizontal-outline"
            label="Câmbio"
            onPress={() => navigation.navigate("Moedas" as never)}
          />
        </View>

        {/* Resumo Financeiro */}
        <View className="px-5 mb-8">
          <Text className="text-lg font-bold text-textPrimary mb-4">
            Resumo Financeiro
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1 bg-white p-4 rounded-2xl border border-border shadow-sm">
              <View className="w-8 h-8 bg-blue-50 rounded-full justify-center items-center mb-2">
                <Ionicons
                  name="business-outline"
                  size={16}
                  color={colors.primary}
                />
              </View>
              <Text className="text-textSecondary text-xs mb-1">
                Conta Corrente
              </Text>
              <Text className="text-textPrimary font-bold text-base">
                {showBalance ? `R$ ${bankBalance.toFixed(2)}` : "••••••"}
              </Text>
            </View>
            <View className="flex-1 bg-white p-4 rounded-2xl border border-border shadow-sm">
              <View className="w-8 h-8 bg-green-50 rounded-full justify-center items-center mb-2">
                <Ionicons
                  name="trending-up-outline"
                  size={16}
                  color={colors.success}
                />
              </View>
              <Text className="text-textSecondary text-xs mb-1">
                Investimentos
              </Text>
              <Text className="text-textPrimary font-bold text-base">
                {showBalance ? `R$ ${walletBalance.toFixed(2)}` : "••••••"}
              </Text>
            </View>
          </View>
        </View>

        {/* Destaques do Mercado */}
        <View className="mb-8">
          <Text className="px-5 text-lg font-bold text-textPrimary mb-4">
            Mercado Agora
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
                  />
                ))}
          </ScrollView>
        </View>

        {/* Notícias */}
        <View className="px-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-textPrimary">
              Radar Financeiro
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notícias" as never)}
            >
              <Text className="text-primary font-bold text-sm">Ver tudo</Text>
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
    </View>
  );
}

// Componente Auxiliar para Ações Rápidas
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
