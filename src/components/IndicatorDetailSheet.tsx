import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { ArrowDownRight, ArrowUpRight, Star } from "lucide-react-native";
import * as Haptics from "../utils/haptics";

import {
  Indicator,
  convertCurrency,
  isCurrencyData,
  isIndexData,
} from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { useFavoritesStore } from "../store/favoritesStore";
import CustomModal from "./CustomModal";
import HistoricalChart from "./HistoricalChart";

interface IndicatorDetailSheetProps {
  indicator: Indicator | null;
  visible: boolean;
  onClose: () => void;
}

/**
 * Sheet único de detalhes de indicador — substitui os três modais divergentes
 * que existiam em Home, AssetListScreen e Favorites (via DetailsModal).
 *
 * As classes do NativeWind ficam só no layout: as de cor são espelho estático
 * do dark, e o CustomModal já pinta a superfície com o tema resolvido.
 */
export default function IndicatorDetailSheet({
  indicator,
  visible,
  onClose,
}: IndicatorDetailSheetProps) {
  const t = useTheme();
  const { favorites, toggleFavorite } = useFavoritesStore();

  const [amount, setAmount] = useState("100");
  const [conversionResult, setConversionResult] = useState<number | null>(null);
  const [loadingConversion, setLoadingConversion] = useState(false);

  // O simulador não deve vazar resultado de um indicador para outro
  useEffect(() => {
    if (visible) {
      setAmount("100");
      setConversionResult(null);
    }
  }, [visible, indicator?.id]);

  if (!indicator) return null;

  const isIndex = isIndexData(indicator);
  const isCurrency = isCurrencyData(indicator);
  const isFavorite = favorites.includes(indicator.id);
  const isPositive = indicator.variation >= 0;

  const formatBrl = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleToggleFavorite = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleFavorite(indicator.id);
  };

  const handleConvert = async () => {
    if (!isCurrency || !amount) return;
    const numericAmount = parseFloat(amount.replace(",", "."));
    if (isNaN(numericAmount)) return;
    setLoadingConversion(true);
    const result = await convertCurrency(indicator.code, numericAmount);
    if (result) setConversionResult(result.result);
    setLoadingConversion(false);
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView
        contentContainerClassName="p-6 pb-8"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Cabeçalho: nome + código à esquerda, favorito à direita */}
        <View
          className="flex-row items-start justify-between mb-6 pb-4"
          style={{ borderBottomWidth: 1, borderBottomColor: t.border.default }}
        >
          <View className="flex-1 mr-4">
            <Text
              className="text-2xl font-bold"
              style={{ color: t.text.primary }}
            >
              {indicator.name}
            </Text>
            <Text className="text-sm mt-1" style={{ color: t.text.secondary }}>
              {indicator.code}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleToggleFavorite}
            accessibilityLabel={
              isFavorite
                ? `Remover ${indicator.name} dos favoritos`
                : `Adicionar ${indicator.name} aos favoritos`
            }
            accessibilityRole="button"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.default,
            }}
          >
            <Star
              size={20}
              color={isFavorite ? t.accent.neon : t.text.tertiary}
              fill={isFavorite ? t.accent.neon : "none"}
            />
          </TouchableOpacity>
        </View>

        {/* Valores: moeda tem Compra/Venda; índice mostra pontos */}
        {isIndex ? (
          <View className="items-center mb-6">
            <Text
              className="text-4xl font-bold tracking-tighter"
              style={{ color: t.text.primary }}
            >
              {(indicator.points ?? 0).toLocaleString("pt-BR")} pts
            </Text>
          </View>
        ) : (
          <View
            className="flex-row justify-around items-center mb-6 p-5 rounded-2xl"
            style={{
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.default,
            }}
          >
            <View className="items-center">
              <Text
                className="text-xs mb-1 font-bold uppercase tracking-wider"
                style={{ color: t.text.secondary }}
              >
                Compra
              </Text>
              <Text
                className="text-2xl font-bold"
                style={{ color: t.text.primary }}
              >
                {formatBrl(indicator.buy)}
              </Text>
            </View>
            {indicator.sell != null && (
              <>
                <View
                  className="w-px h-10"
                  style={{ backgroundColor: t.border.default }}
                />
                <View className="items-center">
                  <Text
                    className="text-xs mb-1 font-bold uppercase tracking-wider"
                    style={{ color: t.text.secondary }}
                  >
                    Venda
                  </Text>
                  <Text
                    className="text-2xl font-bold"
                    style={{ color: t.text.primary }}
                  >
                    {formatBrl(indicator.sell)}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* Variação do dia */}
        <View className="items-center mb-6">
          <View
            className="px-4 py-2 rounded-full flex-row items-center"
            style={{
              backgroundColor: isPositive
                ? t.semantic.successMuted
                : t.semantic.dangerMuted,
            }}
          >
            {isPositive ? (
              <ArrowUpRight size={18} color={t.semantic.success} />
            ) : (
              <ArrowDownRight size={18} color={t.semantic.danger} />
            )}
            <Text
              className="text-lg font-bold ml-1"
              style={{
                color: isPositive ? t.semantic.success : t.semantic.danger,
              }}
            >
              {Math.abs(indicator.variation).toFixed(2)}% (Hoje)
            </Text>
          </View>
        </View>

        {isCurrency && <HistoricalChart currencyCode={indicator.code} />}

        {/* Simulador de Conversão — só faz sentido para moedas */}
        {isCurrency && (
          <View
            className="mt-6 p-5 rounded-3xl"
            style={{
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.default,
            }}
          >
            <Text
              className="text-xs font-bold mb-4 uppercase tracking-widest"
              style={{ color: t.text.secondary }}
            >
              Simulador de Conversão
            </Text>
            <View
              className="flex-row items-center rounded-2xl px-4 h-16 mb-4"
              style={{
                backgroundColor: t.background.surface,
                borderWidth: 1,
                borderColor: t.border.default,
              }}
            >
              <Text
                className="text-base font-bold mr-3 pr-3"
                style={{
                  color: t.text.tertiary,
                  borderRightWidth: 1,
                  borderRightColor: t.border.default,
                }}
              >
                BRL
              </Text>
              <TextInput
                className="flex-1 text-xl font-bold h-full"
                style={{ color: t.text.primary }}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numeric"
                placeholder="0.00"
                placeholderTextColor={t.text.tertiary}
                accessibilityLabel="Valor em reais para converter"
              />
            </View>
            <TouchableOpacity
              className="rounded-2xl h-16 justify-center items-center"
              style={{ backgroundColor: t.accent.neon }}
              onPress={handleConvert}
              disabled={loadingConversion}
              accessibilityLabel="Converter agora"
              accessibilityRole="button"
              activeOpacity={0.85}
            >
              {loadingConversion ? (
                <ActivityIndicator color={t.text.inverse} />
              ) : (
                <Text
                  className="text-lg font-bold"
                  style={{ color: t.text.inverse }}
                >
                  Converter Agora
                </Text>
              )}
            </TouchableOpacity>
            {conversionResult !== null && (
              <View
                className="mt-5 items-center p-5 rounded-2xl"
                style={{
                  backgroundColor: t.semantic.successMuted,
                  borderWidth: 1,
                  borderColor: t.semantic.success,
                }}
              >
                <Text
                  className="text-xs mb-1 font-medium uppercase tracking-widest"
                  style={{ color: t.semantic.success }}
                >
                  Valor Aproximado
                </Text>
                <Text
                  className="text-3xl font-bold"
                  style={{ color: t.semantic.success }}
                >
                  {indicator.code} {conversionResult.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </CustomModal>
  );
}
