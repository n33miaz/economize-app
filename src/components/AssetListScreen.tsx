import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
} from "react-native";

import { useDebounce } from "../hooks/useDebounce";
import { ActivityIndicator } from "react-native";
import { colors } from "../theme/colors";
import { Indicator, isCurrencyData, isIndexData } from "../services/api";
import IndicatorCard from "./IndicatorCard";
import HighlightCard from "./HighlightCard";
import DetailsModal from "./DetailsModal";
import SearchBar from "./SearchBar";
import Skeleton from "./Skeleton";
import PageContainer from "./PageContainer";
import HistoricalChart from "./HistoricalChart";
import ErrorState from "./ErrorState";
import { useFavoritesStore } from "../store/favoritesStore";
import { useIndicatorStore } from "../store/indicatorStore";
import * as Haptics from "expo-haptics";

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

  const displayData = useMemo(() => {
    if (debouncedSearch.trim().length >= 2) {
      const localFilter = data.filter(
        (item) =>
          item.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
          item.code.toLowerCase().includes(debouncedSearch.toLowerCase()),
      );

      const combined = [...localFilter, ...searchResults];
      return Array.from(
        new Map(combined.map((item) => [item.id, item])).values(),
      );
    }
    return data;
  }, [data, debouncedSearch, searchResults]);

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
                  iconName={
                    item.code === "BTC" || item.id.includes("BTC")
                      ? "logo-bitcoin"
                      : "stats-chart"
                  }
                />
              ))}
            </ScrollView>
          </View>
        )}
      </View>
    );
  }, [searchText, featuredItems]);

  const renderItem = useCallback(
    ({ item }: { item: Indicator }) => {
      let displaySymbol = symbol;
      if (!displaySymbol) {
        displaySymbol =
          isIndexData(item) && item.name === "IBOVESPA" ? "pts" : "R$";
      }

      const displayValue = item.points !== undefined ? item.points : item.buy;

      return (
        <View className="px-5">
          <IndicatorCard
            name={item.name}
            id={item.id}
            value={displayValue}
            variation={item.variation}
            isFavorite={favorites.includes(item.id)}
            onPress={() => handleOpenModal(item)}
            onToggleFavorite={handleToggleFavorite}
            symbol={displaySymbol}
          />
        </View>
      );
    },
    [favorites, handleToggleFavorite, handleOpenModal, symbol],
  );

  return (
    <PageContainer>
      <View className="px-5 pt-4 bg-background z-10">
        <SearchBar
          placeholder="Buscar ativo..."
          value={searchText}
          onChangeText={setSearchText}
          onClear={() => setSearchText("")}
        />
        {isSearching && (
          <View className="flex-row items-center justify-center py-2">
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="ml-2 text-gray-500 text-xs">
              Buscando na bolsa...
            </Text>
          </View>
        )}
      </View>

      {error && data.length === 0 ? (
        <ErrorState message={error} onRetry={onRefresh} />
      ) : loading && data.length === 0 ? (
        <View className="px-5 pt-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <View
              key={i}
              className="bg-white rounded-2xl p-5 mb-3 border border-gray-100"
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
          contentContainerClassName="pb-10 pt-2"
          ListHeaderComponent={renderHeader}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressViewOffset={10}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View className="mt-16 items-center px-10">
                <Text className="text-gray-400 text-base text-center">
                  {searchText
                    ? `Nenhum resultado para "${searchText}"`
                    : emptyMessage}
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {selectedItem && (
        <DetailsModal
          visible={modalVisible}
          onClose={handleCloseModal}
          title={selectedItem.name}
          currencyCode={
            isCurrencyData(selectedItem) ? selectedItem.code : undefined
          }
        >
          <View>
            {isCurrencyData(selectedItem) ? (
              <View className="flex-row justify-around items-center mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 mb-1">Compra</Text>
                  <Text className="text-lg font-bold text-slate-800">
                    R$ {selectedItem.buy.toFixed(2)}
                  </Text>
                </View>
                <View className="w-[1px] h-8 bg-gray-200" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 mb-1">Venda</Text>
                  <Text className="text-lg font-bold text-slate-800">
                    {selectedItem.sell
                      ? `R$ ${selectedItem.sell.toFixed(2)}`
                      : "N/A"}
                  </Text>
                </View>
              </View>
            ) : (
              <Text className="text-xl font-bold text-center text-slate-800 mb-4">
                Pontos: {(selectedItem.points || 0).toFixed(2)}
              </Text>
            )}

            <View className="items-center mb-4">
              <Text className="text-xs text-gray-500 mb-1">
                Variação do Dia
              </Text>
              <Text
                className={`text-3xl font-bold ${
                  selectedItem.variation >= 0
                    ? "text-green-600"
                    : "text-red-500"
                }`}
              >
                {selectedItem.variation > 0 ? "+" : ""}
                {selectedItem.variation.toFixed(2)}%
              </Text>
            </View>

            {isCurrencyData(selectedItem) && (
              <HistoricalChart currencyCode={selectedItem.code} />
            )}
          </View>
        </DetailsModal>
      )}
    </PageContainer>
  );
}
