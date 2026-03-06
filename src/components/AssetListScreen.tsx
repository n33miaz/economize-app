import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  LayoutAnimation,
  RefreshControl,
  ScrollView,
} from "react-native";
import { ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { Keyboard } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useDebounce } from "../hooks/useDebounce";
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
      );
    },
    [favorites, handleToggleFavorite, handleOpenModal, symbol],
  );

  return (
    <PageContainer>
      <View className="px-5 pt-4 bg-background z-10 shadow-sm shadow-gray-200/50">
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
            <ActivityIndicator size="small" color={colors.primary} />
            <Text className="ml-2 text-gray-500 text-xs font-medium">
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
          contentContainerClassName="pb-32 pt-4 px-5"
          ItemSeparatorComponent={() => <View style={{ height: 16 }} />} 
          ListHeaderComponent={renderHeader}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
              progressViewOffset={20}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View className="mt-20 items-center px-10 opacity-60">
                <Ionicons
                  name="search-outline"
                  size={48}
                  color={colors.inactive}
                />
                <Text className="text-gray-500 text-base text-center mt-4 font-medium">
                  {searchText
                    ? `Nenhum ativo encontrado para "${searchText}"`
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
              <View className="flex-row justify-around items-center mb-8 bg-gray-50 p-5 rounded-2xl border border-gray-100">
                <View className="items-center">
                  <Text className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">
                    Compra
                  </Text>
                  <Text className="text-2xl font-bold text-slate-800">
                    R$ {selectedItem.buy.toFixed(2)}
                  </Text>
                </View>
                <View className="w-[1px] h-10 bg-gray-200" />
                <View className="items-center">
                  <Text className="text-xs text-gray-500 mb-1 font-bold uppercase tracking-wider">
                    Venda
                  </Text>
                  <Text className="text-2xl font-bold text-slate-800">
                    {selectedItem.sell
                      ? `R$ ${selectedItem.sell.toFixed(2)}`
                      : "-"}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="items-center mb-6">
                <Text className="text-4xl font-bold text-slate-800 tracking-tighter">
                  {(selectedItem.points || 0).toLocaleString("pt-BR")} pts
                </Text>
              </View>
            )}

            <View className="items-center mb-6">
              <View
                className={`px-4 py-2 rounded-full ${selectedItem.variation >= 0 ? "bg-green-100" : "bg-red-100"}`}
              >
                <Text
                  className={`text-lg font-bold ${
                    selectedItem.variation >= 0
                      ? "text-green-700"
                      : "text-red-600"
                  }`}
                >
                  {selectedItem.variation > 0 ? "▲" : "▼"}{" "}
                  {Math.abs(selectedItem.variation).toFixed(2)}% (Hoje)
                </Text>
              </View>
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
