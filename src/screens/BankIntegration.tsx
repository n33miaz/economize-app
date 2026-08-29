import React, { useCallback, useMemo, useState } from "react";
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
import ArrowDownLeft from "lucide-react-native/dist/esm/icons/arrow-down-left";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import FileText from "lucide-react-native/dist/esm/icons/file-text";
import Link2 from "lucide-react-native/dist/esm/icons/link-2";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";
import Tag from "lucide-react-native/dist/esm/icons/tag";
import Upload from "lucide-react-native/dist/esm/icons/upload";
import { PieChart } from "react-native-gifted-charts";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";
import { useFocusEffect, useNavigation } from "@react-navigation/native";

import type { BankTransaction } from "../services/api";
import { useAccountsStore } from "../store/accountsStore";
import { useBankStore } from "../store/bankStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useConnectorStore } from "../store/connectorStore";
import { useToastStore } from "../store/toastStore";
import PageContainer from "../components/PageContainer";
import ActionRow from "../components/ActionRow";
import AssistantFAB from "../components/AssistantFAB";
import CategoryIcon from "../components/CategoryIcon";
import ChartLegend from "../components/ChartLegend";
import FilterChipRow from "../components/FilterChipRow";
import OriginBadge from "../components/OriginBadge";
import Skeleton from "../components/Skeleton";
import TransactionDetailSheet from "../components/TransactionDetailSheet";
import { APP_ROUTES } from "../routes/routeNames";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import {
  ORIGIN_ALL,
  accountDisplayName,
  applyOriginFilter,
  creditCardAccounts,
  describeOriginFilter,
  originLabel,
  originFilterOptions,
  resolveOriginFilter,
} from "../utils/accounts";
import {
  type StatementMetric,
  statementMetrics,
  statementScopeNote,
} from "../utils/bankMetrics";
import { formatDayMonthShort } from "../utils/cycleWindow";
import { formatBRL, formatBRLCompact } from "../utils/money";
import {
  isRenamed,
  transactionDisplayName,
  transactionOriginalName,
} from "../utils/transactions";

// Teto do gráfico de pizza: acima disso ele só cresce sem informar mais nada
const MAX_CHART_WIDTH = 420;
// Raio da rosca: 56 é o que o gráfico de fluxo já ocupava (altura 140)
const MAX_CHART_RADIUS = 56;

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

// Tratamento numérico do app (família + tabular-nums via token); o corpo 24
// do numericLg não cabe em três colunas, então cai por breakpoint no card
const METRIC_VALUE_TYPE = {
  ...typography.numericLg,
  lineHeight: 20,
} as const;

/** Mini-card de métrica (Entradas / Saídas / Líquido) do topo do extrato. */
function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  const { width: windowWidth } = useWindowDimensions();
  return (
    <View
      className="flex-1 bg-surface rounded-2xl border border-border items-center px-1 py-4"
      // Nó acessível único por card, com o valor por extenso mesmo quando o
      // visual abrevia ("R$ 12,4 mil")
      accessible
      accessibilityLabel={`${label}: ${formatBRL(value)}`}
    >
      <Text
        className="text-textTertiary text-[10px] font-bold uppercase tracking-[1.2px] mb-1.5"
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        // Rede de segurança nativa; a web ignora esta prop, e é o degrau de
        // corpo abaixo que garante o encaixe nas janelas estreitas
        adjustsFontSizeToFit
        style={{
          ...METRIC_VALUE_TYPE,
          // Abaixo de 360px de janela, três colunas não comportam o corpo 15
          fontSize: windowWidth < 360 ? 13 : 15,
          color,
        }}
      >
        {formatBRLCompact(value)}
      </Text>
    </View>
  );
}

