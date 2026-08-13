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
import { Star } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { colors } from "../theme/colors";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { Indicator, isIndexData } from "../services/api";
import IndicatorCard from "../components/IndicatorCard";
import IndicatorDetailSheet from "../components/IndicatorDetailSheet";
import { useFavoritesStore } from "../store/favoritesStore";
import { useIndicatorStore } from "../store/indicatorStore";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

export default function Favorites({ navigation }: any) {
  const { cardEntering, listItemEntering } = useMotionPresets();
  const explorePress = usePressScale();
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
    ({ item, index }: { item: Indicator; index: number }) => {
      const isIndex = isIndexData(item);
      const displayValue = isIndex ? item.points || 0 : item.buy;
      return (
        <Animated.View entering={listItemEntering(index)} className="px-5">
          <IndicatorCard
            name={item.name}
            id={item.id}
            code={item.code}
            type={item.type}
            value={displayValue}
            variation={item.variation}
            isFavorite={true}
            onPress={() => handleOpenModal(item)}
            onToggleFavorite={handleToggleFavorite}
            symbol={isIndex ? "pts" : "R$"}
          />
        </Animated.View>
      );
    },
    [handleToggleFavorite, handleOpenModal, listItemEntering],
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
              <Animated.View
                entering={cardEntering}
                className="flex-1 mt-16 items-center justify-center px-8"
              >
                <View className="w-24 h-24 rounded-full bg-accentMuted justify-center items-center mb-6">
                  <Star size={48} color={colors.inactive} />
                </View>
                <Text className="text-xl font-bold text-textPrimary text-center mb-2">
                  Sua lista está vazia
                </Text>
                <Text className="text-base text-textSecondary text-center leading-6 mb-8">
                  Adicione moedas e índices para acompanhar suas cotações em
                  tempo real.
                </Text>
                <Animated.View style={explorePress.pressStyle}>
                  <TouchableOpacity
                    className="bg-primary py-3.5 px-8 rounded-xl active:bg-accentPressed"
                    onPress={() =>
                      // Rota real: a aba de mercado chama-se "Indicadores"
                      // dentro do navigator "Main"
                      navigation.navigate("Main", { screen: "Indicadores" })
                    }
                    onPressIn={explorePress.onPressIn}
                    onPressOut={explorePress.onPressOut}
                    accessibilityLabel="Explorar mercado"
                    accessibilityRole="button"
                  >
                    <Text className="text-primaryDark text-base font-bold">
                      Explorar Mercado
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </Animated.View>
            ) : null
          }
        />
      )}

      {/* Detalhes do indicador: mesmo sheet da Home e das listas de mercado */}
      <IndicatorDetailSheet
        indicator={selectedItem}
        visible={modalVisible}
        onClose={handleCloseModal}
      />
    </PageContainer>
  );
}
