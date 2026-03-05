import React, { useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useBankStore } from "../store/bankStore";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import { colors } from "../theme/colors";
import * as Haptics from "expo-haptics";

export default function BankIntegration() {
  const {
    transactions,
    isLoading,
    fetchTransactions,
    importStatement,
    calculateMetrics,
  } = useBankStore();
  const metrics = calculateMetrics();

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleImport = async () => {
    try {
      Haptics.selectionAsync();
      const count = await importStatement();
      if (count > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("Sucesso", `${count} transações importadas do seu banco.`);
      }
    } catch (e: any) {
      Alert.alert("Erro", e.message);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.type === "CREDIT";
    const date = new Date(item.date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });

    return (
      <View className="bg-white p-4 mb-2 rounded-xl border border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-2">
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${isCredit ? "bg-green-100" : "bg-red-50"}`}
          >
            <Ionicons
              name={isCredit ? "arrow-up" : "arrow-down"}
              size={20}
              color={isCredit ? colors.success : colors.danger}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-bold text-slate-800 text-sm"
              numberOfLines={1}
            >
              {item.description}
            </Text>
            <Text className="text-gray-400 text-xs">{date}</Text>
          </View>
        </View>
        <Text
          className={`font-bold ${isCredit ? "text-green-600" : "text-slate-800"}`}
        >
          {isCredit ? "+ " : ""}R$ {Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  return (
    <PageContainer>
      <ScreenHeader
        title="Open Finance"
        subtitle="Conciliação Bancária"
        rightAction={
          <TouchableOpacity
            onPress={handleImport}
            className="bg-white/20 p-2 rounded-lg"
          >
            <Ionicons name="cloud-upload-outline" size={22} color="#FFF" />
          </TouchableOpacity>
        }
      />

      <View className="px-5 mt-[-20px] mb-4">
        <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex-row justify-between">
          <View className="items-center flex-1 border-r border-gray-100">
            <Text className="text-gray-400 text-xs mb-1">Entradas</Text>
            <Text className="text-green-600 font-bold text-lg">
              R$ {metrics.income.toFixed(2)}
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-gray-400 text-xs mb-1">Saídas</Text>
            <Text className="text-red-500 font-bold text-lg">
              R$ {metrics.expense.toFixed(2)}
            </Text>
          </View>
        </View>
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchTransactions}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          <View className="items-center justify-center mt-10 opacity-60">
            <Ionicons
              name="document-text-outline"
              size={48}
              color={colors.inactive}
            />
            <Text className="text-gray-500 mt-2 text-center">
              Nenhum extrato importado.
            </Text>
            <Text className="text-gray-400 text-xs text-center px-10 mt-1">
              Toque no ícone de nuvem acima para importar um arquivo .OFX do seu
              banco.
            </Text>
          </View>
        }
      />
    </PageContainer>
  );
}
