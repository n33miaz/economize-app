import React, { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  FileText,
  Link2,
  RefreshCw,
  Upload,
} from "lucide-react-native";
import { PieChart } from "react-native-chart-kit";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import { useBankStore } from "../store/bankStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useConnectorStore } from "../store/connectorStore";
import { useToastStore } from "../store/toastStore";
import PageContainer from "../components/PageContainer";
import AssistantFAB from "../components/AssistantFAB";
import CategoryIcon from "../components/CategoryIcon";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";

// Teto do gráfico de pizza: acima disso ele só cresce sem informar mais nada
const MAX_CHART_WIDTH = 420;

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

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default function BankIntegration() {
  const t = useTheme();
  const navigation = useNavigation();
  const { cardEntering, listItemEntering } = useMotionPresets();
  // Instâncias separadas: cada botão de importar tem seu próprio ciclo de toque
  const importPress = usePressScale();
  const emptyImportPress = usePressScale();
  const bannerPress = usePressScale();
  const {
    transactions,
    isLoading,
    isImporting,
    fetchTransactions,
    importStatement,
    calculateMetrics,
  } = useBankStore();
  const categoryItems = useCategoriesStore((s) => s.items);
  const fetchCategories = useCategoriesStore((s) => s.fetch);
  const { showToast } = useToastStore();
  const pluggy = useConnectorStore((s) => s.pluggy);
  const isSyncing = useConnectorStore((s) => s.isSyncing);
  const checkPluggy = useConnectorStore((s) => s.checkPluggy);
  const runPluggySync = useConnectorStore((s) => s.runPluggySync);
  // Hook, e não Dimensions.get no módulo: a janela do navegador redimensiona
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.min(windowWidth - 80, MAX_CHART_WIDTH);
  const metrics = calculateMetrics();

  // A revisão acontece em outra tela e muda o status das linhas: revalidar só
  // na montagem deixaria a contagem pendente e os pontinhos de aviso velhos
  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
      // categorias alimentam os chips das linhas do extrato
      fetchCategories();
      // o conector pode ter sido ligado no servidor desde a última visita
      checkPluggy();
    }, [fetchTransactions, fetchCategories, checkPluggy]),
  );

  const handlePluggySync = async () => {
    try {
      const result = await runPluggySync();
      if (!result) return;
      await fetchTransactions();
      if (result.transactionsImported > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast(
          `${result.transactionsImported} ${plural(result.transactionsImported, "transação importada", "transações importadas")}.`,
          "success",
        );
      } else if (result.reconciled > 0) {
        // reconciliada não é falha: o extrato já tinha o mesmo lançamento
        showToast(
          `Nada novo — ${result.reconciled} ${plural(result.reconciled, "lançamento já constava", "lançamentos já constavam")}.`,
          "info",
        );
      } else {
        showToast("Nenhuma transação nova no período.", "info");
      }
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(
        useConnectorStore.getState().error || "Falha ao sincronizar.",
        "error",
      );
    }
  };

  const catById = useMemo(
    () => new Map(categoryItems.map((c) => [c.id, c])),
    [categoryItems],
  );

  const pendingCount = useMemo(
    () =>
      transactions.filter(
        (tx) => tx.reviewStatus && tx.reviewStatus !== "CONFIRMED",
      ).length,
    [transactions],
  );

  const handleImport = async () => {
    // Trava de reentrância: dois toques rápidos abriam dois seletores de
    // arquivo. O store é a fonte da verdade porque muda antes do re-render
    if (useBankStore.getState().isImporting) return;
    try {
      Haptics.selectionAsync();
      const result = await importStatement();
      if (!result) return; // usuário cancelou o seletor de arquivo

      const pending = result.suggested + result.uncategorized;
      // Arquivo repetido vem com as contagens do upload original: mandar para
      // a Revisão faria parecer que algo novo entrou agora
      if (result.duplicated) {
        showToast(
          pending > 0
            ? `Este arquivo já foi importado antes — ${pending} ${plural(pending, "transação continua", "transações continuam")} na revisão.`
            : "Este arquivo já foi importado antes.",
          "info",
        );
        return;
      }

      if (pending > 0) {
        // o motor categorizou/sinalizou: a revisão é o próximo passo natural
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        if (result.reconciled > 0) {
          // reconciliação parcial só aparece se for dita: o resto do arquivo
          // já estava registrado por outra fonte
          showToast(
            `${result.reconciled} ${plural(result.reconciled, "transação já estava registrada", "transações já estavam registradas")}.`,
            "info",
          );
        }
        (navigation as any).navigate("Revisão", { uploadId: result.uploadId });
      } else if (result.transactionsImported > 0) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const imported = `${result.transactionsImported} ${plural(result.transactionsImported, "transação importada", "transações importadas")}`;
        showToast(
          result.reconciled > 0
            ? `${imported} — ${result.reconciled} ${plural(result.reconciled, "já estava registrada", "já estavam registradas")}.`
            : `${imported} com sucesso!`,
          "success",
        );
      } else if (result.reconciled > 0) {
        // outra fonte (outro formato ou conector) já tinha essas transações
        showToast(
          `Nada novo — ${result.reconciled} ${plural(result.reconciled, "transação já estava registrada", "transações já estavam registradas")}.`,
          "info",
        );
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
    const category = item.categoryId ? catById.get(item.categoryId) : undefined;
    const isPending = item.reviewStatus && item.reviewStatus !== "CONFIRMED";

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
            <View className="flex-row items-center mt-1.5">
              <View
                className="flex-row items-center bg-elevated border border-border rounded-full"
                style={{
                  paddingVertical: 2,
                  paddingLeft: 2,
                  paddingRight: spacing[2],
                }}
              >
                {/* AppTheme tipa hexas literais do dark; temas são
                    estruturalmente idênticos — cast da união é seguro */}
                <CategoryIcon category={category} theme={t as AppTheme} size={28} />
                <Text
                  className="text-textSecondary text-xs font-medium ml-1.5"
                  numberOfLines={1}
                  style={{ maxWidth: 130 }}
                >
                  {category ? category.name : "Sem categoria"}
                </Text>
              </View>
              {isPending && (
                // Ponto warning discreto: categorização ainda não confirmada
                <View
                  accessibilityLabel="Aguardando revisão"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: radius.full,
                    backgroundColor: t.semantic.warning,
                    marginLeft: spacing[2],
                  }}
                />
              )}
            </View>
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
                  width={chartWidth}
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

            {/* Open Finance: some por completo enquanto o servidor não
                devolver enabled — quem não configurou não precisa nem saber */}
            {pluggy.enabled && (
              <View className="bg-surface rounded-3xl p-4 border border-border mt-4">
                <View className="flex-row items-center mb-2">
                  <Link2 size={18} color={t.accent.neon} />
                  <Text className="text-base font-bold text-textPrimary ml-2">
                    Meu Pluggy
                  </Text>
                </View>

                {pluggy.configured ? (
                  <>
                    <Text className="text-xs text-textSecondary mb-3">
                      {`${pluggy.itemCount} ${plural(pluggy.itemCount, "conexão ativa", "conexões ativas")}. A sincronização traz os últimos 90 dias e passa pelo mesmo pipeline do extrato — nada duplica.`}
                    </Text>
                    <TouchableOpacity
                      className="flex-row items-center justify-center bg-accentMuted border border-accent rounded-full px-4 py-3"
                      onPress={handlePluggySync}
                      disabled={isSyncing}
                      accessibilityLabel="Sincronizar contas do Meu Pluggy"
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      style={{ opacity: isSyncing ? 0.6 : 1 }}
                    >
                      {isSyncing ? (
                        <ActivityIndicator size="small" color={t.accent.neon} />
                      ) : (
                        <RefreshCw size={16} color={t.accent.neon} />
                      )}
                      <Text className="text-accent font-bold text-sm ml-2">
                        {isSyncing ? "Sincronizando…" : "Sincronizar agora"}
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text className="text-xs text-textSecondary">
                    {pluggy.owner === false
                      ? "As credenciais do conector pertencem a outra conta."
                      : "Conector ligado, mas sem credenciais. Configure PLUGGY_CLIENT_ID, PLUGGY_CLIENT_SECRET e PLUGGY_ITEM_IDS no servidor."}
                  </Text>
                )}
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
              <>
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
                      disabled={isImporting}
                      accessibilityLabel={
                        isImporting ? "Importando extrato" : "Importar extrato"
                      }
                      accessibilityRole="button"
                      accessibilityState={{ disabled: isImporting }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.8}
                      style={{ opacity: isImporting ? 0.6 : 1 }}
                    >
                      {isImporting ? (
                        <ActivityIndicator size="small" color={t.accent.neon} />
                      ) : (
                        <Upload size={14} color={t.accent.neon} />
                      )}
                      <Text className="text-accent text-xs font-bold ml-1">
                        {isImporting ? "Importando" : "Importar"}
                      </Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
                {pendingCount > 0 && (
                  // Sem uploadId: a Revisão abre a fila global de pendências
                  <Animated.View style={bannerPress.pressStyle}>
                    <TouchableOpacity
                      onPress={() => (navigation as any).navigate("Revisão")}
                      onPressIn={bannerPress.onPressIn}
                      onPressOut={bannerPress.onPressOut}
                      accessibilityLabel={`${pendingCount} ${pendingCount === 1 ? "transação aguardando" : "transações aguardando"} revisão. Abrir revisão`}
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      className="flex-row items-center justify-between mb-3"
                      style={{
                        backgroundColor: t.semantic.warningMuted,
                        borderRadius: radius.xl,
                        paddingHorizontal: spacing[4],
                        paddingVertical: spacing[3],
                        minHeight: 44,
                      }}
                    >
                      <Text
                        className="text-xs font-bold flex-1 mr-2"
                        style={{ color: t.semantic.warning }}
                      >
                        {pendingCount === 1
                          ? "1 transação aguardando revisão"
                          : `${pendingCount} transações aguardando revisão`}
                      </Text>
                      <ChevronRight size={16} color={t.semantic.warning} />
                    </TouchableOpacity>
                  </Animated.View>
                )}
              </>
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
            <Text className="text-textSecondary text-sm text-center leading-5 mb-2">
              Exporte o arquivo de extrato em seu banco e importe aqui para gerar seus
              gráficos e relatórios.
            </Text>
            <Text className="text-textTertiary text-xs text-center leading-4 mb-5">
              Prefira OFX (ou CSV) — é o formato mais confiável dos bancos.
            </Text>
            <Animated.View style={emptyImportPress.pressStyle}>
              <TouchableOpacity
                className="flex-row items-center bg-primary rounded-full px-6 py-3 active:bg-accentPressed"
                onPress={handleImport}
                onPressIn={emptyImportPress.onPressIn}
                onPressOut={emptyImportPress.onPressOut}
                disabled={isImporting}
                accessibilityLabel={
                  isImporting ? "Importando extrato" : "Importar extrato"
                }
                accessibilityRole="button"
                accessibilityState={{ disabled: isImporting }}
                activeOpacity={0.85}
                style={{ opacity: isImporting ? 0.7 : 1 }}
              >
                {isImporting ? (
                  <ActivityIndicator size="small" color={t.text.inverse} />
                ) : (
                  <Upload size={18} color={t.text.inverse} />
                )}
                <Text className="text-primaryDark font-bold text-sm ml-2">
                  {isImporting ? "Importando..." : "Importar extrato"}
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
