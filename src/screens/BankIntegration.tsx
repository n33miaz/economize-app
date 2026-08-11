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
import {
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Upload,
} from "lucide-react-native";
import { PieChart } from "react-native-chart-kit";
import * as Haptics from "expo-haptics";
import Animated from "react-native-reanimated";

import { useBankStore } from "../store/bankStore";
import { useToastStore } from "../store/toastStore";
import PageContainer from "../components/PageContainer";
import AssistantFAB from "../components/AssistantFAB";
import { useTheme } from "../theme/ThemeProvider";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";

const screenWidth = Dimensions.get("window").width;

// Cores de marca dos próprios bancos (dados, não tema) — únicas exceções
// permitidas fora dos tokens, porque identificam produtos de terceiros
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

export default function BankIntegration() {
  const t = useTheme();
  const { cardEntering, listItemEntering } = useMotionPresets();
  // Instâncias separadas: cada botão de importar tem seu próprio ciclo de toque
  const importPress = usePressScale();
  const emptyImportPress = usePressScale();
  const {
    transactions,
    isLoading,
    fetchTransactions,
    importStatement,
    calculateMetrics,
  } = useBankStore();
  const { showToast } = useToastStore();
  const metrics = calculateMetrics();

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
    // Alta/baixa financeira usa sempre chart.up/chart.down, nunca o accent
    return [
      {
        name: "Entradas",
        population: metrics.income,
        color: t.chart.up,
        legendFontColor: t.text.secondary,
        legendFontSize: 12,
      },
      {
        name: "Saídas",
        population: metrics.expense,
        color: t.chart.down,
        legendFontColor: t.text.secondary,
        legendFontSize: 12,
      },
    ];
  }, [metrics, t]);

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

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const isCredit = item.type === "CREDIT";
    const date = new Date(item.date).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
    });

    return (
      <Animated.View
        entering={listItemEntering(index)}
        className="bg-surface p-4 mb-3 rounded-2xl border border-border flex-row items-center justify-between"
      >
        <View className="flex-row items-center flex-1 mr-3">
          <View
            className={`w-12 h-12 rounded-full items-center justify-center mr-3 ${isCredit ? "bg-success/15" : "bg-danger/15"}`}
          >
            {/* Entrada aponta para dentro, saída para fora — convenção de extrato */}
            {isCredit ? (
              <ArrowDownLeft size={20} color={t.semantic.success} />
            ) : (
              <ArrowUpRight size={20} color={t.semantic.danger} />
            )}
          </View>
          <View className="flex-1">
            <Text
              className="font-bold text-textPrimary text-sm leading-5"
              numberOfLines={2}
            >
              {item.description || "Transferência"}
            </Text>
            <Text className="text-textTertiary text-xs mt-0.5">{date}</Text>
          </View>
        </View>
        <Text
          className={`font-bold text-base ${isCredit ? "text-success" : "text-textPrimary"}`}
        >
          {isCredit ? "+ " : "- "}R$ {Math.abs(item.amount).toFixed(2)}
        </Text>
      </Animated.View>
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
            colors={[t.accent.neon]}
          />
        }
        ListHeaderComponent={
          <View className="mb-6">
            <Animated.View
              entering={cardEntering}
              className="bg-surface rounded-3xl p-5 border border-border flex-row justify-between mb-4"
            >
              <View className="items-center flex-1 border-r border-border">
                <View className="flex-row items-center mb-1">
                  <ArrowDownLeft size={16} color={t.semantic.success} />
                  <Text className="text-textSecondary text-xs ml-1 font-medium">
                    Receitas
                  </Text>
                </View>
                <Text className="text-success font-bold text-xl">
                  R$ {metrics.income.toFixed(2)}
                </Text>
              </View>
              <View className="items-center flex-1">
                <View className="flex-row items-center mb-1">
                  <ArrowUpRight size={16} color={t.semantic.danger} />
                  <Text className="text-textSecondary text-xs ml-1 font-medium">
                    Despesas
                  </Text>
                </View>
                <Text className="text-danger font-bold text-xl">
                  R$ {metrics.expense.toFixed(2)}
                </Text>
              </View>
            </Animated.View>

            {chartData.length > 0 && (
              <View className="bg-surface rounded-3xl p-4 border border-border items-center">
                <Text className="text-sm font-bold text-textPrimary self-start mb-2">
                  Análise de Fluxo
                </Text>
                <PieChart
                  data={chartData}
                  width={screenWidth - 80}
                  height={140}
                  chartConfig={{
                    color: () => t.text.primary,
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
            <View className="mt-4 -mb-3">
              <Text className="text-base font-bold text-textPrimary mb-3">
                Acesso Rápido
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="gap-3"
              >
                {BANK_SHORTCUTS.map((bank) => (
                  <TouchableOpacity
                    key={bank.id}
                    className="w-[72px] h-[72px] rounded-xl justify-center items-center"
                    style={{ backgroundColor: bank.color }}
                    onPress={() => openBankApp(bank.url)}
                    accessibilityLabel={`Abrir app do ${bank.name}`}
                    accessibilityRole="button"
                    activeOpacity={0.8}
                  >
                    <Text className="text-white font-bold text-xs">
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {transactions.length > 0 && (
              <View className="flex-row items-center justify-between mt-5 mb-2">
                <Text className="text-lg font-bold text-textPrimary">
                  Histórico de Transações
                </Text>
                {/* Import vira ação inline: o canto inferior é do AssistantFAB */}
                <Animated.View style={importPress.pressStyle}>
                  <TouchableOpacity
                    className="flex-row items-center bg-accentMuted border border-accent rounded-full px-3 py-1.5"
                    onPress={handleImport}
                    onPressIn={importPress.onPressIn}
                    onPressOut={importPress.onPressOut}
                    accessibilityLabel="Importar extrato"
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.8}
                  >
                    <Upload size={14} color={t.accent.neon} />
                    <Text className="text-accent text-xs font-bold ml-1">
                      Importar
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          <Animated.View
            entering={cardEntering}
            className="items-center justify-center mt-10 bg-surface p-8 rounded-3xl border border-dashed border-border"
          >
            <View className="w-20 h-20 bg-elevated rounded-full justify-center items-center mb-4">
              <FileText size={40} color={t.accent.neon} />
            </View>
            <Text className="text-textPrimary font-bold text-lg text-center mb-2">
              Nenhum extrato importado
            </Text>
            <Text className="text-textSecondary text-sm text-center leading-5 mb-5">
              Exporte o arquivo de extrato em seu banco e importe aqui para gerar seus
              gráficos e relatórios.
            </Text>
            <Animated.View style={emptyImportPress.pressStyle}>
              <TouchableOpacity
                className="flex-row items-center bg-primary rounded-full px-6 py-3 active:bg-accentPressed"
                onPress={handleImport}
                onPressIn={emptyImportPress.onPressIn}
                onPressOut={emptyImportPress.onPressOut}
                accessibilityLabel="Importar extrato"
                accessibilityRole="button"
                activeOpacity={0.85}
              >
                <Upload size={18} color={t.text.inverse} />
                <Text className="text-primaryDark font-bold text-sm ml-2">
                  Importar extrato
                </Text>
              </TouchableOpacity>
            </Animated.View>
          </Animated.View>
        }
      />

      <AssistantFAB />
    </PageContainer>
  );
}
