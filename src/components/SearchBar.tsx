import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  TextInputProps,
  ActivityIndicator,
} from "react-native";
import Search from "lucide-react-native/dist/esm/icons/search";
import X from "lucide-react-native/dist/esm/icons/x";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";

interface SearchBarProps extends TextInputProps {
  onClear?: () => void;
  /**
   * Busca remota em andamento: o spinner mora dentro da barra, ao lado do
   * botão de limpar, para não empurrar a lista para baixo enquanto carrega.
   */
  loading?: boolean;
}

export default function SearchBar({
  value,
  onChangeText,
  onClear,
  loading = false,
  ...rest
}: SearchBarProps) {
  const t = useTheme();

  return (
    <View className="flex-row items-center bg-surface rounded-xl px-3 h-12 border border-border">
      <Search
        size={20}
        color={t.text.tertiary}
        style={{ marginRight: spacing[2] }}
      />
      <TextInput
        className="flex-1 h-full text-base text-textPrimary font-regular"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor={t.text.tertiary}
        accessibilityLabel="Buscar ativo"
        {...rest}
      />
      {loading ? (
        <ActivityIndicator
          size="small"
          color={t.accent.neon}
          style={{ marginRight: value ? spacing[2] : 0 }}
          accessibilityLabel="Buscando no mercado"
        />
      ) : null}
      {value ? (
        <TouchableOpacity
          onPress={onClear}
          accessibilityLabel="Limpar busca"
          accessibilityRole="button"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={18} color={t.text.tertiary} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
