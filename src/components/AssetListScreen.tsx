import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Keyboard,
} from "react-native";
import * as Haptics from "../utils/haptics";
import Banknote from "lucide-react-native/dist/esm/icons/banknote";
import Bitcoin from "lucide-react-native/dist/esm/icons/bitcoin";
import Search from "lucide-react-native/dist/esm/icons/search";
import SearchX from "lucide-react-native/dist/esm/icons/search-x";
import SlidersHorizontal from "lucide-react-native/dist/esm/icons/sliders-horizontal";
import Star from "lucide-react-native/dist/esm/icons/star";
import TrendingUp from "lucide-react-native/dist/esm/icons/trending-up";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useBreakpoint } from "../hooks/useBreakpoint";
import { useDebounce } from "../hooks/useDebounce";
import { padRowsForColumns } from "../utils/layout";
import { useTheme } from "../theme/ThemeProvider";
import { motion, spacing } from "../theme/ds";
import { softEasingFn, useMotionPresets } from "../theme/motionPresets";
import { Indicator, isCurrencyData, isIndexData } from "../services/api";
import {
  favoriteDisplayItems,
  hasActiveFilters,
  mergeSearchResults,
  sortIndicators,
} from "../utils/indicatorList";
import IndicatorCard from "./IndicatorCard";
import HighlightCard from "./HighlightCard";
import SearchBar from "./SearchBar";
import Skeleton from "./Skeleton";
import PageContainer from "./PageContainer";
import ErrorState from "./ErrorState";
import IndicatorDetailSheet from "./IndicatorDetailSheet";
import AssetFilterSheet from "./AssetFilterSheet";
import {
  toggleFavoriteWithSnapshot,
  useFavoritesStore,
} from "../store/favoritesStore";
import { AssetTab, useIndicatorStore } from "../store/indicatorStore";

interface AssetListScreenProps {
  data: Indicator[];
  emptyMessage: string;
  /** Aba dona da lista: define onde vive o estado de ordenação/filtro. */
  tab: AssetTab;
  symbol?: string;
  title?: string;
  featuredItems?: Indicator[];
}

// Resultado remoto amarrado ao termo que o produziu: sem isso, a resposta de
// um termo antigo se misturava ao filtro local do termo novo e a lista piscava
interface RemoteSearch {
  query: string;
  items: Indicator[];
}

const EMPTY_REMOTE: RemoteSearch = { query: "", items: [] };

