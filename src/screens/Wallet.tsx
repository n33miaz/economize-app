import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  useWindowDimensions,
} from "react-native";
import ChartPie from "lucide-react-native/dist/esm/icons/chart-pie";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import WalletIcon from "lucide-react-native/dist/esm/icons/wallet";
import X from "lucide-react-native/dist/esm/icons/x";
import { PieChart } from "react-native-gifted-charts";
import * as Haptics from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import { formatBRL, formatBRLCompact } from "../utils/money";
import { useWalletStore, Transaction } from "../store/walletStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import PageContainer from "../components/PageContainer";
import ChartLegend from "../components/ChartLegend";
import CustomModal from "../components/CustomModal";
import Skeleton from "../components/Skeleton";

export default function Wallet() {
  const t = useTheme();
  // Hook, e não Dimensions.get no módulo: no navegador a janela é
  // redimensionável e o valor congelado no import deixava o gráfico cortado
  const { width: windowWidth } = useWindowDimensions();
  // Teto: acima disso a pizza só cresce sem informar mais nada
  const chartWidth = Math.min(windowWidth - 60, 420);
  // Metade da caixa fica com a pizza, metade com a legenda ao lado; 80 é o
  // raio de hoje e continua sendo o teto
  const chartRadius = Math.min(80, Math.round(chartWidth / 4));
  const showToast = useToastStore((s) => s.showToast);
  const { cardEntering, listItemEntering, fabEntering } = useMotionPresets();
  // Instâncias separadas: FAB e botão de salvar têm ciclos de toque próprios
  const fabPress = usePressScale();
  const savePress = usePressScale();
  const {
    transactions,
    isLoading,
    addTransaction,
    removeTransaction,
    fetchTransactions,
  } = useWalletStore();
  const { indicators } = useIndicatorStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState("USD");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  // Esqueleto só no primeiro load: o isLoading do store também liga em
  // add/remove, e reexibir o esqueleto nessas ações faria a tela piscar
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const insets = useSafeAreaInsets();
  // Deslocamento do FAB até o rodapé. A reserva da lista sai deste mesmo
  // número: eram dois valores independentes, e por isso o `pb-32` sobrava
  const fabBottom = insets.bottom > 0 ? insets.bottom : spacing[6];

  useEffect(() => {
    fetchTransactions().finally(() => setHasLoadedOnce(true));
  }, [fetchTransactions]);

  const showSkeleton =
    isLoading && !hasLoadedOnce && transactions.length === 0;

  const getCurrentPrice = useCallback(
    (code: string) => {
      const indicator = indicators.find((i) => i.code === code);
      return indicator ? indicator.buy : 0;
    },
    [indicators],
  );

  const { totalBalance, chartData, legendItems } = useMemo(() => {
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

    // Enquanto os indicadores não chegam todo preço é 0: as fatias sairiam de
    // uma divisão por zero, então a caixa vazia cobre esse instante
    if (total <= 0) {
      return { totalBalance: total, chartData: [], legendItems: [] };
    }

    // Do maior para o menor: a paleta categórica tem ordem fixa, e sem ranquear
    // o agrupamento da cauda juntaria ativos pela ordem de cadastro
    const ranked = Object.keys(allocation)
      .map((key) => ({
        label: key,
        amount: Math.round(allocation[key] * 100) / 100,
      }))
      .sort((a, b) => b.amount - a.amount);

    const palette = t.chart.categorical;
    // Tipo explícito: os tokens do tema são literais congelados e sem isto a
    // fatia "Outros" (chart.neutral) não caberia na união inferida da paleta
    const slices: { label: string; amount: number; color: string }[] = ranked
      .slice(0, palette.length)
      .map((item, index) => ({ ...item, color: palette[index] }));
    // Da 7ª posição em diante vira uma fatia "Outros" no tom neutro (regra do
    // design system): repetir a paleta faria dois ativos vestirem a mesma cor
    const tail = ranked.slice(palette.length);
    if (tail.length > 0) {
      slices.push({
        label: "Outros",
        amount:
          Math.round(tail.reduce((sum, item) => sum + item.amount, 0) * 100) /
          100,
        color: t.chart.neutral,
      });
    }

    return {
      totalBalance: total,
      chartData: slices.map((slice) => ({
        value: slice.amount,
        color: slice.color,
      })),
      legendItems: slices.map((slice) => ({
        label: slice.label,
        // A legenda divide a linha com a rosca: sobra menos de metade do card
        value: formatBRLCompact(slice.amount),
        // ...mas quem ouve recebe o número inteiro: o rótulo cheio da legenda
        // já existia e não podia ser trocado pelo resumo
        spokenValue: formatBRL(slice.amount),
        color: slice.color,
      })),
    };
  }, [transactions, getCurrentPrice, t]);

  const handleAdd = () => {
    if (!amount || !price || !code.trim()) {
      // Validação de campo é aviso, não decisão: toast em vez de diálogo
      showToast("Preencha todos os campos para continuar.", "warning");
      return;
    }

    const quantity = parseFloat(amount.replace(",", "."));
    const unitPrice = parseFloat(price.replace(",", "."));
    // Rejeita NaN, zero e negativo ANTES de salvar: a guarda do gráfico
    // (`total <= 0`) não pega NaN — `NaN <= 0` é false — e a transação
    // inválida virava "R$ NaN" no saldo e fatia quebrada na pizza
    if (
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      !Number.isFinite(unitPrice) ||
      unitPrice <= 0
    ) {
      showToast(
        "Quantidade e preço precisam ser números maiores que zero.",
        "warning",
      );
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

    addTransaction({
      assetCode: code.toUpperCase(),
      type: "BUY",
      quantity,
      priceAtTransaction: unitPrice,
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
            Pago: {formatBRL(item.priceAtTransaction)}
          </Text>
        </View>
        {/* Histórico de transação é onde se CONFERE, não onde se resume: aqui
            o valor volta por extenso, no mesmo formato do "Pago:" da linha ao
            lado. Abreviar um e não o outro punha duas réguas na mesma linha */}
        <View className="items-end mr-3">
          <Text numberOfLines={1} className="text-sm font-bold text-textPrimary">
            {formatBRL(currentValue)}
          </Text>
          <Text
            numberOfLines={1}
            className={`text-xs font-bold ${isProfit ? "text-success" : "text-danger"}`}
          >
            {isProfit ? "+" : ""}
            {formatBRL(profit)}
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
      {showSkeleton ? (
        // Primeiro load: esqueletos com a geometria do card de saldo, da caixa
        // de alocação e das linhas do histórico
        <View className="p-5">
          <View className="bg-surface border border-border rounded-2xl p-6 flex-row justify-between items-center mb-6">
            <View className="flex-1 mr-4">
              <Skeleton width={104} height={14} className="mb-2" />
              <Skeleton width="60%" height={32} />
            </View>
            <Skeleton width={48} height={48} borderRadius={radius["2xl"]} />
          </View>
          <Skeleton
            width="100%"
            height={200}
            borderRadius={radius["2xl"]}
            className="mb-6"
          />
          <Skeleton width={200} height={20} className="mb-4" />
          {[0, 1, 2].map((i) => (
            <Skeleton
              key={i}
              width="100%"
              height={74}
              borderRadius={radius.xl}
              className="mb-3"
            />
          ))}
        </View>
      ) : (
        <FlatList
          data={transactions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          // Rodapé pelo que de fato flutua sobre a lista (o FAB de 56 no seu
          // deslocamento) em vez de um `pb-32` chutado: a partir de 1024 não
          // há mais barra inferior embaixo dele, e sobravam ~48 px de nada
          contentContainerStyle={{
            padding: spacing[5],
            paddingBottom: fabBottom + 56 + spacing[4],
          }}
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
                  {/* Abreviar em vez de quebrar em duas linhas: com o ícone
                      ocupando a direita, sobra pouco menos de dois terços do
                      card para 30 px de número. Quem ouve recebe o valor
                      inteiro */}
                  <Text
                    numberOfLines={1}
                    accessibilityLabel={`Saldo estimado: ${formatBRL(totalBalance)}`}
                    className="text-textPrimary text-3xl font-bold"
                  >
                    {formatBRLCompact(totalBalance)}
                  </Text>
                </View>
                <View className="bg-accentMuted p-3 rounded-2xl">
                  <WalletIcon size={24} color={t.accent.neon} />
                </View>
              </Animated.View>

              {chartData.length > 0 ? (
                <View className="bg-surface rounded-2xl p-4 mb-6 border border-border">
                  <Text className="text-lg font-bold text-textPrimary mb-4">
                    Alocação
                  </Text>
                  <View className="flex-row items-center">
                    <PieChart data={chartData} radius={chartRadius} />
                    <ChartLegend items={legendItems} />
                  </View>
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
      )}

      {/* Estilo animado no wrapper, handlers no Touchable (padrão do preset) */}
      <Animated.View
        entering={fabEntering}
        style={[
          {
            position: "absolute",
            bottom: fabBottom,
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
