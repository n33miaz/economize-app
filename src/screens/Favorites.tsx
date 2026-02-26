import React, { useState, useCallback, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  LayoutAnimation,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { Indicator, isCurrencyData, isIndexData } from "../services/api";
import IndicatorCard from "../components/IndicatorCard";
import HistoricalChart from "../components/HistoricalChart";
import DetailsModal from "../components/DetailsModal";
import { useFavoritesStore } from "../store/favoritesStore";
import { useIndicatorStore } from "../store/indicatorStore";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

export default function Favorites({ navigation }: any) {
  const { indicators, loading, fetchIndicators } = useIndicatorStore();
  const { favorites, toggleFavorite } = useFavoritesStore();

  useEffect(() => {
    fetchIndicators();
  }, [fetchIndicators]);

  const favoriteItems = useMemo(() => {
    return indicators.filter((item) => favorites.includes(item.id));
  }, [indicators, favorites]);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Indicator | null>(null);

  const handleToggleFavorite = useCallback(
    (id: string) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      toggleFavorite(id);
    },
    [toggleFavorite],
  );

  const onRefresh = useCallback(async () => {
    await fetchIndicators();
  }, [fetchIndicators]);

  const handleOpenModal = useCallback((item: Indicator) => {
    setSelectedItem(item);
    setModalVisible(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setModalVisible(false);
    setSelectedItem(null);
  }, []);

  const renderFavoriteCard = useCallback(
    ({ item }: { item: Indicator }) => {
      const isIndex = isIndexData(item);
      const displayValue = isIndex ? item.points || 0 : item.buy;
      return (
        <View className="px-5">
          <IndicatorCard
            name={item.name}
            id={item.id}
            value={displayValue}
            variation={item.variation}
            isFavorite={true}
            onPress={() => handleOpenModal(item)}
            onToggleFavorite={handleToggleFavorite}
            symbol={isIndex && item.name === "IBOVESPA" ? "pts" : "R$"}
          />
        </View>
      );
    },
    [handleToggleFavorite, handleOpenModal],
  );

  return (
    <PageContainer>
      <ScreenHeader
        title="Meus Favoritos"
        subtitle={`${favoriteItems.length} ${favoriteItems.length === 1 ? "ativo" : "ativos"} acompanhados`}
      />

      {loading && favoriteItems.length === 0 ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={favoriteItems}
          keyExtractor={(item) => item.id}
          renderItem={renderFavoriteCard}
          contentContainerClassName="py-5"
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            !loading ? (
              <View className="flex-1 mt-16 items-center justify-center px-8">
                <View className="w-24 h-24 rounded-full bg-blue-50 justify-center items-center mb-6">
                  <Ionicons
                    name="star-outline"
                    size={48}
                    color={colors.inactive}
                  />
                </View>
                <Text className="text-xl font-bold text-slate-800 text-center mb-2">
                  Sua lista está vazia
                </Text>
                <Text className="text-base text-gray-500 text-center leading-6 mb-8">
                  Adicione moedas e índices para acompanhar suas cotações em
                  tempo real.
                </Text>
                <TouchableOpacity
                  className="bg-primary py-3.5 px-8 rounded-xl shadow-lg shadow-blue-500/30"
                  onPress={() =>
                    navigation.navigate("Início", { screen: "Dashboard" })
                  }
                >
                  <Text className="text-white text-base font-bold">
                    Explorar Mercado
                  </Text>
                </TouchableOpacity>
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
            {isIndexData(selectedItem) && (
              <Text className="mb-4 text-center text-base text-gray-500 font-regular">
                Pontos: {(selectedItem.points || 0).toFixed(2)}
              </Text>
            )}
            {isCurrencyData(selectedItem) && (
              <Text className="mb-4 text-center text-base text-gray-500 font-regular">
                Compra: R$ {selectedItem.buy.toFixed(2)}
              </Text>
            )}
            <Text className="mb-4 text-center text-base text-gray-500 font-regular">
              Variação: {selectedItem.variation.toFixed(2)}%
            </Text>
            {isCurrencyData(selectedItem) && (
              <HistoricalChart currencyCode={selectedItem.code} />
            )}
          </View>
        </DetailsModal>
      )}
    </PageContainer>
  );
}
