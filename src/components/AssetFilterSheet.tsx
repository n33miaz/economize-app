import React from "react";
import {
  LayoutAnimation,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ArrowDownAZ from "lucide-react-native/dist/esm/icons/arrow-down-a-z";
import ArrowDownWideNarrow from "lucide-react-native/dist/esm/icons/arrow-down-wide-narrow";
import ArrowUpDown from "lucide-react-native/dist/esm/icons/arrow-up-down";
import ArrowUpNarrowWide from "lucide-react-native/dist/esm/icons/arrow-up-narrow-wide";
import Check from "lucide-react-native/dist/esm/icons/check";
import Coins from "lucide-react-native/dist/esm/icons/coins";
import RotateCcw from "lucide-react-native/dist/esm/icons/rotate-ccw";
import TrendingDown from "lucide-react-native/dist/esm/icons/trending-down";
import TrendingUp from "lucide-react-native/dist/esm/icons/trending-up";
import X from "lucide-react-native/dist/esm/icons/x";
import type { LucideIcon } from "lucide-react-native";
import { useReducedMotion } from "react-native-reanimated";

import * as Haptics from "../utils/haptics";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { AssetTab, useIndicatorStore } from "../store/indicatorStore";
import { AssetSort, hasActiveFilters } from "../utils/indicatorList";
import CustomModal from "./CustomModal";

interface AssetFilterSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Aba dona do estado: cada uma guarda a própria ordenação no store. */
  tab: AssetTab;
}

interface SortOption {
  value: AssetSort;
  label: string;
  Icon: LucideIcon;
}

// "Valor" e não "preço": o rótulo precisa servir para moedas (R$) e índices
// (pontos) sem mudar por aba
const SORT_OPTIONS: SortOption[] = [
  { value: "default", label: "Padrão do mercado", Icon: ArrowUpDown },
  { value: "gainers", label: "Maior alta", Icon: TrendingUp },
  { value: "losers", label: "Maior baixa", Icon: TrendingDown },
  { value: "name-asc", label: "Nome (A–Z)", Icon: ArrowDownAZ },
  { value: "price-desc", label: "Maior valor", Icon: ArrowDownWideNarrow },
  { value: "price-asc", label: "Menor valor", Icon: ArrowUpNarrowWide },
];

/**
 * Sheet de ordenação/filtro das abas do Mercado. Toda escolha aplica na hora
 * (a lista atrás reflete de imediato) — sem botão "Aplicar", o sheet fecha
 * pelo X ou pelo backdrop quando o ajuste estiver do gosto do usuário.
 */
export default function AssetFilterSheet({
  visible,
  onClose,
  tab,
}: AssetFilterSheetProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const filters = useIndicatorStore((s) => s.filters[tab]);
  const setFilters = useIndicatorStore((s) => s.setFilters);
  const resetFilters = useIndicatorStore((s) => s.resetFilters);

  const isCurrencies = tab === "currencies";
  const showReset = hasActiveFilters(filters, isCurrencies);

  // A reordenação acontece na lista atrás do sheet: o LayoutAnimation suaviza
  // o rearranjo — e fica de fora quando o sistema pede menos movimento
  const animateListChange = () => {
    if (reducedMotion) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const handleSelectSort = (sort: AssetSort) => {
    if (sort !== filters.sort) {
      Haptics.selectionAsync();
      animateListChange();
      setFilters(tab, { sort });
    }
  };

  const handleToggleTourism = () => {
    Haptics.selectionAsync();
    animateListChange();
    setFilters(tab, { includeTourism: !filters.includeTourism });
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateListChange();
    resetFilters(tab);
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View className="px-5 pt-3 pb-8">
        {/* Cabeçalho: título + fechar, no mesmo desenho dos outros sheets */}
        <View className="flex-row items-center mb-4">
          <Text
            className="flex-1 text-xl font-bold"
            style={{ color: t.text.primary }}
          >
            Ordenar e filtrar
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Fechar filtros"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: t.background.elevated }}
          >
            <X size={18} color={t.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text
          className="text-[11px] font-bold uppercase mb-2"
          style={{ color: t.text.tertiary, letterSpacing: 1 }}
        >
          Ordenar por
        </Text>

        {SORT_OPTIONS.map(({ value, label, Icon }) => {
          const selected = filters.sort === value;
          return (
            <TouchableOpacity
              key={value}
              onPress={() => handleSelectSort(value)}
              accessibilityLabel={`Ordenar por ${label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              activeOpacity={0.8}
              className="flex-row items-center rounded-xl"
              style={{
                minHeight: 52,
                paddingHorizontal: spacing[2],
                backgroundColor: selected ? t.accent.neonMuted : "transparent",
              }}
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: t.background.elevated }}
              >
                <Icon
                  size={18}
                  color={selected ? t.accent.neon : t.text.secondary}
                />
              </View>
              <Text
                className="flex-1 text-sm ml-3"
                style={{
                  color: t.text.primary,
                  fontFamily: selected ? "Roboto_700Bold" : "Roboto_400Regular",
                }}
              >
                {label}
              </Text>
              {selected && <Check size={18} color={t.accent.neon} />}
            </TouchableOpacity>
          );
        })}

        {isCurrencies && (
          <>
            <Text
              className="text-[11px] font-bold uppercase mt-5 mb-2"
              style={{ color: t.text.tertiary, letterSpacing: 1 }}
            >
              Moedas
            </Text>
            {/* A linha inteira alterna o switch: alvo generoso para o toque */}
            <TouchableOpacity
              onPress={handleToggleTourism}
              accessibilityLabel="Incluir moedas de turismo"
              accessibilityRole="switch"
              accessibilityState={{ checked: filters.includeTourism }}
              activeOpacity={0.8}
              className="flex-row items-center rounded-xl"
              style={{ minHeight: 52, paddingHorizontal: spacing[2] }}
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: t.background.elevated }}
              >
                <Coins
                  size={18}
                  color={
                    filters.includeTourism ? t.accent.neon : t.text.secondary
                  }
                />
              </View>
              <View className="flex-1 ml-3 mr-3">
                <Text className="text-sm" style={{ color: t.text.primary }}>
                  Incluir turismo
                </Text>
                <Text
                  className="text-xs mt-0.5"
                  style={{ color: t.text.tertiary }}
                >
                  Mostra dólar e euro turismo na lista
                </Text>
              </View>
              <Switch
                value={filters.includeTourism}
                onValueChange={handleToggleTourism}
                trackColor={{ false: t.border.default, true: t.accent.neon }}
                thumbColor={t.background.base}
              />
            </TouchableOpacity>
          </>
        )}

        {showReset && (
          <TouchableOpacity
            onPress={handleReset}
            accessibilityLabel="Restaurar padrão dos filtros"
            accessibilityRole="button"
            activeOpacity={0.8}
            className="flex-row items-center justify-center mt-5"
            style={{
              height: 48,
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: t.border.default,
              backgroundColor: t.background.elevated,
            }}
          >
            <RotateCcw size={16} color={t.accent.neon} />
            <Text
              className="text-sm font-bold ml-2"
              style={{ color: t.accent.neon }}
            >
              Restaurar padrão
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </CustomModal>
  );
}
