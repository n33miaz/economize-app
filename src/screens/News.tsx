import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { colors } from "../theme/colors";
import NewsCard from "../components/NewsCard";
import useNewsData from "../hooks/useNewsData";
import { NewsArticle } from "../services/api";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import ErrorState from "../components/ErrorState";

export default function News() {
  const { articles, loading, error, fetchNews } = useNewsData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  }, [fetchNews]);

  const renderNewsCard = useCallback(
    ({ item }: { item: NewsArticle }) => <NewsCard article={item} />,
    [],
  );

  return (
    <PageContainer>
      <ScreenHeader title="Notícias" subtitle="Fique por dentro do mercado" />

      {loading && !articles?.length ? (
        <View className="flex-1 justify-center items-center p-5">
          <ActivityIndicator size="large" color={colors.primary} />
          <Text className="mt-3 text-gray-500 font-regular">
            Carregando notícias...
          </Text>
        </View>
      ) : error && !articles?.length ? (
        <ErrorState message={error} onRetry={fetchNews} />
      ) : (
        <FlatList
          data={articles}
          keyExtractor={(item, index) =>
            item.url ? `${item.url}-${index}` : `news-${index}`
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          renderItem={renderNewsCard}
          contentContainerClassName="pt-3 pb-5"
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-5 mt-10">
              <Text className="text-gray-500 text-base font-regular mb-4">
                {error
                  ? "Não foi possível carregar as notícias."
                  : "Nenhuma notícia encontrada."}
              </Text>
              <TouchableOpacity
                className="bg-primary px-6 py-3 rounded-lg"
                onPress={fetchNews}
              >
                <Text className="text-white font-bold">Atualizar</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </PageContainer>
  );
}
