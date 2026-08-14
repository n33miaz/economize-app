import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  useWindowDimensions,
} from "react-native";
import {
  ChartPie,
  Plus,
  Trash2,
  Wallet as WalletIcon,
  X,
} from "lucide-react-native";
import { PieChart } from "react-native-chart-kit";
import * as Haptics from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { useWalletStore, Transaction } from "../store/walletStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import PageContainer from "../components/PageContainer";
import CustomModal from "../components/CustomModal";

export default function Wallet() {
  const t = useTheme();
  // Hook, e não Dimensions.get no módulo: no navegador a janela é
  // redimensionável e o valor congelado no import deixava o gráfico cortado
  const { width: windowWidth } = useWindowDimensions();
  // Teto: acima disso a pizza só cresce sem informar mais nada
  const chartWidth = Math.min(windowWidth - 60, 420);
  const showToast = useToastStore((s) => s.showToast);
  const { cardEntering, listItemEntering, fabEntering } = useMotionPresets();
  // Instâncias separadas: FAB e botão de salvar têm ciclos de toque próprios
  const fabPress = usePressScale();
  const savePress = usePressScale();
  const { transactions, addTransaction, removeTransaction, fetchTransactions } =
    useWalletStore();
  const { indicators } = useIndicatorStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState("USD");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");

  const insets = useSafeAreaInsets();

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const getCurrentPrice = (code: string) => {
    const indicator = indicators.find((i) => i.code === code);
    return indicator ? indicator.buy : 0;
  };

  const { totalBalance, chartData } = useMemo(() => {
    let total = 0;
    const allocation: Record<string, number> = {};

    transactions.forEach((t) => {
      const currentPrice = getCurrentPrice(t.assetCode);
      const currentVal = t.quantity * currentPrice;
      total += currentVal;

      if (allocation[t.assetCode]) {
        allocation[t.assetCode] += currentVal;
      } else {
        allocation[t.assetCode] = currentVal;
      }
    });

    // Ordem fixa da paleta categórica do tema; da 7ª categoria em diante
    // agrupa visualmente em "Outros" com o tom neutro (regra do design system)
    const data = Object.keys(allocation).map((key, index) => ({
      name: key,
      population: parseFloat(allocation[key].toFixed(2)),
      color:
        index < t.chart.categorical.length
          ? t.chart.categorical[index]
          : t.chart.neutral,
      legendFontColor: t.text.secondary,
      legendFontSize: 12,
    }));

    return { totalBalance: total, chartData: data };
  }, [transactions, indicators, t]);

  const handleAdd = () => {
    if (!amount || !price || !code) {
      // Validação de campo é aviso, não decisão: toast em vez de diálogo
      showToast("Preencha todos os campos para continuar.", "warning");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    addTransaction({
      assetCode: code.toUpperCase(),
      type: "BUY",
      quantity: parseFloat(amount.replace(",", ".")),
      priceAtTransaction: parseFloat(price.replace(",", ".")),
    });

    setModalVisible(false);
    setAmount("");
    setPrice("");
    setCode("USD");
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    askConfirm({
      title: "Remover",
      message: "Deseja excluir esta transação?",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        removeTransaction(id);
      },
    });
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: Transaction;
    index: number;
  }) => {
    const currentPrice = getCurrentPrice(item.assetCode);
    const totalInvested = item.quantity * item.priceAtTransaction;
    const currentValue = item.quantity * currentPrice;
    const profit = currentValue - totalInvested;
    const isProfit = profit >= 0;

    return (
      <Animated.View
        entering={listItemEntering(index)}
        className="bg-surface rounded-xl p-4 mb-3 flex-row items-center border border-border"
      >
        <View className="w-10 h-10 rounded-full bg-accentMuted justify-center items-center mr-3">
          <Text className="text-accent font-bold text-xs">
            {item.assetCode}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-textPrimary">
            {item.quantity} {item.assetCode}
          </Text>
          <Text className="text-xs text-textSecondary">
            Pago: R$ {item.priceAtTransaction.toFixed(2)}
          </Text>
        </View>
        <View className="items-end mr-3">
          <Text className="text-sm font-bold text-textPrimary">
            R$ {currentValue.toFixed(2)}
          </Text>
          <Text
            className={`text-xs font-bold ${isProfit ? "text-success" : "text-danger"}`}
          >
            {isProfit ? "+" : ""}R$ {profit.toFixed(2)}
          </Text>
        </View>
        <TouchableOpacity
          className="p-2"
          onPress={() => handleDelete(item.id)}
          accessibilityLabel={`Excluir transação de ${item.assetCode}`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={18} color={t.text.tertiary} />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <PageContainer>
      <FlatList
        data={transactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerClassName="p-5 pb-32"
        ListHeaderComponent={
          <>
            <Animated.View
              entering={cardEntering}
              className="bg-surface border border-border rounded-2xl p-6 flex-row justify-between items-center mb-6"
            >
              <View>
                <Text className="text-textSecondary text-sm font-regular mb-1">
                  Saldo Estimado
                </Text>
                <Text className="text-textPrimary text-3xl font-bold">
                  R$ {totalBalance.toFixed(2)}
                </Text>
              </View>
              <View className="bg-accentMuted p-3 rounded-2xl">
                <WalletIcon size={24} color={t.accent.neon} />
              </View>
            </Animated.View>

            {chartData.length > 0 ? (
              <View className="bg-surface rounded-2xl p-4 mb-6 items-center border border-border">
                <Text className="text-lg font-bold text-textPrimary self-start mb-4">
                  Alocação
                </Text>
                <PieChart
                  data={chartData}
                  width={chartWidth}
                  height={200}
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
            ) : (
              <View className="items-center justify-center p-10 bg-surface rounded-2xl mb-6 border border-dashed border-border">
                <ChartPie size={48} color={t.text.tertiary} />
                <Text className="text-textSecondary mt-3 text-center">
                  Adicione ativos para visualizar sua alocação.
                </Text>
              </View>
            )}

            <Text className="text-lg font-bold text-textPrimary mb-4">
              Histórico de Transações
            </Text>
          </>
        }
        ListEmptyComponent={
          <Text className="text-textTertiary text-center mt-5 italic">
            Nenhuma transação registrada.
          </Text>
        }
      />

      {/* Estilo animado no wrapper, handlers no Touchable (padrão do preset) */}
      <Animated.View
        entering={fabEntering}
        style={[
          {
            position: "absolute",
            bottom: insets.bottom > 0 ? insets.bottom : spacing[6],
            right: spacing[6],
            zIndex: 40,
          },
          fabPress.pressStyle,
        ]}
      >
        <TouchableOpacity
          style={{
            backgroundColor: t.accent.neon,
            width: 56,
            height: 56,
            borderRadius: radius.full,
            justifyContent: "center",
            alignItems: "center",
            ...shadow.glow,
          }}
          onPress={() => setModalVisible(true)}
          onPressIn={fabPress.onPressIn}
          onPressOut={fabPress.onPressOut}
          accessibilityLabel="Adicionar transação"
          accessibilityRole="button"
          activeOpacity={0.9}
        >
          <Plus size={28} color={t.text.inverse} />
        </TouchableOpacity>
      </Animated.View>

      <CustomModal visible={modalVisible} onClose={() => setModalVisible(false)}>
        <View
          className="p-6"
          style={{ paddingBottom: insets.bottom + spacing[6] }}
        >
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold text-textPrimary">
              Nova Transação
            </Text>
            <TouchableOpacity
              className="p-2 -mr-2"
              onPress={() => setModalVisible(false)}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <X size={24} color={t.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text className="text-sm font-bold text-textSecondary mb-2">
            Ativo (Código)
          </Text>
          <TextInput
            className="bg-elevated rounded-xl p-4 text-base text-textPrimary mb-4 border border-border"
            placeholder="Ex: PETR4, USD"
            placeholderTextColor={t.text.tertiary}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            accessibilityLabel="Ativo (código)"
          />
          <Text className="text-sm font-bold text-textSecondary mb-2">
            Quantidade
          </Text>
          <TextInput
            className="bg-elevated rounded-xl p-4 text-base text-textPrimary mb-4 border border-border"
            placeholder="0.00"
            placeholderTextColor={t.text.tertiary}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            accessibilityLabel="Quantidade"
          />
          <Text className="text-sm font-bold text-textSecondary mb-2">
            Preço Pago (Unitário em R$)
          </Text>
          <TextInput
            className="bg-elevated rounded-xl p-4 text-base text-textPrimary mb-4 border border-border"
            placeholder="0.00"
            placeholderTextColor={t.text.tertiary}
            value={price}
            onChangeText={setPrice}
            keyboardType="numeric"
            accessibilityLabel="Preço pago unitário em reais"
          />
          <Animated.View style={savePress.pressStyle}>
            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center mt-2 active:bg-accentPressed"
              onPress={handleAdd}
              onPressIn={savePress.onPressIn}
              onPressOut={savePress.onPressOut}
              accessibilityLabel="Salvar investimento"
              accessibilityRole="button"
            >
              <Text className="text-primaryDark text-base font-bold">
                Salvar Investimento
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </CustomModal>
    </PageContainer>
  );
}