/** Esqueletos do primeiro carregamento, imitando a geometria do conteúdo. */
function StatementSkeleton() {
  return (
    <View className="px-5 pt-4">
      {/* linha de mini-cards de métricas (Entradas | Saídas | Líquido) */}
      <View className="flex-row gap-2 mb-4">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            className="flex-1 bg-surface rounded-2xl border border-border items-center px-1 py-4"
          >
            <Skeleton width={56} height={10} className="mb-2" />
            <Skeleton width={68} height={18} />
          </View>
        ))}
      </View>

      {/* atalhos de acesso rápido */}
      <Skeleton width={112} height={16} className="mt-4 mb-3" />
      <View className="flex-row gap-3 mb-5">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={72} height={72} borderRadius={radius.xl} />
        ))}
      </View>

      {/* linhas do histórico de transações */}
      <Skeleton width={192} height={20} className="mb-3" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton
          key={i}
          width="100%"
          height={86}
          borderRadius={radius["2xl"]}
          className="mb-3"
        />
      ))}
    </View>
  );
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
  } = useBankStore();
  const applyTransaction = useBankStore((s) => s.applyTransaction);
  // Transação aberta em detalhe: é por ali que o apelido se edita e se limpa
  const [detailTx, setDetailTx] = useState<BankTransaction | null>(null);
  // Filtro de origem (EC-113): o "o que eu gastei NO CARTÃO".
  //
  // Ele mora AQUI, e não na Análise, porque é aqui que o dado é uma lista de
  // lançamentos: a Análise soma no servidor (`/analytics/monthly`), e essa
  // rota não recebeu `accountId` nesta rodada — filtrar lá exigiria refazer a
  // agregação no cliente e as duas telas passariam a discordar. A divisão de
  // trabalho fica: o Extrato responde "no cartão" (esta fileira) e a tela de
  // Cartões responde "neste ciclo" (que é o que uma fatura é). O recorte por
  // mês/janela do EC-092 continua sendo assunto da Análise e da Home.
  //
  // E é filtro em memória, não ida ao servidor: a lista inteira já está na
  // tela, `/bank-statements` não aceita recorte, e assim as métricas do topo
  // recalculam no mesmo quadro do toque.
  const [originFilter, setOriginFilter] = useState(ORIGIN_ALL);
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsById = useAccountsStore((s) => s.byId);
  const accountsError = useAccountsStore((s) => s.error);
  const isLoadingAccounts = useAccountsStore((s) => s.isLoading);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);
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
  // Metade da caixa fica com a rosca, metade com a legenda ao lado
  const chartRadius = Math.min(MAX_CHART_RADIUS, Math.round(chartWidth / 4));

  // A barra de origem existe só quando alguma linha TEM origem: sem conta
  // sincronizada, "Tudo × Sem origem" seriam dois chips filtrando a mesma
  // lista, e a mesma condição decide se cada linha ganha o selo de origem
  const originOptions = useMemo(
    () => originFilterOptions(accounts, transactions),
    [accounts, transactions],
  );
  const showOrigin = originOptions.length > 0;
  // O extrato SABE que estas linhas têm origem — só não tem o mapa para
  // nomeá-la. Degradar em silêncio só seria defensável se o estado degradado
  // fosse indistinguível do normal, e aqui não é: some a fileira, some o selo
  // de toda linha e some a porta das faturas, tudo sem uma palavra. Um aviso
  // com retry é a diferença entre "o app não tem isso" e "o app não conseguiu
  // agora". (Selo por linha continua fora: 1.600 pílulas de "não reconhecida"
  // dizem a mesma coisa 1.600 vezes.)
  const hasUnmappedOrigin = useMemo(
    () => transactions.some((tx) => tx.accountId),
    [transactions],
  );
  const originUnavailable = !showOrigin && hasUnmappedOrigin && !!accountsError;
  // Derivado, e não estado corrigido por efeito: uma conta pode perder todos os
  // lançamentos entre duas recargas, e aí o chip some — sem isto a tela ficaria
  // presa num filtro invisível, mostrando lista vazia
  const activeOrigin = resolveOriginFilter(originFilter, originOptions);
  const visibleTransactions = useMemo(
    () => applyOriginFilter(transactions, activeOrigin),
    [transactions, activeOrigin],
  );
  const selectedAccount = originOptions.find(
    (option) => option.key === activeOrigin,
  )?.account;
  // Métricas e gráfico seguem o filtro: um total que ignora o recorte visível
  // é um número que o usuário não consegue conferir.
  //
  // E seguem também o TIPO da conta filtrada. Num cartão, `CREDIT` é estorno
  // ou pagamento da fatura — somá-lo em "Entradas" mostrava como receita o
  // dinheiro que saiu da conta corrente para quitar o cartão, e o "Líquido"
  // virava compras menos pagamentos, que não é dívida nem gasto nem saldo. É
  // o mesmo erro que o `paymentsTotal` fora do total da fatura existe para
  // impedir, entrando pela porta dos fundos no topo desta tela.
  const metricsScope =
    selectedAccount?.type === "CREDIT_CARD" ? "CREDIT_CARD" : "BANK";
  const metricRows = useMemo(
    () => statementMetrics(visibleTransactions, metricsScope),
    [visibleTransactions, metricsScope],
  );
  const scopeNote = statementScopeNote(metricsScope);
  // Atalho para as faturas: aparece só para quem tem cartão sincronizado, e
  // leva junto o cartão que está filtrado — quem filtrou o Nubank e toca aqui
  // quer a fatura DELE, não uma lista para escolher de novo
  const creditCards = useMemo(() => creditCardAccounts(accounts), [accounts]);
  const invoiceTarget =
    selectedAccount?.type === "CREDIT_CARD" ? selectedAccount : null;
  // Esqueleto só no primeiro load: o isLoading também liga no pull-to-refresh
  // (que já tem o RefreshControl) e a cada foco da tela
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // A revisão acontece em outra tela e muda o status das linhas: revalidar só
  // na montagem deixaria a contagem pendente e os pontinhos de aviso velhos
  useFocusEffect(
    useCallback(() => {
      fetchTransactions().finally(() => setHasLoadedOnce(true));
      // categorias alimentam os chips das linhas do extrato
      fetchCategories();
      // o conector pode ter sido ligado no servidor desde a última visita
      checkPluggy();
      // contas em cache: a chamada só sai na primeira tela que precisar do
      // mapa — o extrato devolve `accountId`, nunca o nome do cartão
      fetchAccounts();
    }, [fetchTransactions, fetchCategories, checkPluggy, fetchAccounts]),
  );

  const handlePluggySync = async () => {
    try {
      const result = await runPluggySync();
      if (!result) return;
      await fetchTransactions();
      // A sincronização é o ÚNICO momento em que a lista de contas muda: sem
      // recarregar aqui, o primeiro cartão conectado só apareceria (com selo,
      // filtro e faturas) depois de reabrir o app
      await fetchAccounts(true);
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

  // Tudo que a linha lê de fora do `item`; estável entre renders que não mudam
  // nada disso, que é o ponto do `extraData`
  const cellDeps = useMemo(
    () => ({ accountsById, catById, showOrigin }),
    [accountsById, catById, showOrigin],
  );

  // De propósito sobre a lista INTEIRA, e não sobre o recorte visível: o banner
  // abre a fila global de revisão, e anunciar "3 pendentes" para depois mostrar
  // 12 na tela seguinte seria mentira do banner, não filtro
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

  // Cor de cada número, pelo tom que o escopo declarou. O crédito de cartão é
  // NEUTRO: pintá-lo com chart.up é a versão visual de chamá-lo de receita, e
  // metade daquele bolo é pagamento de fatura
  const toneColor = useCallback(
    (metric: StatementMetric) => {
      if (metric.key === "cardCredits") return t.text.primary;
      if (metric.tone === "up") return t.chart.up;
      if (metric.tone === "down") return t.chart.down;
      return t.text.primary;
    },
    [t],
  );

  const { chartData, legendItems } = useMemo(() => {
    // A rosca é a composição do recorte, então nasce das MESMAS linhas dos
    // cards: assim o gráfico não pode discordar dos números acima dele
    const slices = metricRows
      .filter((metric) => metric.inChart && metric.value > 0)
      .map((metric) => ({
        label: metric.label,
        amount: metric.value,
        // Fatia neutra para o crédito de cartão, pelo mesmo motivo do card
        color:
          metric.key === "cardCredits"
            ? t.text.tertiary
            : metric.tone === "up"
              ? t.chart.up
              : t.chart.down,
      }));
    if (slices.length === 0) return { chartData: [], legendItems: [] };
    return {
      chartData: slices.map((slice) => ({
        value: slice.amount,
        color: slice.color,
      })),
      legendItems: slices.map((slice) => ({
        label: slice.label,
        // formatBRL na legenda: a soma de floats chegava crua na tela como
        // "18129.680000000004"
        value: formatBRL(slice.amount),
        color: slice.color,
      })),
    };
  }, [metricRows, t]);

  const openBankApp = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        showToast("App do banco não encontrado no dispositivo.", "warning");
      }
    } catch {
      showToast("Erro ao tentar abrir o aplicativo.", "error");
    }
  };

  const renderItem = ({
    item,
    index,
  }: {
    item: BankTransaction;
    index: number;
  }) => {
    const isCredit = item.type === "CREDIT";
    // Data pelo formatador da casa: ler o dia em UTC é o que impede a linha de
    // 01/08 aparecer como "31 jul" no fuso de Brasília
    const date = formatDayMonthShort(item.date);
    const category = item.categoryId ? catById.get(item.categoryId) : undefined;
    const isPending = item.reviewStatus && item.reviewStatus !== "CONFIRMED";
    // `description` é texto de exibição desde o EC-094; o texto do banco fica
    // logo abaixo quando há apelido, para o extrato não esconder o original
    const name = transactionDisplayName(item);
    const renamed = isRenamed(item);
    const account = item.accountId
      ? accountsById.get(item.accountId)
      : undefined;
    // O "No banco:" abaixo do nome fica DENTRO do touchable, e um touchable com
    // label próprio não anuncia os filhos: sem repetir aqui, quem usa leitor de
    // tela nunca ouviria o texto do banco de uma transação apelidada
    const spokenName = renamed
      ? `${name}, no banco: ${transactionOriginalName(item)}`
      : name;
    // Mesma armadilha do apelido: o selo de origem é filho do touchable e não
    // seria anunciado sozinho
    // Pelo helper: com `account.name` cru, uma conta que o provedor mandou sem
    // nome fazia o olho ler "Cartão de crédito" no selo e o leitor de tela
    // ouvir "origem ," na mesma linha
    const spokenOrigin = !showOrigin
      ? ""
      : account
        ? `, origem ${accountDisplayName(account)}`
        : `, ${originLabel(item.accountId, account).toLowerCase()}`;

    return (
      <Animated.View entering={listItemEntering(index)}>
        <TouchableOpacity
          onPress={() => setDetailTx(item)}
          accessibilityLabel={`${spokenName}, ${date}, ${
            isCredit ? "entrada" : "saída"
          } de ${formatBRL(Math.abs(item.amount))}${spokenOrigin}. Abrir detalhes e apelido`}
          accessibilityRole="button"
          activeOpacity={0.8}
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
            <View className="flex-row items-center">
              {renamed && (
                <Tag
                  size={12}
                  color={t.text.tertiary}
                  style={{ marginRight: 4 }}
                />
              )}
              <Text
                className="font-bold text-textPrimary text-sm leading-5 flex-1"
                numberOfLines={2}
              >
                {name}
              </Text>
            </View>
            {renamed && (
              <Text
                className="text-textTertiary text-xs mt-0.5"
                numberOfLines={1}
              >
                No banco: {transactionOriginalName(item)}
              </Text>
            )}
            <Text className="text-textTertiary text-xs mt-0.5">{date}</Text>
            {/* Categoria e origem dividem a linha e quebram juntas: num
                iPhone SE os dois selos não cabem lado a lado, e cortar o nome
                do cartão apagaria justamente a resposta nova */}
            <View
              className="flex-row items-center mt-1.5"
              style={{ flexWrap: "wrap", gap: spacing[1] }}
            >
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
                  style={{ maxWidth: 118 }}
                >
                  {category ? category.name : "Sem categoria"}
                </Text>
              </View>
              {showOrigin && (
                <OriginBadge
                  accountId={item.accountId}
                  account={account}
                  maxLabelWidth={118}
                />
              )}
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
          {isCredit ? "+ " : "- "}
          {formatBRL(Math.abs(item.amount))}
        </Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  // Primeiro load em tela vazia: esqueletos no lugar da lista. O RefreshControl
  // não monta aqui, então o spinner do pull-to-refresh não concorre com eles
  if (isLoading && !hasLoadedOnce && transactions.length === 0) {
    return (
      <PageContainer style={{ flex: 1, position: "relative" }}>
        <StatementSkeleton />
        <AssistantFAB />
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ flex: 1, position: "relative" }}>
      <FlatList
        data={visibleTransactions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        // O mapa de contas e o de categorias chegam DEPOIS da lista: sem isto
        // as linhas já montadas ficariam sem o selo de origem até o próximo
        // scroll. Memoizado, senão um literal novo a cada render re-renderiza
        // toda célula visível de graça
        extraData={cellDeps}
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
            {showOrigin && (
              <View className="mb-4">
                {/* A fileira vem ANTES dos números porque é ela que decide o
                    que está sendo somado — filtro embaixo do total faria o
                    usuário ler o valor errado antes de saber do recorte */}
                <Text className="text-textTertiary text-[10px] font-bold uppercase tracking-[1.2px] mb-2">
                  Origem
                </Text>
                <FilterChipRow
                  options={originOptions.map((option) => ({
                    key: option.key,
                    label: option.label,
                    count: option.count,
                  }))}
                  value={activeOrigin}
                  onChange={setOriginFilter}
                  spokenPrefix="Origem"
                />
              </View>
            )}

            {originUnavailable && (
              <TouchableOpacity
                onPress={() => {
                  Haptics.selectionAsync();
                  fetchAccounts(true);
                }}
                disabled={isLoadingAccounts}
                accessibilityLabel="Não foi possível identificar a origem dos lançamentos. Tentar de novo"
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoadingAccounts }}
                activeOpacity={0.85}
                className="flex-row items-center mb-4"
                style={{
                  backgroundColor: t.semantic.warningMuted,
                  borderRadius: radius.xl,
                  paddingHorizontal: spacing[4],
                  paddingVertical: spacing[3],
                  minHeight: 44,
                  opacity: isLoadingAccounts ? 0.6 : 1,
                }}
              >
                {isLoadingAccounts ? (
                  <ActivityIndicator size="small" color={t.semantic.warning} />
                ) : (
                  <RefreshCw size={16} color={t.semantic.warning} />
                )}
                <View className="flex-1 ml-2">
                  <Text
                    className="text-xs font-bold"
                    style={{ color: t.semantic.warning }}
                  >
                    Origem indisponível agora
                  </Text>
                  <Text className="text-textSecondary text-[11px] leading-4 mt-0.5">
                    Não conseguimos carregar suas contas, então o extrato não
                    consegue dizer de qual cartão vem cada lançamento. Toque
                    para tentar de novo.
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            <Animated.View entering={cardEntering} className="mb-4">
              {/* Os números vêm prontos do escopo: três no idioma da conta
                  (Entradas/Saídas/Líquido), dois no idioma do cartão
                  (Compras/Estornos e pagamentos). Alta/baixa usa
                  chart.up/chart.down; accent nunca marca alta/baixa */}
              <View className="flex-row gap-2">
                {metricRows.map((metric) => (
                  <MetricCard
                    key={metric.key}
                    label={metric.label}
                    value={metric.value}
                    color={toneColor(metric)}
                  />
                ))}
              </View>
              {scopeNote && (
                // A ressalva escrita, do mesmo jeito que o card de fatura
                // declara que pagamento não entra no total
                <Text className="text-textTertiary text-[11px] leading-4 mt-2">
                  {scopeNote}
                </Text>
              )}
            </Animated.View>

            {chartData.length > 0 && (
              <View className="bg-surface rounded-3xl p-4 border border-border">
                <Text className="text-sm font-bold text-textPrimary mb-2">
                  Análise de Fluxo
                </Text>
                <View className="flex-row items-center">
                  <PieChart
                    data={chartData}
                    radius={chartRadius}
                    donut
                    // Miolo na cor do card: a rosca é um recorte da superfície,
                    // não um disco branco por cima dela
                    innerCircleColor={t.background.surface}
                    innerRadius={Math.round(chartRadius * 0.6)}
                  />
                  <ChartLegend items={legendItems} />
                </View>
              </View>
            )}

            {/* EC-113: a porta das faturas no celular, onde não há trilho
                lateral. Some para quem não tem cartão sincronizado — fatura
                sem cartão é uma tela que só sabe dizer "não tenho nada" */}
            {creditCards.length > 0 && (
              <View className="mt-4">
                <ActionRow
                  Icon={CreditCard}
                  label={
                    invoiceTarget
                      ? `Faturas · ${invoiceTarget.name}`
                      : "Faturas do cartão"
                  }
                  description={
                    invoiceTarget
                      ? "O que você deve neste ciclo e nos anteriores"
                      : `${creditCards.length} ${plural(creditCards.length, "cartão sincronizado", "cartões sincronizados")} · veja o que você deve por ciclo`
                  }
                  onPress={() => {
                    Haptics.selectionAsync();
                    (navigation as any).navigate(
                      APP_ROUTES.cartoes,
                      invoiceTarget ? { accountId: invoiceTarget.id } : undefined,
                    );
                  }}
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
                {activeOrigin !== ORIGIN_ALL && (
                  // O recorte escrito por extenso ao lado dos números, como a
                  // janela do ciclo faz na Análise: total sem período (ou sem
                  // origem) declarado é total que ninguém consegue conferir
                  <Text className="text-textSecondary text-xs mb-2">
                    {`Mostrando só ${describeOriginFilter(activeOrigin, originOptions)} · ${visibleTransactions.length} ${plural(visibleTransactions.length, "lançamento", "lançamentos")}`}
                  </Text>
                )}
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

      <TransactionDetailSheet
        transaction={detailTx}
        visible={detailTx !== null}
        onClose={() => setDetailTx(null)}
        onUpdated={applyTransaction}
      />

      <AssistantFAB />
    </PageContainer>
  );
}
