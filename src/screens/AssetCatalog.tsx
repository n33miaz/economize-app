import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import SearchX from "lucide-react-native/dist/esm/icons/search-x";

import { useBreakpoint } from "../hooks/useBreakpoint";
import { useDebounce } from "../hooks/useDebounce";
import { padRowsForColumns } from "../utils/layout";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import IndicatorCard from "../components/IndicatorCard";
import IndicatorDetailSheet from "../components/IndicatorDetailSheet";
import PageContainer from "../components/PageContainer";
import SearchBar from "../components/SearchBar";
import Skeleton from "../components/Skeleton";
import ErrorState from "../components/ErrorState";
import {
  toggleFavoriteWithSnapshot,
  useFavoritesStore,
} from "../store/favoritesStore";
import { useCatalogStore } from "../store/catalogStore";
import type { CatalogItem, Indicator } from "../services/api";

/** Os recortes que o servidor conhece, na ordem em que fazem sentido olhar. */
const SEGMENTOS: { id: string; label: string }[] = [
  { id: "", label: "Tudo" },
  { id: "acoes", label: "Ações" },
  { id: "fiis", label: "FIIs" },
  { id: "etfs", label: "ETFs" },
  { id: "bdrs", label: "BDRs" },
  { id: "indices", label: "Índices" },
  { id: "moedas", label: "Moedas" },
  { id: "cripto", label: "Cripto" },
];

/**
 * O catálogo ampliado em rolagem infinita (EC-099).
 *
 * <p>As abas de Moedas e Índices são listas CURADAS e curtas — moedas do dia,
 * seis índices escolhidos. Esta é a outra coisa: o catálogo inteiro, ordenado
 * pelo servidor (favoritos do usuário primeiro, depois relevância de mercado),
 * paginado por cursor.
 *
 * <p>Filtro e busca vão para o servidor, e não para um `filter` em memória: o
 * app nunca tem a lista toda: é justamente isso que a paginação significa.
 */
