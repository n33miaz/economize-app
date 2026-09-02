import React from "react";
import { Linking, Text, TouchableOpacity, View } from "react-native";
import ExternalLink from "lucide-react-native/dist/esm/icons/external-link";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import type { NewsArticle } from "../services/api";

/**
 * As manchetes que falam DESTE ativo (EC-103).
 *
 * <p>Sai do radar que a Home já carregou: nenhuma requisição nova, e por isso
 * mesmo pode não haver nada — o noticiário do dia raramente cita todo papel.
 * Sem manchete relacionada, o componente não desenha nada: uma seção vazia
 * dizendo "nenhuma notícia" ocupa espaço para não informar.
 */
export default function AssetNewsList({
  articles,
}: {
  articles: NewsArticle[];
}) {
  const t = useTheme();

  if (articles.length === 0) return null;

  return (
    <View style={{ marginTop: spacing[6] }}>
      <Text
        style={{
          color: t.text.tertiary,
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 1.2,
          textTransform: "uppercase",
          marginBottom: spacing[2],
        }}
      >
        No noticiário
      </Text>
      {articles.map((article) => (
        <TouchableOpacity
          key={article.url}
          onPress={() => Linking.openURL(article.url)}
          accessibilityRole="link"
          accessibilityLabel={`${article.title}. Abrir em ${article.source.name}`}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: t.background.elevated,
            borderRadius: radius.xl,
            borderWidth: 1,
            borderColor: t.border.subtle,
            padding: spacing[3],
            marginBottom: spacing[2],
            minHeight: 44,
          }}
        >
          <View style={{ flex: 1, paddingRight: spacing[2] }}>
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 10,
                fontWeight: "700",
                textTransform: "uppercase",
              }}
            >
              {article.source.name}
            </Text>
            <Text
              numberOfLines={2}
              style={{
                color: t.text.primary,
                fontSize: 13,
                lineHeight: 18,
                marginTop: 2,
              }}
            >
              {article.title}
            </Text>
          </View>
          <ExternalLink size={14} color={t.text.tertiary} />
        </TouchableOpacity>
      ))}
    </View>
  );
}
