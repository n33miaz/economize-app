import React from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  TextInputProps,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../theme/colors";

interface SearchBarProps extends TextInputProps {
  onClear?: () => void;
}

export default function SearchBar({
  value,
  onChangeText,
  onClear,
  ...rest
}: SearchBarProps) {
  return (
    <View className="flex-row items-center bg-white rounded-xl px-3 h-12 border border-gray-200 mb-4 shadow-sm">
      <Ionicons name="search" size={20} color="#6B7280" className="mr-2" />
      <TextInput
        className="flex-1 h-full text-base text-text-primary font-regular"
        value={value}
        onChangeText={onChangeText}
        placeholderTextColor="#94A3B8"
        {...rest}
      />
      {value ? (
        <TouchableOpacity
          onPress={onClear}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="close-circle" size={18} color="#94A3B8" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