export default function AssetCatalog() {
  const t = useTheme();
  const { columns } = useBreakpoint();

  const items = useCatalogStore((s) => s.items);
  const page = useCatalogStore((s) => s.page);
  const filters = useCatalogStore((s) => s.filters);
  const isLoading = useCatalogStore((s) => s.isLoading);
  const isLoadingMore = useCatalogStore((s) => s.isLoadingMore);
  const error = useCatalogStore((s) => s.error);
  const setFilters = useCatalogStore((s) => s.setFilters);
  const fetchCatalog = useCatalogStore((s) => s.fetch);
  const fetchMore = useCatalogStore((s) => s.fetchMore);

  const favoriteIds = useFavoritesStore((s) => s.favorites);
  const isFavorite = useFavoritesStore((s) => s.isFavorite);

  const [busca, setBusca] = useState("");
  const [selecionado, setSelecionado] = useState<Indicator | null>(null);
  const [sheetVisivel, setSheetVisivel] = useState(false);

  // 600 ms é o mesmo intervalo da busca das outras listas: aqui cada tecla
  // seria uma consulta paginada nova no servidor
  const buscaAtrasada = useDebounce(busca, 600);

  useEffect(() => {
    setFilters({ q: buscaAtrasada });
  }, [buscaAtrasada, setFilters]);

  // Uma busca por conjunto de filtros. `favoriteIds` entra na dependência
  // porque é ele o componente "do usuário" da ordenação do servidor
  useEffect(() => {
    fetchCatalog(favoriteIds);
  }, [filters.segment, filters.q, filters.sort, favoriteIds, fetchCatalog]);

  const rows = useMemo(
    () => padRowsForColumns(items, columns),
    [items, columns],
  );

  const abrir = useCallback((item: CatalogItem) => {
    setSelecionado(item);
    setSheetVisivel(true);
  }, []);

  const rodape = () => {
    if (isLoadingMore) {
      return (
        <View style={{ paddingVertical: spacing[5], alignItems: "center" }}>
          <ActivityIndicator size="small" color={t.accent.neon} />
        </View>
      );
    }
    // O fim só é anunciado quando ele existe de verdade: enquanto há mais
    // página, a lista não deve sugerir que acabou
    if (page && !page.hasMore && items.length > 0) {
      return (
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            textAlign: "center",
            paddingVertical: spacing[5],
          }}
        >
          {items.length} de {page.totalMatched} ativos
        </Text>
      );
    }
    return <View style={{ height: spacing[5] }} />;
  };

  return (
    <PageContainer>
      <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[2] }}>
        <SearchBar
          value={busca}
          onChangeText={setBusca}
          onClear={() => setBusca("")}
          loading={isLoading && busca.length > 0}
          placeholder="Buscar por código ou nome"
          accessibilityLabel="Buscar no catálogo"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[5],
          paddingVertical: spacing[3],
          gap: spacing[2],
        }}
      >
        {SEGMENTOS.map((segmento) => {
          const ativo = filters.segment === segmento.id;
          return (
            <TouchableOpacity
              key={segmento.id || "tudo"}
              onPress={() => setFilters({ segment: segmento.id })}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel={`Filtrar por ${segmento.label}`}
              style={{
                paddingHorizontal: spacing[4],
                height: 34,
                justifyContent: "center",
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: ativo ? t.accent.neon : t.border.subtle,
                backgroundColor: ativo
                  ? t.accent.neonMuted
                  : t.background.elevated,
              }}
            >
              <Text
                style={{
                  color: ativo ? t.accent.neon : t.text.secondary,
                  fontSize: 12,
                  fontWeight: "700",
                }}
              >
                {segmento.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {isLoading && items.length === 0 ? (
        <View style={{ paddingHorizontal: spacing[5] }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={{ marginBottom: spacing[3] }}>
              <Skeleton height={68} borderRadius={radius.xl} />
            </View>
          ))}
        </View>
      ) : error && items.length === 0 ? (
        <ErrorState message={error} onRetry={() => fetchCatalog(favoriteIds)} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item, index) => item?.id ?? `vazio-${index}`}
          numColumns={columns}
          key={`catalogo-${columns}`}
          contentContainerStyle={{ paddingHorizontal: spacing[5] }}
          renderItem={({ item }) => (
            <View style={columns > 1 ? { flex: 1 } : undefined}>
              {item && (
                <IndicatorCard
                  id={item.id}
                  name={item.name}
                  code={item.code}
                  type={item.type}
                  // UNQUOTED chega com preço nulo, e o card já sabe desenhar
                  // traço: o ativo aparece na lista mesmo sem cotação
                  value={item.buy}
                  variation={item.variation}
                  isFavorite={isFavorite(item.id)}
                  onPress={() => abrir(item)}
                  onToggleFavorite={() => toggleFavoriteWithSnapshot(item)}
                />
              )}
            </View>
          )}
          // Meia tela de antecedência: a próxima página chega antes de o
          // usuário encostar no fim, que é o que faz a rolagem parecer não ter
          onEndReachedThreshold={0.5}
          onEndReached={() => fetchMore(favoriteIds)}
          ListFooterComponent={rodape}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => fetchCatalog(favoriteIds)}
              tintColor={t.accent.neon}
            />
          }
          ListEmptyComponent={
            <View style={{ alignItems: "center", paddingVertical: spacing[8] }}>
              <SearchX size={36} color={t.text.tertiary} />
              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 13,
                  marginTop: spacing[3],
                  textAlign: "center",
                }}
              >
                Nenhum ativo com esse filtro.
              </Text>
            </View>
          }
        />
      )}

      {/* O mesmo sheet das outras listas: um ativo é um ativo em qualquer tela */}
      <IndicatorDetailSheet
        indicator={selecionado}
        visible={sheetVisivel}
        onClose={() => setSheetVisivel(false)}
      />
    </PageContainer>
  );
}
