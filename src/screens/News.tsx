import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { useTheme } from "../theme/ThemeProvider";
import NewsCard from "../components/NewsCard";
import Skeleton from "../components/Skeleton";
import useNewsData from "../hooks/useNewsData";
import { NewsArticle } from "../services/api";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";
import ErrorState from "../components/ErrorState";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { padRowsForColumns } from "../utils/layout";

export default function News() {
  const t = useTheme();
  // Notícia é card com imagem: numa coluna de 1180 px a foto vira faixa
  // panorâmica e cabem três manchetes na tela inteira
  const { columns } = useBreakpoint();
  const { articles, loading, error, fetchNews } = useNewsData();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  }, [fetchNews]);

  // Memoizado porque o preenchimento da última linha devolve array NOVO
  // sempre que sobra vaga: inline, a `data` da FlatList trocava de identidade
  // a cada render do pai
  const rows = useMemo(
    () => padRowsForColumns(articles ?? [], columns),
    [articles, columns],
  );

  const renderNewsCard = useCallback(
    ({ item }: { item: NewsArticle | null }) => (
      // Buraco de fim de linha: mantém a última manchete com a largura das
      // outras em vez de esticar por toda a grade. O `flex: 1` só vale na
      // grade — numa coluna só ele é filho flexível de contêiner sem altura.
      <View style={columns > 1 ? { flex: 1 } : undefined}>
        {item && <NewsCard article={item} />}
      </View>
    ),
    [columns],
  );

  return (
    <PageContainer>
      <ScreenHeader title="Notícias" subtitle="Fique por dentro do mercado" />

      {loading && !articles?.length ? (
        // Esqueletos com a geometria do NewsCard (imagem, fonte + data, título)
        <View className="pt-3">
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              className="bg-surface rounded-2xl mb-4 mx-4 border border-border overflow-hidden"
            >
              <Skeleton width="100%" height={160} borderRadius={0} />
              <View className="p-4">
                <View className="flex-row justify-between items-center mb-3">
                  <Skeleton width={96} height={12} />
                  <Skeleton width={48} height={12} />
                </View>
                <Skeleton width="100%" height={18} className="mb-2" />
                <Skeleton width="70%" height={18} />
              </View>
            </View>
          ))}
        </View>
      ) : error && !articles?.length ? (
        <ErrorState message={error} onRetry={fetchNews} />
      ) : (
        <FlatList
          // `numColumns` não muda em voo: a chave remonta a lista no breakpoint
          key={`grade-${columns}`}
          data={rows}
          numColumns={columns}
          columnWrapperStyle={
            // O NewsCard já traz `mx-4`; com duas colunas as margens internas
            // se encostam e formam o gutter, sem gap por cima
            columns > 1 ? { alignItems: "flex-start" } : undefined
          }
          keyExtractor={(item, index) =>
            item?.url ? `${item.url}-${index}` : `news-${index}`
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[t.accent.neon]}
              tintColor={t.accent.neon}
            />
          }
          renderItem={renderNewsCard}
          contentContainerClassName="pt-3 pb-5"
          ListEmptyComponent={
            <View className="flex-1 justify-center items-center p-5 mt-10">
              <Text className="text-textSecondary text-base font-regular mb-4">
                {error
                  ? "Não foi possível carregar as notícias."
                  : "Nenhuma notícia encontrada."}
              </Text>
              <TouchableOpacity
                className="bg-primary px-6 py-3 rounded-lg"
                onPress={fetchNews}
                accessibilityLabel="Atualizar notícias"
                accessibilityRole="button"
              >
                <Text className="text-primaryDark font-bold">Atualizar</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </PageContainer>
  );
}
