import React, {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
} from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  LayoutAnimation,
  useWindowDimensions,
} from "react-native";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import Trash from "lucide-react-native/dist/esm/icons/trash";
import WalletIcon from "lucide-react-native/dist/esm/icons/wallet";
import X from "lucide-react-native/dist/esm/icons/x";
import { PieChart } from "react-native-gifted-charts";
import * as Haptics from "../utils/haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import {
  formatBRL,
  formatBRLCompact,
  formatDecimal,
  parseAmount,
  parseQuantity,
} from "../utils/money";
import { valorDoAporte } from "../utils/walletValue";
import { describeSaveFailure } from "../services/requestFailure";
import { useWalletStore, Transaction } from "../store/walletStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { askConfirm } from "../store/confirmStore";
import { useToastStore } from "../store/toastStore";
import { useEsconderBarra } from "../hooks/useEsconderBarra";
import ErrorState from "../components/ErrorState";
import PotEmptyState from "../components/PotEmptyState";
import FreshnessStamp from "../components/FreshnessStamp";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PageContainer from "../components/PageContainer";
import AdSlot from "../components/AdSlot";
import ChartLegend from "../components/ChartLegend";
import CustomModal from "../components/CustomModal";
import Skeleton from "../components/Skeleton";

function exceedsDecimalLimit(
  value: number,
  integerDigits: number,
  fractionDigits: number,
): boolean {
  const absolute = Math.abs(value);
  const scale = 10 ** fractionDigits;
  // A API recebe o número já lido pelos parsers da tela, inclusive vírgulas
  // decimais e separadores de milhar.
  return (
    absolute >= 10 ** integerDigits ||
    Math.abs(absolute * scale - Math.round(absolute * scale)) > 0.000001
  );
}

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
    error,
    addTransaction,
    removeTransaction,
    fetchTransactions,
  } = useWalletStore();
  const { indicators } = useIndicatorStore();
  // O saldo estimado é cotação vezes quantidade: ele vale o que a cotação
  // vale, e a cotação tem hora. Sem o carimbo, um preço de ontem aparece com
  // a mesma cara de um preço de agora
  const cotacoesLidasEm = useIndicatorStore((s) => s.lastFetched);

  // Puxar para atualizar: o gesto que a plataforma inteira ensinou
  // nao pode faltar numa tela de dados
  const { control: refreshControl } = usePullToRefresh(() => fetchTransactions());

  const [modalVisible, setModalVisible] = useState(false);
  const [code, setCode] = useState("USD");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  // Esqueleto só no primeiro load: o isLoading do store também liga em
  // add/remove, e reexibir o esqueleto nessas ações faria a tela piscar
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  // Trava contra o duplo toque no salvar (mesmo padrão da folha de posição):
  // o estado só muda no render seguinte, e dois toques no mesmo quadro
  // gravariam a mesma compra duas vezes
  const savingRef = useRef(false);

  const insets = useSafeAreaInsets();
  // Liga a lista à ilha da barra de abas e ao segmentado do topo
  const barra = useEsconderBarra();
  // Deslocamento do FAB até o rodapé. A reserva da lista sai deste mesmo
  // número: eram dois valores independentes, e por isso o `pb-32` sobrava
  const fabBottom = insets.bottom > 0 ? insets.bottom : spacing[6];

  useEffect(() => {
    fetchTransactions().finally(() => setHasLoadedOnce(true));
  }, [fetchTransactions]);

  const showSkeleton =
    isLoading && !hasLoadedOnce && transactions.length === 0;

  // Mesma conta de valor da Home: sem cotação vale o custo, marcado como
  // estimado — valer 0 punha saldo zerado e prejuízo do valor inteiro
  const valorDe = useCallback(
    (tx: Transaction) => valorDoAporte(tx, indicators),
    [indicators],
  );

  const { totalBalance, chartData, legendItems } = useMemo(() => {
    let total = 0;
    const allocation: Record<string, number> = {};

    transactions.forEach((t) => {
      const currentVal = valorDe(t).valor;
      total += currentVal;

      if (allocation[t.assetCode]) {
        allocation[t.assetCode] += currentVal;
      } else {
        allocation[t.assetCode] = currentVal;
      }
    });

    // Sem aporte (ou só aportes de valor zero) as fatias sairiam de uma divisão
    // por zero, então a caixa vazia cobre esse caso. Enquanto os indicadores
    // não chegam, o valor é o custo — a pizza já sai com a alocação paga
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
  }, [transactions, valorDe, t]);

  const handleAdd = async () => {
    if (savingRef.current) return;
    if (!amount || !price || !code.trim()) {
      // Validação de campo é aviso, não decisão: toast em vez de diálogo
      showToast("Preencha todos os campos para continuar.", "warning");
      return;
    }

    // Preço é dinheiro ("1.234,56" é mil e tanto; o `parseFloat` lia 1,234);
    // quantidade não: "1.234" unidades de cripto é 1,234, não 1234
    const quantity = parseQuantity(amount);
    const unitPrice = parseAmount(price);
    // Rejeita vazio, zero e negativo ANTES de salvar: a transação inválida
    // virava "R$ NaN" no saldo e fatia quebrada na pizza
    if (
      quantity === null ||
      unitPrice === null ||
      quantity <= 0 ||
      unitPrice <= 0
    ) {
      showToast(
        "Quantidade e preço precisam ser números maiores que zero.",
        "warning",
      );
      return;
    }
    if (exceedsDecimalLimit(quantity, 11, 8)) {
      showToast("Quantidade fora da faixa aceita", "warning");
      return;
    }
    if (exceedsDecimalLimit(unitPrice, 15, 4)) {
      showToast("Preço fora da faixa aceita", "warning");
      return;
    }

    savingRef.current = true;
    try {
      // Espera a gravação: antes a folha fechava, vibrava sucesso e limpava os
      // campos na hora, e uma falha sumia em silêncio (o ErrorState só aparece
      // com a lista vazia). Fechar, limpar e vibrar só no sucesso; na falha o
      // que foi digitado fica na folha para tentar de novo
      await addTransaction({
        assetCode: code.toUpperCase(),
        type: "BUY",
        quantity,
        priceAtTransaction: unitPrice,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setModalVisible(false);
      setAmount("");
      setPrice("");
      setCode("USD");
    } catch (e) {
      // Frase vazia para sessão encerrada: o toast não aparece
      showToast(
        describeSaveFailure(e, "Não foi possível salvar a transação."),
        "error",
      );
    } finally {
      savingRef.current = false;
    }
  };

  const handleDelete = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    askConfirm({
      title: "Remover",
      message: "Deseja excluir esta transação?",
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        // O diálogo só faz `console.error` de quem rejeita: a falha é tratada
        // aqui, com toast, e a vibração de sucesso espera a exclusão de fato
        try {
          await removeTransaction(id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        } catch (e) {
          showToast(
            describeSaveFailure(e, "Não foi possível excluir a transação."),
            "error",
          );
        }
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
    const { valor: currentValue, custo, estimado } = valorDe(item);
    const profit = currentValue - custo;
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
            {/* Quantidade em pt-BR ("0,5 USD"), sem casas fixas: cripto
                pede até 8 e dólar inteiro nenhuma */}
            {formatDecimal(item.quantity, 0, 8)} {item.assetCode}
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
          {estimado ? (
            // Sem cotação o valor é o preço pago: lucro ou prejuízo aqui
            // seria inventado, então a linha só diz de onde veio o número
            <Text numberOfLines={1} className="text-xs text-textTertiary">
              sem cotação
            </Text>
          ) : (
            <Text
              numberOfLines={1}
              className={`text-xs font-bold ${isProfit ? "text-success" : "text-danger"}`}
            >
              {isProfit ? "+" : ""}
              {formatBRL(profit)}
            </Text>
          )}
        </View>
        <TouchableOpacity
          className="p-2"
          onPress={() => handleDelete(item.id)}
          accessibilityLabel={`Excluir transação de ${item.assetCode}`}
          accessibilityRole="button"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash size={18} color={t.text.tertiary} />
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
          // Carteira é a aba que ABRE ao entrar em Finanças. Sem este sinal a
          // ilha de baixo e o segmentado de cima nunca somiam justamente na
          // tela onde a pessoa cai primeiro — as duas escolhas de 16/09 (6 e 7)
          // pedem que eles sumam ao rolar, e quem diz que rolou é a lista
          {...barra}
          refreshControl={refreshControl}
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
                  <FreshnessStamp
                    at={cotacoesLidasEm}
                    prefix="cotações lidas"
                    style={{ marginTop: 2 }}
                  />
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
                // EC-231: o pote vazio no lugar do glifo genérico; o card
                // tracejado continua dizendo "aqui vai entrar algo"
                <View className="bg-surface rounded-2xl mb-6 border border-dashed border-border">
                  <PotEmptyState
                    mood="comecar"
                    size={72}
                    title="Sem ativos ainda"
                    body="Adicione ativos para visualizar sua alocação."
                  />
                </View>
              )}

              <Text className="text-lg font-bold text-textPrimary mb-4">
                Histórico de Transações
              </Text>
            </>
          }
          ListFooterComponent={
            // Fim da lista: o slot nunca fica entre o usuário e os
            // números dele. Devolve null no Plus, sem reservar espaço
            <AdSlot style={{ marginTop: spacing[4] }} />
          }
          ListEmptyComponent={
            // Lista vazia por FALHA e lista vazia de verdade são coisas
            // diferentes: "nenhuma transação registrada" afirma que a pessoa
            // não tem ativo nenhum, e dizer isso quando a busca caiu é mentir
            // sobre o patrimônio dela
            error ? (
              <ErrorState
                title="Não foi possível carregar a carteira"
                message={error}
                onRetry={() => fetchTransactions(true)}
              />
            ) : (
              <Text className="text-textTertiary text-center mt-5 italic">
                Nenhuma transação registrada.
              </Text>
            )
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
            placeholder="0,00"
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
            placeholder="0,00"
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
