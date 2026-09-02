import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import X from "lucide-react-native/dist/esm/icons/x";

import * as Haptics from "../utils/haptics";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import {
  usePreferencesStore,
  type NewsCategory,
  type NewsRegion,
} from "../store/preferencesStore";
import CustomModal from "./CustomModal";

interface MarketNewsSettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

const REGION_OPTIONS: { value: NewsRegion; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "br", label: "Brasil" },
  { value: "global", label: "Global" },
];

const CATEGORY_OPTIONS: { value: NewsCategory; label: string }[] = [
  { value: "all", label: "Todas" },
  { value: "economia", label: "Economia" },
  { value: "mercados", label: "Mercados" },
  { value: "cripto", label: "Cripto" },
  { value: "geral", label: "Geral" },
];

/**
 * Preferências do carrossel de notícias do Mercado. Toda escolha aplica na
 * hora (o carrossel atrás refaz a busca) — sem botão "Aplicar", como nos
 * demais sheets. Fontes individuais (via /news/sources) ficam para uma fase 2:
 * o sheet nasce só com região e categoria.
 */
export default function MarketNewsSettingsSheet({
  visible,
  onClose,
}: MarketNewsSettingsSheetProps) {
  const t = useTheme();
  const newsRegion = usePreferencesStore((s) => s.newsRegion);
  const newsCategory = usePreferencesStore((s) => s.newsCategory);
  const setNewsRegion = usePreferencesStore((s) => s.setNewsRegion);
  const setNewsCategory = usePreferencesStore((s) => s.setNewsCategory);

  const selectRegion = (value: NewsRegion) => {
    if (value === newsRegion) return;
    Haptics.selectionAsync();
    setNewsRegion(value);
  };

  const selectCategory = (value: NewsCategory) => {
    if (value === newsCategory) return;
    Haptics.selectionAsync();
    setNewsCategory(value);
  };

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View className="px-5 pt-3 pb-8">
        {/* Cabeçalho: título + fechar, no mesmo desenho dos outros sheets */}
        <View className="flex-row items-center mb-1">
          <Text
            className="flex-1 text-xl font-bold"
            style={{ color: t.text.primary }}
          >
            Notícias do momento
          </Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Fechar configurações de notícias"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            className="w-9 h-9 rounded-full items-center justify-center"
            style={{ backgroundColor: t.background.elevated }}
          >
            <X size={18} color={t.text.secondary} />
          </TouchableOpacity>
        </View>

        <Text className="text-sm mb-5" style={{ color: t.text.secondary }}>
          Escolha o recorte das manchetes do Mercado.
        </Text>

        <OptionGroup
          label="Região"
          options={REGION_OPTIONS}
          selected={newsRegion}
          onSelect={selectRegion}
        />

        <View style={{ height: spacing[5] }} />

        <OptionGroup
          label="Categoria"
          options={CATEGORY_OPTIONS}
          selected={newsCategory}
          onSelect={selectCategory}
        />
      </View>
    </CustomModal>
  );
}

// Pílulas em linha (com quebra): duas listas curtas de opções exclusivas
// ficam mais compactas assim do que em linhas empilhadas de rádio
function OptionGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}) {
  const t = useTheme();

  return (
    <View>
      <Text
        className="text-[11px] font-bold uppercase mb-2"
        style={{ color: t.text.tertiary, letterSpacing: 1 }}
      >
        {label}
      </Text>
      <View className="flex-row flex-wrap" style={{ gap: spacing[2] }}>
        {options.map((option) => {
          const isSelected = option.value === selected;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onSelect(option.value)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel={`${label}: ${option.label}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              activeOpacity={0.8}
              style={{
                minHeight: 38,
                paddingHorizontal: spacing[4],
                borderRadius: radius.full,
                borderWidth: 1,
                alignItems: "center",
                justifyContent: "center",
                borderColor: isSelected ? t.accent.neon : t.border.default,
                backgroundColor: isSelected
                  ? t.accent.neonMuted
                  : t.background.elevated,
              }}
            >
              <Text
                className="text-sm"
                style={{
                  color: isSelected ? t.accent.neon : t.text.secondary,
                  fontFamily: isSelected
                    ? "Roboto_700Bold"
                    : "Roboto_400Regular",
                }}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
