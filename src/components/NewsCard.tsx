import React, { useMemo, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, Linking } from "react-native";
import { NewsArticle } from "../services/api";

interface NewsCardProps {
  article: NewsArticle;
}

const NewsCard = React.memo(({ article }: NewsCardProps) => {
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
      onPress={handlePress}
      activeOpacity={0.8}
      className="bg-white rounded-2xl mb-4 mx-4 shadow-sm border border-gray-100 overflow-hidden"
    >
      <Image
        source={{
          uri:
            article.urlToImage ||
            "https://via.placeholder.com/400x200?text=News",
        }}
        className="w-full h-40 bg-gray-200"
        resizeMode="cover"
      />
      <View className="p-4">
        <View className="flex-row justify-between items-center mb-2">
          <Text className="text-primary font-bold text-xs uppercase tracking-wider">
            {article.source.name}
          </Text>
          <Text className="text-gray-400 text-xs font-regular">
            {formattedDate}
          </Text>
        </View>

        <Text
          className="text-lg font-bold text-slate-800 leading-6 mb-2"
          numberOfLines={3}
        >
          {article.title}
        </Text>
      </View>
    </TouchableOpacity>
  );
});

export default NewsCard;
