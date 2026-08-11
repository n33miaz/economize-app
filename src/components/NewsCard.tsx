import React, { useMemo, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, Linking } from "react-native";
import { Newspaper } from "lucide-react-native";

import { NewsArticle } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";

interface NewsCardProps {
  article: NewsArticle;
}

const NewsCard = React.memo(({ article }: NewsCardProps) => {
  const t = useTheme();

  const handlePress = useCallback(async () => {
    const supported = await Linking.canOpenURL(article.url);
    if (supported) {
      await Linking.openURL(article.url);
    }
  }, [article.url]);

  const formattedDate = useMemo(() => {
    if (!article.publishedAt) return "";
    return new Date(article.publishedAt).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });
  }, [article.publishedAt]);

  return (
    <TouchableOpacity
      className="bg-surface rounded-2xl mb-4 mx-4 border border-border overflow-hidden"
      onPress={handlePress}
      accessibilityLabel={`Abrir notícia: ${article.title}`}
      accessibilityRole="button"
      activeOpacity={0.8}
    >
      {article.urlToImage ? (
        <Image
          source={{ uri: article.urlToImage }}
          className="w-full h-40 bg-elevated"
          resizeMode="cover"
        />
      ) : (
        // Placeholder local: o serviço de imagem fake saiu do ar e o app não
        // deve depender de rede para desenhar um fallback
        <View className="w-full h-40 bg-elevated justify-center items-center">
          <Newspaper size={40} color={t.text.tertiary} />
        </View>
      )}
      <View className="p-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-primary font-bold text-xs uppercase tracking-wider">
            {article.source.name}
          </Text>
          <Text className="text-textTertiary text-xs font-regular">
            {formattedDate}
          </Text>
        </View>

        <Text
          className="text-lg font-bold text-textPrimary leading-6 mb-2"
          numberOfLines={3}
        >
          {article.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

NewsCard.displayName = "NewsCard";

export default NewsCard;
