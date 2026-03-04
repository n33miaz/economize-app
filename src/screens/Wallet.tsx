import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PieChart } from "react-native-chart-kit";
import * as LocalAuthentication from "expo-local-authentication";
import * as Haptics from "expo-haptics";

import { colors } from "../theme/colors";
import { useWalletStore, Transaction } from "../store/walletStore";
import { useIndicatorStore } from "../store/indicatorStore";
import ScreenHeader from "../components/ScreenHeader";
import PageContainer from "../components/PageContainer";

const screenWidth = Dimensions.get("window").width;

const CHART_COLORS = [
  "#00ADEF",
  "#053D99",
  "#FBBA00",
  "#00C853",
  "#6200EA",
  "#FF3B30",
];

export default function Wallet() {
  const { transactions, addTransaction, removeTransaction, fetchTransactions } =
    useWalletStore();
  const { indicators } = useIndicatorStore();

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const [code, setCode] = useState("USD");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    async function authenticate() {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsAuthenticated(true);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Desbloquear Carteira",
        fallbackLabel: "Usar Senha",
      });

      if (result.success) {
        setIsAuthenticated(true);
      } else {
        Alert.alert(
          "Acesso Negado",
          "Não foi possível verificar sua identidade.",
        );
      }
    }

    authenticate();
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchTransactions();
    }
  }, [isAuthenticated, fetchTransactions]);

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

    const data = Object.keys(allocation).map((key, index) => ({
      name: key,
      population: parseFloat(allocation[key].toFixed(2)),
      color: CHART_COLORS[index % CHART_COLORS.length],
      legendFontColor: colors.textSecondary,
      legendFontSize: 12,
    }));

    return { totalBalance: total, chartData: data };
  }, [transactions, indicators]);

  const handleAdd = () => {
    if (!amount || !price || !code) {
      Alert.alert("Atenção", "Preencha todos os campos para continuar.");
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

    Alert.alert("Remover", "Deseja excluir esta transação?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Excluir",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          removeTransaction(id);
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Transaction }) => {
    const currentPrice = getCurrentPrice(item.assetCode);
    const totalInvested = item.quantity * item.priceAtTransaction;
    const currentValue = item.quantity * currentPrice;
    const profit = currentValue - totalInvested;
    const isProfit = profit >= 0;

    return (
      <View className="bg-white rounded-xl p-4 mb-3 flex-row items-center shadow-sm border border-gray-100">
        <View className="w-10 h-10 rounded-full bg-blue-50 justify-center items-center mr-3">
          <Text className="text-primaryDark font-bold text-xs">
            {item.assetCode}
          </Text>
        </View>

        <View className="flex-1">
          <Text className="text-base font-bold text-slate-800">
            {item.quantity} {item.assetCode}
          </Text>
          <Text className="text-xs text-gray-500">
            Pago: R$ {item.priceAtTransaction.toFixed(2)}
          </Text>
        </View>

        <View className="items-end mr-3">
          <Text className="text-sm font-bold text-slate-800">
            R$ {currentValue.toFixed(2)}
          </Text>
          <Text
            className={`text-xs font-bold ${isProfit ? "text-green-600" : "text-red-500"}`}
          >
            {isProfit ? "+" : ""}R$ {profit.toFixed(2)}
          </Text>
        </View>

        <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-2">
          <Ionicons name="trash-outline" size={18} color={colors.inactive} />
        </TouchableOpacity>
      </View>
    );
  };

  if (!isAuthenticated) {
    return (
      <PageContainer>
        <ScreenHeader title="Minha Carteira" subtitle="Protegida" />
        <View className="flex-1 justify-center items-center p-5">
          <View className="bg-blue-50 p-6 rounded-full mb-6">
            <Ionicons name="lock-closed" size={48} color={colors.primaryDark} />
          </View>
          <Text className="text-xl font-bold text-slate-800 mb-2">
            Acesso Bloqueado
          </Text>
          <Text className="text-gray-500 text-center mb-8">
            Para visualizar seus investimentos, precisamos confirmar sua
            identidade.
          </Text>
          <TouchableOpacity
            className="bg-primary px-8 py-3 rounded-xl"
            onPress={async () => {
              const result = await LocalAuthentication.authenticateAsync();
              if (result.success) setIsAuthenticated(true);
            }}
          >
            <Text className="text-white font-bold">Desbloquear</Text>
          </TouchableOpacity>
        </View>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <ScreenHeader title="Minha Carteira" subtitle="Gestão de Ativos" />

      <ScrollView contentContainerClassName="p-5 pb-24">
        <View className="bg-primaryDark rounded-2xl p-6 flex-row justify-between items-center mb-6 shadow-lg shadow-blue-900/20">
          <View>
            <Text className="text-white/80 text-sm font-regular mb-1">
              Saldo Estimado
            </Text>
            <Text className="text-white text-3xl font-bold">
              R$ {totalBalance.toFixed(2)}
            </Text>
          </View>
          <View className="bg-white/10 p-3 rounded-2xl">
            <Ionicons name="wallet" size={32} color="rgba(255,255,255,0.9)" />
          </View>
        </View>

        {chartData.length > 0 ? (
          <View className="bg-white rounded-2xl p-4 mb-6 items-center shadow-sm border border-gray-100">
            <Text className="text-lg font-bold text-slate-800 self-start mb-4">
              Alocação
            </Text>
            <PieChart
              data={chartData}
              width={screenWidth - 60}
              height={200}
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
        ) : (
          <View className="items-center justify-center p-10 bg-gray-50 rounded-2xl mb-6 border border-dashed border-gray-300">
            <Ionicons
              name="pie-chart-outline"
              size={48}
              color={colors.inactive}
            />
            <Text className="text-gray-400 mt-3 text-center">
              Adicione ativos para visualizar sua alocação.
            </Text>
          </View>
        )}

        <Text className="text-lg font-bold text-slate-800 mb-4">
          Histórico de Transações
        </Text>
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          scrollEnabled={false}
          ListEmptyComponent={
            <Text className="text-gray-400 text-center mt-5 italic">
              Nenhuma transação registrada.
            </Text>
          }
        />
      </ScrollView>

      <TouchableOpacity
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary justify-center items-center shadow-lg shadow-blue-500/30"
        onPress={() => setModalVisible(true)}
        activeOpacity={0.9}
      >
        <Ionicons name="add" size={30} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl p-6 pb-10">
            <View className="flex-row justify-between items-center mb-6">
              <Text className="text-xl font-bold text-slate-800">
                Nova Transação
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text className="text-sm font-bold text-gray-500 mb-2">
              Ativo (Código)
            </Text>
            <TextInput
              className="bg-gray-50 rounded-xl p-4 text-base text-slate-800 mb-4 border border-gray-200"
              placeholder="Ex: PETR4, USD"
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
            />

            <Text className="text-sm font-bold text-gray-500 mb-2">
              Quantidade
            </Text>
            <TextInput
              className="bg-gray-50 rounded-xl p-4 text-base text-slate-800 mb-4 border border-gray-200"
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="numeric"
            />

            <Text className="text-sm font-bold text-gray-500 mb-2">
              Preço Pago (Unitário em R$)
            </Text>
            <TextInput
              className="bg-gray-50 rounded-xl p-4 text-base text-slate-800 mb-4 border border-gray-200"
              placeholder="0.00"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
            />

            <TouchableOpacity
              className="bg-primary rounded-xl py-4 items-center mt-2 shadow-md shadow-blue-500/20"
              onPress={handleAdd}
            >
              <Text className="text-white text-base font-bold">
                Salvar Investimento
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </PageContainer>
  );
}
