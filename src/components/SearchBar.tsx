import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  TextInputProps,
} from "react-native";
import { Search, X } from "lucide-react-native";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";

interface SearchBarProps extends TextInputProps {
  onClear?: () => void;
}

export default function SearchBar({
  value,
  onChangeText,
  onClear,
  ...rest
}: SearchBarProps) {
  const t = useTheme();

  return (
    <View className="flex-row items-center bg-surface rounded-xl px-3 h-12 border border-border mb-4">
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
