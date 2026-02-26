import React, { useEffect, useMemo, useCallback } from "react";
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

import { Indicator, isCurrencyData } from "../services/api";
import { colors } from "../theme/colors";
import useNewsData from "../hooks/useNewsData";
import { useIndicatorStore } from "../store/indicatorStore";
import HighlightCard from "../components/HighlightCard";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import * as Haptics from "expo-haptics";

const HIGHLIGHT_ITEMS = ["USD", "EUR", "JPY", "GBP"];

export default function Home() {
  const navigation = useNavigation();
  const {
    indicators,
    loading: indicatorsLoading,
    fetchIndicators,
  } = useIndicatorStore();

  const { articles: news, loading: newsLoading, fetchNews } = useNewsData();

  useEffect(() => {
    fetchIndicators();
    fetchNews();
  }, [fetchIndicators, fetchNews]);

  const highlights: Indicator[] = useMemo(() => {
    const filtered = indicators
      .filter(isCurrencyData)
      .filter((currency) => HIGHLIGHT_ITEMS.includes(currency.code));

    const uniqueMap = new Map();
    filtered.forEach((item) => {
      if (!uniqueMap.has(item.code)) uniqueMap.set(item.code, item);
    });

    return Array.from(uniqueMap.values());
  }, [indicators]);

  const recentNews = useMemo(() => (news ? news.slice(0, 4) : []), [news]);
  const isContentLoading = indicatorsLoading || newsLoading;

  const onRefresh = useCallback(async () => {
    await fetchIndicators();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fetchIndicators]);

  return (
    <PageContainer>
      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10 pt-5"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isContentLoading}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
      >
        {/* Seção de Destaques */}
        <View className="mb-8">
          <Text className="px-5 text-lg font-bold text-slate-800 mb-4">
            Destaques do Mercado
          </Text>

          {isContentLoading && highlights.length === 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-4"
            >
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  className="bg-white rounded-2xl p-5 mx-2 shadow-sm border border-gray-100 min-w-[150px]"
                >
                  <View className="flex-row items-center mb-3">
                    <Skeleton width={36} height={36} borderRadius={18} />
                    <Skeleton width={60} height={14} className="ml-2" />
                  </View>
                  <Skeleton width={100} height={28} className="mb-2" />
                  <Skeleton width={70} height={20} />
                </View>
              ))}
            </ScrollView>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerClassName="px-4"
            >
              {highlights.map((item, index) => (
                <HighlightCard
                  key={`${item.id}-${index}`}
                  title={item.code}
                  value={item.buy}
                  variation={item.variation}
                  iconName={
                    item.code === "BTC" ? "logo-bitcoin" : "cash-outline"
                  }
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Seção de Notícias */}
        <View className="px-5">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-slate-800">
              Giro de Notícias
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Notícias" as never)}
              className="flex-row items-center"
            >
              <Text className="text-primary font-bold text-sm mr-1">
                Ver tudo
              </Text>
              <Ionicons name="arrow-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>

          {recentNews.length > 0
            ? recentNews.map((article, index) => (
                <TouchableOpacity
                  key={`${article.url}-${index}`}
                  className="bg-white rounded-xl p-4 mb-3 flex-row items-center shadow-sm border border-gray-100"
                  onPress={() => Linking.openURL(article.url)}
                  activeOpacity={0.7}
                >
                  <View className="flex-1 mr-3">
                    <Text className="text-primary text-[10px] font-bold uppercase mb-1">
                      {article.source.name}
                    </Text>
                    <Text
                      className="text-slate-800 text-sm font-bold leading-5"
                      numberOfLines={2}
                    >
                      {article.title}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#CBD5E1" />
                </TouchableOpacity>
              ))
            : !isContentLoading && (
                <Text className="text-center text-gray-400 mt-5">
                  Nenhuma notícia no momento.
                </Text>
              )}
        </View>
      </ScrollView>
    </PageContainer>
  );
}
