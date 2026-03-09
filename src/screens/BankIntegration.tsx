import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Linking,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-chart-kit";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBankStore } from "../store/bankStore";
import { useToastStore } from "../store/toastStore";
import PageContainer from "../components/PageContainer";
import { colors } from "../theme/colors";

const screenWidth = Dimensions.get("window").width;

export default function BankIntegration() {
  const {
    transactions,
    isLoading,
    fetchTransactions,
    importStatement,
    calculateMetrics,
  } = useBankStore();
  const { showToast } = useToastStore();
  const metrics = calculateMetrics();

  const insets = useSafeAreaInsets();

  const BANK_SHORTCUTS = [
    { id: "inter", name: "Inter", url: "bancointer://", color: "#FF7A00" },
    { id: "nubank", name: "Nubank", url: "nubank://", color: "#8A05BE" },
    { id: "flash", name: "Flash", url: "flash://", color: "pink" },
    { id: "santander", name: "Santander", url: "santander://", color: "red" },
    { id: "bradesco", name: "Bradesco", url: "bradesco://", color: "red" },
    { id: "itau", name: "Itaú", url: "itau://", color: "#EC7000" },
    { id: "bb", name: "BB", url: "bb://", color: "#F8D117" },
    { id: "c6", name: "C6 Bank", url: "c6bank://", color: "#242424" },
  ];

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const handleImport = async () => {
    try {
      Haptics.selectionAsync();
      const count = await importStatement();
      if (count > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(`${count} transações importadas com sucesso!`, "success");
      } else {
        showToast("Nenhuma transação nova encontrada no arquivo.", "info");
      }
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      if (e.message !== "Canceled") {
        showToast(e.message || "Erro ao importar extrato.", "error");
      }
    }
  };

  const chartData = useMemo(() => {
    if (metrics.income === 0 && metrics.expense === 0) return [];
    return [
      {
        name: "Entradas",
        population: metrics.income,
        color: colors.success,
        legendFontColor: colors.textSecondary,
        legendFontSize: 12,
      },
      {
        name: "Saídas",
        population: metrics.expense,
        color: colors.danger,
        legendFontColor: colors.textSecondary,
        legendFontSize: 12,
      },
    ];
  }, [metrics]);

  const openBankApp = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showToast("App do banco não encontrado no dispositivo.", "warning");
      }
    } catch (error) {
      showToast("Erro ao tentar abrir o aplicativo.", "error");
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    const isCredit = item.type === "CREDIT";
    const date = new Date(item.date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });

    return (
      <View className="bg-white p-4 mb-3 rounded-2xl border border-gray-100 shadow-sm flex-row items-center justify-between">
        <View className="flex-row items-center flex-1 mr-3">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${isCredit ? "bg-green-50" : "bg-red-50"}`}
          >
            <Ionicons
              name={isCredit ? "arrow-down" : "arrow-up"}
              size={20}
              color={isCredit ? colors.success : colors.danger}
            />
          </View>
          <View className="flex-1">
            <Text
              className="font-bold text-slate-800 text-sm leading-5"
              numberOfLines={2}
            >
              {item.description || "Transferência"}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">{date}</Text>
          </View>
        </View>
        <Text
          className={`font-bold text-base ${isCredit ? "text-green-600" : "text-slate-800"}`}
        >
          {isCredit ? "+ " : "- "}R$ {Math.abs(item.amount).toFixed(2)}
        </Text>
      </View>
    );
  };

  return (
    <PageContainer style={{ flex: 1, position: "relative" }}>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerClassName="px-5 pb-24 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={fetchTransactions}
            colors={[colors.primary]}
          />
        }
        ListHeaderComponent={
          <View className="mb-6">
            <View className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex-row justify-between mb-4">
              <View className="items-center flex-1 border-r border-gray-100">
                <View className="flex-row items-center mb-1">
                  <Ionicons
                    name="arrow-down-circle"
                    size={16}
                    color={colors.success}
                  />
                  <Text className="text-gray-500 text-xs ml-1 font-medium">
                    Receitas
                  </Text>
                </View>
                <Text className="text-green-600 font-bold text-xl">
                  R$ {metrics.income.toFixed(2)}
                </Text>
              </View>
              <View className="items-center flex-1">
                <View className="flex-row items-center mb-1">
                  <Ionicons
                    name="arrow-up-circle"
                    size={16}
                    color={colors.danger}
                  />
                  <Text className="text-gray-500 text-xs ml-1 font-medium">
                    Despesas
                  </Text>
                </View>
                <Text className="text-red-500 font-bold text-xl">
                  R$ {metrics.expense.toFixed(2)}
                </Text>
              </View>
            </View>

            {chartData.length > 0 && (
              <View className="bg-white rounded-3xl p-4 shadow-sm border border-gray-100 items-center">
                <Text className="text-sm font-bold text-slate-800 self-start mb-2">
                  Análise de Fluxo
                </Text>
                <PieChart
                  data={chartData}
                  width={screenWidth - 80}
                  height={140}
                  chartConfig={{
                    color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                  }}
                  accessor={"population"}
                  backgroundColor={"transparent"}
                  paddingLeft={"0"}
                  center={[10, 0]}
                  absolute
                  hasLegend={true}
                />
              </View>
            )}

            {/* Atalhos dos Bancos */}
            <View style={{ marginBottom: -12, marginTop: 16 }}>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "bold",
                  color: "#0F172A",
                  marginBottom: 12,
                }}
              >
                Acesso Rápido
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 12 }}
              >
                {BANK_SHORTCUTS.map((bank) => (
                  <TouchableOpacity
                    key={bank.id}
                    onPress={() => openBankApp(bank.url)}
                    style={{
                      backgroundColor: bank.color,
                      width: 72,
                      height: 72,
                      borderRadius: 16,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={{
                        color: "#FFF",
                        fontWeight: "bold",
                        fontSize: 12,
                      }}
                    >
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {transactions.length > 0 && (
              <Text className="text-lg font-bold text-slate-800 mt-2 mb-2">
                Histórico de Transações
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View className="items-center justify-center mt-10 bg-gray-50 p-8 rounded-3xl border border-dashed border-gray-200">
            <View className="w-20 h-20 bg-white rounded-full justify-center items-center shadow-sm mb-4">
              <Ionicons name="document-text" size={40} color={colors.primary} />
            </View>
            <Text className="text-slate-800 font-bold text-lg text-center mb-2">
              Nenhum extrato importado
            </Text>
            <Text className="text-gray-500 text-sm text-center leading-5">
              Exporte o arquivo de extrato em seu banco e importe aqui para gerar seus
              gráficos e relatórios.
            </Text>
          </View>
        }
      />

      {/* Botão Flutuante Importar */}
      <TouchableOpacity
        style={{
          position: "absolute",
          bottom: 24, 
          right: 24,
          zIndex: 50,
          elevation: 5,
          backgroundColor: colors.primary,
          height: 56,
          paddingHorizontal: 24,
          borderRadius: 28,
          flexDirection: "row",
          justifyContent: "center",
          alignItems: "center",
          shadowColor: "#00AEEF",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 4,
        }}
        onPress={handleImport}
        activeOpacity={0.9}
      >
        <Ionicons name="cloud-upload-outline" size={24} color="#FFF" />
      </TouchableOpacity>
    </PageContainer>
  );
}
