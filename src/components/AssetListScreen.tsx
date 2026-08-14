import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
  Keyboard,
} from "react-native";
import * as Haptics from "../utils/haptics";
import { Bitcoin, Search, TrendingUp } from "lucide-react-native";
import Animated from "react-native-reanimated";

import { useDebounce } from "../hooks/useDebounce";
import { useTheme } from "../theme/ThemeProvider";
import { useMotionPresets } from "../theme/motionPresets";
import { Indicator, isIndexData } from "../services/api";
import IndicatorCard from "./IndicatorCard";
import HighlightCard from "./HighlightCard";
import SearchBar from "./SearchBar";
import Skeleton from "./Skeleton";
import PageContainer from "./PageContainer";
import ErrorState from "./ErrorState";
import IndicatorDetailSheet from "./IndicatorDetailSheet";
import { useFavoritesStore } from "../store/favoritesStore";
import { useIndicatorStore } from "../store/indicatorStore";

interface AssetListScreenProps {
  data: Indicator[];
  emptyMessage: string;
  symbol?: string;
  title?: string;
  featuredItems?: Indicator[];
}

export default function AssetListScreen({
  data,
  emptyMessage,
  symbol,
  featuredItems = [],
}: AssetListScreenProps) {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const { loading, error, fetchIndicators } = useIndicatorStore();
  const { favorites, toggleFavorite } = useFavoritesStore();

  const [searchText, setSearchText] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Indicator | null>(null);

  const debouncedSearch = useDebounce(searchText, 600);
  const [searchResults, setSearchResults] = useState<Indicator[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  useEffect(() => {
    async function performSearch() {
      if (debouncedSearch.trim().length >= 2) {
        setIsSearching(true);
        const results = await useIndicatorStore
          .getState()
          .searchIndicators(debouncedSearch);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }
    performSearch();
  }, [debouncedSearch]);

  const filteredData = useMemo(() => {
    if (!searchText) return data;
    const lowerSearch = searchText.toLowerCase();
    return data.filter(
      (item) =>
        item.name.toLowerCase().includes(lowerSearch) ||
        item.code.toLowerCase().includes(lowerSearch) ||
        item.id.toLowerCase().includes(lowerSearch),
    );
  }, [data, searchText]);

  const onRefresh = useCallback(async () => {
    await fetchIndicators();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [fetchIndicators]);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      toggleFavorite(id);
    },
    [toggleFavorite],
  );

  const handleOpenModal = useCallback((item: Indicator) => {
    setSelectedItem(item);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  const renderHeader = useMemo(() => {
    if (searchText) return null;

    return (
      <View>
        {featuredItems.length > 0 && (
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
        )}
      </View>
    );
  }, [searchText, featuredItems, handleOpenModal]);

  const renderItem = useCallback(
    ({ item, index }: { item: Indicator; index: number }) => {
      let displaySymbol = symbol;
      if (!displaySymbol) {
        // Todo índice é pontuado — não só o IBOVESPA
        displaySymbol = isIndexData(item) ? "pts" : "R$";
      }
      const displayValue = item.points !== undefined ? item.points : item.buy;

      return (
        <Animated.View entering={listItemEntering(index)}>
          <IndicatorCard
            name={item.name}
            id={item.id}
            code={item.code}
            type={item.type}
            value={displayValue}
            variation={item.variation}
            isFavorite={favorites.includes(item.id)}
            onPress={() => handleOpenModal(item)}
            onToggleFavorite={handleToggleFavorite}
            symbol={displaySymbol}
          />
        </Animated.View>
      );
    },
    [favorites, handleToggleFavorite, handleOpenModal, symbol, listItemEntering],
  );

  return (
    <PageContainer>
      <View className="px-5 pt-4 bg-background z-10">
        <SearchBar
          placeholder="Buscar ativo (ex: USD, PETR4)..."
          value={searchText}
          onChangeText={setSearchText}
          onClear={() => {
            setSearchText("");
            Keyboard.dismiss();
          }}
        />
        {isSearching && (
          <View className="flex-row items-center justify-center py-2">
            <ActivityIndicator size="small" color={t.accent.neon} />
            <Text className="ml-2 text-textSecondary text-xs font-medium">
              Filtrando mercado...
            </Text>
          </View>
        )}
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
          data={filteredData}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerClassName="pb-32 pt-4 px-5"
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
          ListEmptyComponent={
            !loading ? (
              <View className="mt-20 items-center px-10 opacity-60">
                <Search size={48} color={t.text.tertiary} />
                <Text className="text-textSecondary text-base text-center mt-4 font-medium">
                  {searchText
                    ? `Nenhum ativo encontrado para "${searchText}"`
                    : emptyMessage}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Detalhes do indicador: sheet canônico compartilhado com a Home */}
      <IndicatorDetailSheet
        indicator={selectedItem}
        visible={modalVisible}
        onClose={handleCloseModal}
      />
    </PageContainer>
  );
}