export default function AssetListScreen({
  data,
  emptyMessage,
  tab,
  symbol,
  featuredItems = [],
}: AssetListScreenProps) {
  const t = useTheme();
  // Card de ativo é largo e baixo: numa coluna de 1180 px sobra deserto entre
  // o nome e a cotação. Duas colunas encurtam a varredura pela metade
  const { columns, isWide } = useBreakpoint();
  const { listItemEntering, reducedMotion } = useMotionPresets();
  const { loading, error, fetchIndicators } = useIndicatorStore();
  const filters = useIndicatorStore((state) => state.filters[tab]);
  const favoriteSnapshots = useIndicatorStore(
    (state) => state.favoriteSnapshots,
  );
  const { favorites } = useFavoritesStore();

  const [searchText, setSearchText] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Indicator | null>(null);

  const debouncedSearch = useDebounce(searchText, 600);
  const [remoteSearch, setRemoteSearch] = useState<RemoteSearch>(EMPTY_REMOTE);
  const [isSearching, setIsSearching] = useState(false);

  // O toggle de turismo só existe na aba de moedas — o badge não pode acender
  // nas outras por um estado que não muda a lista delas
  const filtersActive = hasActiveFilters(filters, tab === "currencies");

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  useEffect(() => {
    const query = debouncedSearch.trim();
    if (query.length < 2) {
      setRemoteSearch(EMPTY_REMOTE);
      setIsSearching(false);
      return;
    }
    // O usuário digita mais rápido que a rede: a resposta de um termo já
    // abandonado não pode atropelar a busca atual
    let cancelled = false;
    setIsSearching(true);
    useIndicatorStore
      .getState()
      .searchIndicators(query)
      .then((items) => {
        if (cancelled) return;
        setRemoteSearch({ query, items });
        setIsSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch]);

  const trimmedSearch = searchText.trim();

  const filteredData = useMemo(() => {
    if (!trimmedSearch) return data;
    const lowerSearch = trimmedSearch.toLowerCase();
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.code.toLowerCase().includes(lowerSearch) ||
        item.id.toLowerCase().includes(lowerSearch),
    );
  }, [data, trimmedSearch]);

  // Lista final: o filtro local responde a cada tecla e o remoto entra por
  // baixo quando chega — desde que responda exatamente ao termo em tela.
  // A ordenação escolhida vale para a lista normal e para a busca.
  const listData = useMemo(() => {
    let base = filteredData;
    if (
      trimmedSearch.length >= 2 &&
      remoteSearch.query === trimmedSearch &&
      remoteSearch.items.length > 0
    ) {
      base = mergeSearchResults(filteredData, remoteSearch.items);
    }
    return sortIndicators(base, filters.sort);
  }, [filteredData, trimmedSearch, remoteSearch, filters.sort]);

  // Memoizado porque o preenchimento da última linha devolve array NOVO
  // sempre que sobra vaga: inline, a `data` da FlatList trocava de identidade
  // a cada render do pai e a lista inteira se dava por alterada
  const rows = useMemo(
    () => padRowsForColumns(listData, columns),
    [listData, columns],
  );

  const onRefresh = useCallback(async () => {
    await fetchIndicators();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fetchIndicators]);

  const handleToggleFavorite = useCallback(
    (item: Indicator) => {
      // O reflow da lista e da faixa de favoritos anima junto — seco quando
      // o sistema pede menos movimento
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      // Com o objeto em mãos, o toggle também guarda o retrato do ativo —
      // é o que faz um favorito da busca remota aparecer na faixa
      toggleFavoriteWithSnapshot(item);
    },
    [reducedMotion],
  );

  const handleOpenModal = useCallback((item: Indicator) => {
    setSelectedItem(item);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  const handleOpenFilters = useCallback(() => {
    Haptics.selectionAsync();
    Keyboard.dismiss();
    setFilterVisible(true);
  }, []);

  // EC-105: com a tela de Favoritos aposentada, os favoritados da aba moram
  // aqui, numa faixa fixa no topo do conteúdo. Os retratos cobrem quem foi
  // favoritado na busca remota e não existe na lista local; o recorte por
  // tipo mantém moeda na aba de moedas e o resto (índice/cripto) na outra.
  const tabSnapshots = useMemo(
    () =>
      favoriteSnapshots.filter((item) =>
        tab === "currencies" ? isCurrencyData(item) : !isCurrencyData(item),
      ),
    [favoriteSnapshots, tab],
  );

  const favoriteItems = useMemo(
    () => favoriteDisplayItems(data, tabSnapshots, favorites),
    [data, tabSnapshots, favorites],
  );

  // Entrada/saída sutil dos cards favoritados quando a estrela alterna;
  // com "reduzir movimento" o card entra e sai seco
  const favEntering = useMemo(() => {
    if (reducedMotion) return undefined;
    return FadeIn.duration(motion.duration.base).easing(softEasingFn);
  }, [reducedMotion]);

  const favExiting = useMemo(() => {
    if (reducedMotion) return undefined;
    return FadeOut.duration(motion.duration.fast).easing(softEasingFn);
  }, [reducedMotion]);

  const renderHeader = useMemo(() => {
    if (searchText) return null;

    // Mesma régua da Home ("Favoritados" substitui "Mercado agora"): com
    // favoritos na aba, a faixa deles ocupa o lugar dos destaques; sem
    // favoritos, nada de estado vazio — os destaques (quando houver) voltam
    if (favoriteItems.length > 0) {
      return (
        <Animated.View
          entering={favEntering}
          exiting={favExiting}
          // A faixa fura o padding da lista para os cards deslizarem de
          // borda a borda da tela
          className="-mx-5 mt-2 mb-6"
        >
          <View className="flex-row items-center px-5 mb-3">
            <Star size={14} color={t.accent.neon} fill={t.accent.neon} />
            <Text className="text-base font-bold text-textPrimary ml-2">
              Favoritos
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-3"
          >
            {favoriteItems.map((item) => (
              <Animated.View
                key={`fav-${item.id}`}
                entering={favEntering}
                exiting={favExiting}
              >
                <HighlightCard
                  title={item.code || item.name}
                  value={item.points ?? item.buy ?? 0}
                  variation={item.variation}
                  type={item.type}
                  Icon={
                    item.type === "crypto"
                      ? Bitcoin
                      : isIndexData(item)
                        ? TrendingUp
                        : Banknote
                  }
                  onPress={() => handleOpenModal(item)}
                />
              </Animated.View>
            ))}
          </ScrollView>
        </Animated.View>
      );
    }

    if (featuredItems.length > 0) {
      return (
        <View className="mb-6 mt-2">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="px-4"
          >
            {featuredItems.map((item) => (
              <HighlightCard
                key={`highlight-${item.id}`}
                title={item.code || item.name}
                value={item.points || item.buy}
                variation={item.variation}
                type={item.type}
                Icon={
                  item.code === "BTC" || item.id.includes("BTC")
                    ? Bitcoin
                    : TrendingUp
                }
                // Cartão morto era só vitrine — agora abre o mesmo sheet
                onPress={() => handleOpenModal(item)}
              />
            ))}
          </ScrollView>
        </View>
      );
    }

    return null;
  }, [
    searchText,
    favoriteItems,
    featuredItems,
    handleOpenModal,
    favEntering,
    favExiting,
    t,
  ]);

  const renderItem = useCallback(
    ({ item, index }: { item: Indicator | null; index: number }) => {
      // Buraco de fim de linha: sem ele o último ativo ocuparia a grade toda
      // (só acontece com duas colunas — numa coluna nunca sobra vaga)
      if (!item) return <View style={{ flex: 1 }} />;

      let displaySymbol = symbol;
      if (!displaySymbol) {
        // Todo índice é pontuado — não só o IBOVESPA
        displaySymbol = isIndexData(item) ? "pts" : "R$";
      }
      const displayValue = item.points !== undefined ? item.points : item.buy;

      return (
        // O `flex: 1` divide a linha entre as duas colunas; numa coluna só ele
        // seria um filho flexível dentro de contêiner de rolagem sem altura
        <Animated.View
          entering={listItemEntering(index)}
          style={columns > 1 ? { flex: 1 } : undefined}
        >
          <IndicatorCard
            name={item.name}
            id={item.id}
            code={item.code}
            type={item.type}
            value={displayValue}
            variation={item.variation}
            isFavorite={favorites.includes(item.id)}
            onPress={() => handleOpenModal(item)}
            // O card só conhece o id; o retrato precisa do objeto inteiro
            onToggleFavorite={() => handleToggleFavorite(item)}
            symbol={displaySymbol}
          />
        </Animated.View>
      );
    },
    [
      favorites,
      handleToggleFavorite,
      handleOpenModal,
      symbol,
      listItemEntering,
      columns,
    ],
  );

  const renderEmpty = () => {
    if (loading) return null;

    if (trimmedSearch) {
      // Enquanto o servidor ainda procura, não vale cravar "nada encontrado"
      if (isSearching) {
        return (
          <View className="mt-16 items-center px-8">
            <ActivityIndicator size="small" color={t.accent.neon} />
            <Text className="text-textSecondary text-sm text-center mt-3 font-medium">
              Buscando “{trimmedSearch}” no mercado...
            </Text>
          </View>
        );
      }
      return (
        <View className="mt-16 items-center px-8">
          <View
            className="w-16 h-16 rounded-full items-center justify-center mb-4"
            style={{ backgroundColor: t.accent.neonMuted }}
          >
            <SearchX size={28} color={t.accent.neon} />
          </View>
          <Text className="text-textPrimary text-base font-bold text-center">
            Nada encontrado para “{trimmedSearch}”
          </Text>
          <Text className="text-textSecondary text-sm text-center mt-2">
            Confira a grafia ou tente um código como USD, BTC ou IBOV.
          </Text>
        </View>
      );
    }

    return (
      <View className="mt-20 items-center px-10 opacity-60">
        <Search size={48} color={t.text.tertiary} />
        <Text className="text-textSecondary text-base text-center mt-4 font-medium">
          {emptyMessage}
        </Text>
      </View>
    );
  };

  return (
    <PageContainer>
      {/* Busca + filtro dividem a linha: os dois agem sobre a mesma lista,
          então moram juntos, logo abaixo dos títulos das abas */}
      <View className="flex-row items-center gap-3 px-5 pt-4 pb-4 bg-background z-10">
        <View className="flex-1">
          <SearchBar
            placeholder="Buscar ativo (ex: USD, PETR4)..."
            value={searchText}
            onChangeText={setSearchText}
            loading={isSearching}
            onClear={() => {
              setSearchText("");
              Keyboard.dismiss();
            }}
          />
        </View>
        <TouchableOpacity
          onPress={handleOpenFilters}
          accessibilityLabel="Ordenar e filtrar a lista"
          accessibilityRole="button"
          accessibilityState={{ selected: filtersActive }}
          activeOpacity={0.8}
          className="w-12 h-12 rounded-xl items-center justify-center bg-surface border border-border"
        >
          <SlidersHorizontal
            size={20}
            color={filtersActive ? t.accent.neon : t.text.secondary}
          />
          {/* Ponto discreto: lembra que a lista não está na ordem padrão */}
          {filtersActive && (
            <View
              className="absolute w-2 h-2 rounded-full"
              style={{ top: 8, right: 8, backgroundColor: t.accent.neon }}
            />
          )}
        </TouchableOpacity>
      </View>

      {error && data.length === 0 ? (
        <ErrorState message={error} onRetry={onRefresh} />
      ) : loading && data.length === 0 ? (
        <View className="px-5 pt-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <View
              key={i}
              className="bg-surface rounded-2xl p-5 mb-3 border border-border"
            >
              <View className="flex-row items-center mb-4">
                <Skeleton width={40} height={40} borderRadius={12} />
                <View className="ml-3 flex-1">
                  <Skeleton width="60%" height={16} className="mb-1.5" />
                  <Skeleton width="30%" height={12} />
                </View>
              </View>
              <View className="flex-row justify-between">
                <Skeleton width="40%" height={24} />
                <Skeleton width="20%" height={24} />
              </View>
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          // `numColumns` não muda em voo: a chave remonta a lista no breakpoint
          key={`grade-${columns}`}
          data={rows}
          numColumns={columns}
          columnWrapperStyle={columns > 1 ? { gap: spacing[4] } : undefined}
          keyExtractor={(item, index) => item?.id ?? `vago-${index}`}
          renderItem={renderItem}
          // Nada flutua sobre esta lista: os 128 px de rodapé eram a folga de
          // uma barra inferior que, a partir de 1024, não existe mais — e no
          // celular ela nem sobrepõe (o navigator encolhe a cena por ela).
          // Fica o respiro do celular como está e o desktop para de terminar
          // em meia tela de nada.
          contentContainerStyle={{
            paddingTop: spacing[2],
            paddingHorizontal: spacing[5],
            paddingBottom: isWide ? spacing[6] : 128,
          }}
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[t.accent.neon]}
              tintColor={t.accent.neon}
              progressViewOffset={20}
            />
          }
          ListEmptyComponent={renderEmpty}
        />
      )}

      {/* Detalhes do indicador: sheet canônico compartilhado com a Home */}
      <IndicatorDetailSheet
        indicator={selectedItem}
        visible={modalVisible}
        onClose={handleCloseModal}
      />

      <AssetFilterSheet
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        tab={tab}
      />
    </PageContainer>
  );
}
