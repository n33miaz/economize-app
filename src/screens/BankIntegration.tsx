import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  View,
  Text,
  FlatList,
  Platform,
  TouchableOpacity,
  RefreshControl,
  Linking,
  ScrollView,
  useWindowDimensions,
} from "react-native";
// O `Linking` do react-native abre URL e escuta evento, mas não tem
// `createURL` — o destino por plataforma (deep link no aparelho, origem na
// web) só sai do expo-linking. Os dois convivem, com nomes distintos
import * as ExpoLinking from "expo-linking";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import Link2 from "lucide-react-native/dist/esm/icons/link-2";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";
import Unlink from "lucide-react-native/dist/esm/icons/unlink";
import Upload from "lucide-react-native/dist/esm/icons/upload";
import { PieChart } from "react-native-gifted-charts";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from "@react-navigation/native";

import {
  describeRequestFailure,
  getBalanceCheck,
  getMergeSuggestions,
  mergeAccounts,
  type AccountMergeSuggestion,
} from "../services/api";
import type {
  BalanceFinding,
  BankTransaction,
  FamilyTransaction,
} from "../services/api";
import FlipCard, { useFlip } from "../components/FlipCard";
import ProvenanceBack from "../components/ProvenanceBack";
import { summarizeProvenance } from "../utils/provenanceSummary";
import { useAccountsStore } from "../store/accountsStore";
import { useImportSourcesStore } from "../store/importSourcesStore";
import { useBankStore } from "../store/bankStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { parseConnectReturn, useConnectorStore } from "../store/connectorStore";
import { useFamilyStore } from "../store/familyStore";
import {
  selectCycleAnchorDay,
  usePreferencesStore,
} from "../store/preferencesStore";
import { useToastStore } from "../store/toastStore";
import { askConfirm } from "../store/confirmStore";
import PageContainer from "../components/PageContainer";
import ActionRow from "../components/ActionRow";
import BalanceCheckNotice from "../components/BalanceCheckNotice";
import DuplicateAccountsCard from "../components/DuplicateAccountsCard";
import AssistantFAB from "../components/AssistantFAB";
import BankLogo from "../components/BankLogo";
import ErrorState from "../components/ErrorState";
import ChartLegend from "../components/ChartLegend";
import CycleAnchorSheet from "../components/CycleAnchorSheet";
import CycleWindowChip from "../components/CycleWindowChip";
import FamilyScopeToggle from "../components/FamilyScopeToggle";
import FilterChipRow from "../components/FilterChipRow";
import { bankKeyFor } from "../utils/bankBrand";
import { useWaitingLine } from "../hooks/useWaitingLine";
import FreshnessStamp from "../components/FreshnessStamp";
import PotEmptyState from "../components/PotEmptyState";
import Skeleton from "../components/Skeleton";
import TransactionDetailSheet from "../components/TransactionDetailSheet";
import TransactionRow, {
  TRANSACTION_ROW_CARD_HEIGHT,
} from "../components/TransactionRow";
import { APP_ROUTES } from "../routes/routeNames";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import {
  ORIGIN_ALL,
  applyOriginFilter,
  connectionLabel,
  creditCardAccounts,
  describeOriginFilter,
  originFilterOptions,
  resolveOriginFilter,
} from "../utils/accounts";
import {
  type StatementMetric,
  statementMetrics,
  statementScopeNote,
} from "../utils/bankMetrics";
import {
  analysisRangeForMonth,
  cycleMonthKeyContaining,
  cycleWindowForMonth,
  todayIso,
} from "../utils/cycleWindow";
import {
  MEMBER_ALL,
  applyMemberFilter,
  memberFilterOptions,
  resolveMemberFilter,
} from "../utils/family";
import { formatBRL, formatBRLCompact } from "../utils/money";

// Teto do gráfico de pizza: acima disso ele só cresce sem informar mais nada
const MAX_CHART_WIDTH = 420;
// Raio da rosca: 56 é o que o gráfico de fluxo já ocupava (altura 140)
const MAX_CHART_RADIUS = 56;
// Lado do quadrado de cada atalho de banco: logo 34 + rótulo em uma linha
const BANK_SHORTCUT_SIZE = 72;

// Rótulo-legenda das fileiras (Origem, Quem, métricas): o mesmo tratamento do
// `SectionTitle`, sem as margens dele — aqui o respiro é do bloco
const EYEBROW_TYPE = {
  fontSize: 10,
  fontWeight: "700",
  letterSpacing: 1.2,
  textTransform: "uppercase",
} as const;

// Atalhos para o app de cada banco. A identidade visual vem do logo
// (`BankLogo`, que casa pelo nome), não de cor de marca solta fora dos tokens
const BANK_SHORTCUTS = [
  { id: "inter", name: "Inter", url: "bancointer://" },
  { id: "nubank", name: "Nubank", url: "nubank://" },
  { id: "flash", name: "Flash", url: "flash://" },
  { id: "santander", name: "Santander", url: "santander://" },
  { id: "bradesco", name: "Bradesco", url: "bradesco://" },
  { id: "itau", name: "Itaú", url: "itau://" },
  { id: "bb", name: "BB", url: "bb://" },
  { id: "c6", name: "C6 Bank", url: "c6bank://" },
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
        className="text-textTertiary mb-1.5"
        style={EYEBROW_TYPE}
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
          <Skeleton
            key={i}
            width={BANK_SHORTCUT_SIZE}
            height={BANK_SHORTCUT_SIZE}
            borderRadius={radius.xl}
          />
        ))}
      </View>

      {/* linhas de lançamento, na altura do card sem selos */}
      <Skeleton width={148} height={20} className="mb-3" />
      {[0, 1, 2, 3].map((i) => (
        <Skeleton
          key={i}
          width="100%"
          height={TRANSACTION_ROW_CARD_HEIGHT}
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
  const route = useRoute();
  const { cardEntering, listItemEntering } = useMotionPresets();
  // Instâncias separadas: cada botão tem seu próprio ciclo de toque
  const importPress = usePressScale();
  const bannerPress = usePressScale();
  // O Extrato pode ser aberto já filtrado por uma conta (Cartões manda o
  // cartão escolhido). O projeto não tem ParamList tipado — cast local
  const requestedAccountId = (
    route.params as { accountId?: string } | undefined
  )?.accountId;
  const {
    transactions,
    isLoading,
    isImporting,
    error: bankError,
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
  //
  // Nasce com a conta pedida pela rota, quando há: quem chega do card do
  // cartão quer ver o extrato DELE, não a lista inteira para filtrar de novo
  const [originFilter, setOriginFilter] = useState(
    requestedAccountId ?? ORIGIN_ALL,
  );
  // A aba fica montada entre visitas: um segundo pedido com outra conta
  // precisa trocar o filtro, e não só o estado inicial
  useEffect(() => {
    if (requestedAccountId) setOriginFilter(requestedAccountId);
  }, [requestedAccountId]);

  // EC-150: o Extrato da CASA. O alternador é o mesmo da Análise, e o recorte
  // também: a casa não tem calendário próprio, tem o de quem está olhando.
  //
  // Aqui a lista vem do SERVIDOR por período (`/family/transactions`), e não da
  // lista inteira em memória como a pessoal: as linhas dos outros chegam já
  // filtradas pelo que cada um decidiu mostrar — quem compartilha só totais não
  // manda linha nenhuma, e essa decisão é do dono do dado, nunca desta tela.
  const familyScope = useFamilyStore((s) => s.scope);
  const familyTransactions = useFamilyStore((s) => s.transactions);
  const isFamilyLoading = useFamilyStore((s) => s.isTransactionsLoading);
  const familyError = useFamilyStore((s) => s.transactionsError);
  const hasLoadedFamilyOnce = useFamilyStore((s) => s.hasLoadedTransactionsOnce);
  const fetchFamilyTransactions = useFamilyStore((s) => s.fetchTransactions);
  const inFamilyScope = familyScope === "family";
  const anchorDay = usePreferencesStore(selectCycleAnchorDay);
  const [anchorSheetOpen, setAnchorSheetOpen] = useState(false);
  const [memberFilter, setMemberFilter] = useState(MEMBER_ALL);

  // O ciclo corrente do usuário, pela mesma âncora da Home e da Análise
  const familyMonth = useMemo(
    () => cycleMonthKeyContaining(anchorDay, todayIso()),
    [anchorDay],
  );
  const familyWindow = useMemo(
    () => cycleWindowForMonth(anchorDay, familyMonth),
    [anchorDay, familyMonth],
  );

  const loadFamilyTransactions = useCallback(() => {
    fetchFamilyTransactions({
      range: analysisRangeForMonth(anchorDay, familyMonth),
    });
  }, [fetchFamilyTransactions, anchorDay, familyMonth]);

  useEffect(() => {
    if (inFamilyScope) loadFamilyTransactions();
  }, [inFamilyScope, loadFamilyTransactions]);

  // Um chip por pessoa COM linha no período — quem mostra só totais não vira
  // chip, senão filtrar por ela daria lista vazia sem explicação
  const memberOptions = useMemo(
    () => memberFilterOptions(familyTransactions),
    [familyTransactions],
  );
  const activeMember = resolveMemberFilter(memberFilter, memberOptions);
  const visibleFamilyTransactions = useMemo(
    () => applyMemberFilter(familyTransactions, activeMember),
    [familyTransactions, activeMember],
  );
  // Qual membro sou EU: é o que decide quais linhas continuam abrindo o
  // detalhe (onde se edita apelido e categoria) e qual selo diz "você"
  const myMemberId = useFamilyStore(
    (s) => s.family?.members.find((member) => member.isMe)?.id ?? null,
  );
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsById = useAccountsStore((s) => s.byId);
  // O mapa dos arquivos importados, para o verso nomear a fonte em vez de
  // mostrar um UUID (EC-195 carregou ele uma vez; aqui é só leitura)
  const sourcesById = useImportSourcesStore((s) => s.byId);
  const accountsError = useAccountsStore((s) => s.error);
  const isLoadingAccounts = useAccountsStore((s) => s.isLoading);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);
  const categoryItems = useCategoriesStore((s) => s.items);
  const fetchCategories = useCategoriesStore((s) => s.fetch);
  const { showToast } = useToastStore();
  const connector = useConnectorStore((s) => s.status);
  const isSyncing = useConnectorStore((s) => s.isSyncing);
  const checkConnector = useConnectorStore((s) => s.checkStatus);
  const runConnectorSync = useConnectorStore((s) => s.runSync);
  const connections = useConnectorStore((s) => s.items);
  const fetchItems = useConnectorStore((s) => s.fetchItems);
  const buildConnectUrl = useConnectorStore((s) => s.buildConnectUrl);
  const finishConnect = useConnectorStore((s) => s.finishConnect);
  const unlink = useConnectorStore((s) => s.unlink);
  const isLinking = useConnectorStore((s) => s.isLinking);
  // EC-224: a legenda diz o que esta acontecendo de verdade, na ordem real
  // das varreduras -- e para de prometer passado o prazo
  const legendaDaImportacao = useWaitingLine("import", isImporting);
  // A conferência entre o saldo que o banco informa e o que o app mostra
  // (EC-196). Mora aqui, e não na Home, porque é nesta tela que o usuário vem
  // entender de onde os números vêm — e foi exatamente entre estas duas telas
  // que o concorrente se contradisse
  const [avisosDeSaldo, setAvisosDeSaldo] = useState<BalanceFinding[]>([]);
  const [duplicadas, setDuplicadas] = useState<AccountMergeSuggestion[]>([]);

  /**
   * Junta duas origens que são a mesma conta, e recarrega o que depende delas.
   *
   * <p>Depois da fusão, três coisas mudaram no servidor: a lista de contas (uma
   * deixou de existir), o extrato (lançamentos trocaram de origem) e as
   * sugestões (o par resolvido sai da lista). Recarregar as três aqui é o que
   * evita a tela continuar oferecendo uma fusão que já aconteceu.
   */
  const juntarContas = useCallback(
    async (sugestao: AccountMergeSuggestion) => {
      try {
        const movidos = await mergeAccounts(sugestao.sourceId, sugestao.targetId);
        showToast(
          movidos === 1
            ? "1 lançamento mudou de conta. As duas origens agora são uma."
            : `${movidos.toLocaleString("pt-BR")} lançamentos mudaram de conta. As duas origens agora são uma.`,
          "success",
        );
        await fetchAccounts(true);
        await fetchTransactions();
        const restantes = await getMergeSuggestions().catch(() => []);
        setDuplicadas(restantes);
      } catch (erro) {
        showToast(describeRequestFailure(erro).message, "error");
      }
    },
    [fetchAccounts, fetchTransactions, showToast],
  );
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
  // EC-225: de onde os números acima foram somados. Sai das MESMAS linhas que
  // as métricas usam — resumir um conjunto maior descreveria outro número
  const procedencia = useMemo(
    () => summarizeProvenance(visibleTransactions, accountsById, sourcesById),
    [visibleTransactions, accountsById, sourcesById],
  );
  const { flipped: origemAberta, toggle: virarOrigem } = useFlip();

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
      checkConnector();
      // contas em cache: a chamada só sai na primeira tela que precisar do
      // mapa — o extrato devolve `accountId`, nunca o nome do cartão
      fetchAccounts();
      // conexões do usuário: a guarda de `enabled` mora no próprio store
      fetchItems();
      // a conferência de saldo é best-effort: ela existe para AVISAR, e uma
      // falha nela não pode tirar a tela do ar nem virar toast — o usuário
      // veio aqui ver as conexões, não o resultado da conferência
      getBalanceCheck()
        .then((relatorio) => setAvisosDeSaldo(relatorio.findings))
        .catch(() => setAvisosDeSaldo([]));
      // Origens duplicadas: mesmo best-effort da conferência acima. É aviso,
      // não conteúdo — e uma falha aqui não pode tirar as conexões do ar
      getMergeSuggestions()
        .then(setDuplicadas)
        .catch(() => setDuplicadas([]));
    }, [
      fetchTransactions,
      fetchCategories,
      checkConnector,
      fetchAccounts,
      fetchItems,
    ]),
  );

  // EC-106: retorno da ponte de conexão bancária. O id vem no fragmento da
  // URL — no aparelho pelo deep link `economize://`, na web pelo hash da
  // própria página. Um caminho só de leitura para as duas plataformas.
  const registrarRetorno = useCallback(
    async (url: string | null | undefined) => {
      const retorno = parseConnectReturn(url);
      if (!retorno) return;
      if ("cancelado" in retorno) return; // fechar o widget não é erro
      if ("erro" in retorno) {
        showToast(retorno.erro, "error");
        return;
      }
      if (await finishConnect(retorno.itemId)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        showToast("Banco conectado. Sincronize para trazer as transações.", "success");
      } else {
        showToast(
          useConnectorStore.getState().error || "Não foi possível conectar.",
          "error",
        );
      }
    },
    [finishConnect, showToast],
  );

  useEffect(() => {
    // Duas entradas: o app já estava aberto (evento) ou foi aberto pelo link
    const sub = Linking.addEventListener("url", ({ url }) =>
      registrarRetorno(url),
    );
    Linking.getInitialURL().then(registrarRetorno);
    if (Platform.OS === "web" && typeof window !== "undefined") {
      // Na web não há deep link: a ponte devolve para a própria origem e o
      // id chega no hash. Limpo depois de ler para o F5 não reprocessar
      const href = window.location.href;
      // O mesmo leitor decide se o hash é retorno da ponte: procurar palavras
      // soltas na URL pegaria um `?item=` de outra tela
      if (parseConnectReturn(href)) {
        registrarRetorno(href);
        window.history.replaceState(null, "", window.location.pathname);
      }
    }
    return () => sub.remove();
  }, [registrarRetorno]);

  const handleConectarBanco = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // `createURL` resolve o destino por plataforma: deep link no aparelho,
    // URL da origem na web
    const destino = ExpoLinking.createURL("/");
    const url = await buildConnectUrl(destino);
    if (!url) {
      showToast(
        useConnectorStore.getState().error || "Não foi possível iniciar.",
        "error",
      );
      return;
    }
    Linking.openURL(url);
  };

  const handleDesconectar = (id: string, nome: string) => {
    askConfirm({
      title: "Desconectar este banco?",
      message: `O Economize! para de buscar novos lançamentos de ${nome}. O que já foi importado continua no seu extrato.`,
      confirmLabel: "Desconectar",
      destructive: true,
      onConfirm: async () => {
        if (await unlink(id)) {
          showToast("Banco desconectado.", "success");
        } else {
          showToast(
            useConnectorStore.getState().error || "Não foi possível desconectar.",
            "error",
          );
        }
      },
    });
  };

  const handleConnectorSync = async () => {
    try {
      const result = await runConnectorSync();
      if (!result) return;
      // `force`: a sincronização acabou de trazer lançamentos, e é justamente
      // aí que a lista guardada está errada
      await fetchTransactions(true);
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
    () => ({ accountsById, catById, showOrigin, myMemberId }),
    [accountsById, catById, showOrigin, myMemberId],
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
        (navigation as any).navigate(APP_ROUTES.revisao, {
          uploadId: result.uploadId,
        });
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
    item: BankTransaction | FamilyTransaction;
    index: number;
  }) => {
    // Só no escopo da casa a linha tem dono a declarar: no extrato pessoal
    // todas são da mesma pessoa e o selo diria o óbvio em toda linha
    const member = "memberId" in item ? (item as FamilyTransaction) : null;
    // Linha de outra pessoa não abre o detalhe: lá dentro se edita apelido e
    // categoria, e o dado é dela. O servidor recusaria de qualquer forma (a
    // cláusula de dono), mas oferecer o toque seria prometer o que não se pode
    const alheia = member !== null && member.memberId !== myMemberId;

    // A anatomia da linha (disco da categoria, apoio, selos, valor, o que o
    // leitor de tela ouve) mora no TransactionRow — é a MESMA linha da Fatura
    // e da Revisão. Aqui só se resolve o que vem de fora do item
    return (
      <Animated.View entering={listItemEntering(index)}>
        <TransactionRow
          transaction={item}
          density="card"
          category={item.categoryId ? catById.get(item.categoryId) : undefined}
          account={item.accountId ? accountsById.get(item.accountId) : undefined}
          showOrigin={showOrigin}
          member={
            member
              ? {
                  memberId: member.memberId,
                  memberName: member.memberName,
                  isMe: member.memberId === myMemberId,
                }
              : null
          }
          onPress={alheia ? undefined : setDetailTx}
        />
      </Animated.View>
    );
  };

  // Primeiro load em tela vazia: esqueletos no lugar da lista. O RefreshControl
  // não monta aqui, então o spinner do pull-to-refresh não concorre com eles
  // As duas saídas antecipadas abaixo falam do extrato PESSOAL: na casa, quem
  // manda é o estado da lista da casa, e o extrato pessoal vazio (ou que falhou
  // ao baixar) não pode sequestrar a tela inteira
  if (!inFamilyScope && isLoading && !hasLoadedOnce && transactions.length === 0) {
    return (
      <PageContainer style={{ flex: 1, position: "relative" }}>
        <StatementSkeleton />
        <AssistantFAB origin="extrato" />
      </PageContainer>
    );
  }

  // Rede caiu antes da primeira lista: dizer "nenhum extrato importado" aqui
  // seria mentira — a pessoa tem histórico, só não conseguiu baixá-lo
  if (!inFamilyScope && bankError && !isLoading && transactions.length === 0) {
    return (
      <PageContainer style={{ flex: 1, position: "relative" }}>
        {/* EC-216: a porta que NÃO depende do que falhou. Se a leitura do
            servidor caiu, importar o arquivo continua funcionando — oferecer
            só "tentar de novo" é mandar a pessoa bater na mesma porta */}
        <ErrorState
          message={bankError}
          onRetry={fetchTransactions}
          fallbackLabel="Importar extrato de um arquivo"
          onFallback={handleImport}
        />
        <AssistantFAB origin="extrato" />
      </PageContainer>
    );
  }

  return (
    <PageContainer style={{ flex: 1, position: "relative" }}>
      <FlatList
        data={inFamilyScope ? visibleFamilyTransactions : visibleTransactions}
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
            refreshing={inFamilyScope ? isFamilyLoading : isLoading}
            // Puxar para atualizar é um pedido explícito: ignora a janela de
            // cache do store (`force`), senão o gesto não faria nada
            onRefresh={
              inFamilyScope
                ? loadFamilyTransactions
                : () => fetchTransactions(true)
            }
            colors={[t.accent.neon]}
          />
        }
        ListHeaderComponent={
          <View className="mb-6">
            {/* O alternador vem antes de tudo: ele decide de quem é a lista
                inteira que vem abaixo, inclusive as métricas */}
            <View
              className="flex-row items-center mb-4"
              style={{ gap: spacing[3] }}
            >
              <FamilyScopeToggle />
              <View style={{ flex: 1 }} />
              {inFamilyScope && (
                <CycleWindowChip
                  start={familyWindow.start}
                  end={familyWindow.end}
                  onPress={() => setAnchorSheetOpen(true)}
                />
              )}
            </View>

            {/* A lista antiga fica e o aviso entra por cima: recarga que
                falhou não pode apagar um extrato que já estava na tela, e
                nem virar toast — a frase e o "tentar de novo" ficam aqui */}
            {!inFamilyScope && bankError && transactions.length > 0 && (
              <ErrorState
                compact
                message={bankError}
                onRetry={fetchTransactions}
              />
            )}

            {inFamilyScope && memberOptions.length > 0 && (
              <View className="mb-4">
                <Text className="text-textTertiary mb-2" style={EYEBROW_TYPE}>
                  Quem
                </Text>
                <FilterChipRow
                  options={memberOptions}
                  value={activeMember}
                  onChange={setMemberFilter}
                  spokenPrefix="Lançamentos de"
                />
              </View>
            )}

            {inFamilyScope && familyError && (
              <ErrorState
                message={familyError}
                onRetry={loadFamilyTransactions}
              />
            )}

            {inFamilyScope &&
              !familyError &&
              !isFamilyLoading &&
              hasLoadedFamilyOnce &&
              familyTransactions.length === 0 && (
                <Text
                  className="text-textSecondary text-sm"
                  style={{ lineHeight: 20 }}
                >
                  Ninguém da casa está mostrando lançamentos neste período. Cada
                  pessoa escolhe o que compartilhar em Perfil › Casa.
                </Text>
              )}

            {!inFamilyScope && showOrigin && (
              <View className="mb-4">
                {/* A fileira vem ANTES dos números porque é ela que decide o
                    que está sendo somado — filtro embaixo do total faria o
                    usuário ler o valor errado antes de saber do recorte */}
                <Text className="text-textTertiary mb-2" style={EYEBROW_TYPE}>
                  Origem
                </Text>
                <FilterChipRow
                  options={originOptions.map((option) => ({
                    key: option.key,
                    label: option.label,
                    count: option.count,
                    // EC-229: reconhecer o roxo do Nubank e mais rapido do
                    // que ler o nome do cartao numa fileira rolante. "Tudo"
                    // e "Sem origem" nao tem conta, entao ficam sem logo
                    brand:
                      option.account?.institution ??
                      (option.account && bankKeyFor(option.account.name)
                        ? option.account.name
                        : null),
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
                  <Text
                    className="text-textSecondary mt-0.5"
                    style={{ fontSize: 11, lineHeight: 16 }}
                  >
                    Não conseguimos carregar suas contas, então o extrato não
                    consegue dizer de qual cartão vem cada lançamento. Toque
                    para tentar de novo.
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Daqui para baixo é a visão PESSOAL: métricas, rosca por
                categoria e as portas de importar e sincronizar. Na casa nada
                disso vale — os números de lá são da Análise, que soma o que
                cada um mostra, e importar extrato é ato individual */}
            {!inFamilyScope && (
            <>
            <Animated.View entering={cardEntering} className="mb-4">
              {/* EC-225: o bloco inteiro gira, e não cada número. Os três saem
                  do MESMO conjunto de linhas, então três versos iguais seriam
                  a mesma resposta repetida — um gesto, uma resposta */}
              <FlipCard
                flipped={origemAberta}
                back={<ProvenanceBack summary={procedencia} />}
                front={
                  <TouchableOpacity
                    onPress={virarOrigem}
                    activeOpacity={0.9}
                    accessibilityRole="button"
                    accessibilityLabel="Ver de onde estes números foram somados"
                  >
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
                <Text
                  className="text-textTertiary mt-2"
                  style={{ fontSize: 11, lineHeight: 16 }}
                >
                  {scopeNote}
                </Text>
              )}
                  </TouchableOpacity>
                }
              />
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
            {connector.enabled && (
              <View className="bg-surface rounded-3xl p-4 border border-border mt-4">
                <View className="flex-row items-center mb-2">
                  <Link2 size={18} color={t.accent.neon} />
                  <Text className="text-base font-bold text-textPrimary ml-2">
                    Conexão bancária
                  </Text>
                </View>

                {/* Uma frase para o que acontece, sem nome de provedor: o
                    usuário autoriza no banco dele e o resto é nosso */}
                <Text
                  className="text-xs text-textSecondary mb-3"
                  style={{ lineHeight: 17 }}
                >
                  {connections.length > 0
                    ? `${connections.length} ${plural(connections.length, "banco conectado", "bancos conectados")} pelo Open Finance. Você autoriza no seu banco; nós buscamos os lançamentos e nada duplica — a sincronização traz os últimos 90 dias.`
                    : "Conecte seu banco pelo Open Finance. Você autoriza no seu banco; nós buscamos os lançamentos e nada duplica."}
                </Text>

                <BalanceCheckNotice findings={avisosDeSaldo} />

                {/* A mesma conta entrando por arquivo E por conector deixa o
                    app com duas origens, e aí nenhum total por conta fecha.
                    Medido na conta do dono: 1.632 dos 1.967 lançamentos
                    moravam na origem solta do Inter, e o saldo só existia na
                    ligada. Ver components/DuplicateAccountsCard */}
                <DuplicateAccountsCard
                  suggestions={duplicadas}
                  onMerge={juntarContas}
                />

                {/* Conexões do usuário. Desde o EC-106 os itens são por conta:
                    conectar deixou de ser configuração de servidor. O nome é
                    a INSTITUIÇÃO — o nome do conector no provedor nunca entra */}
                {connections.map((conexao) => {
                  const nome = connectionLabel(conexao);
                  return (
                    <View
                      key={conexao.id}
                      className="flex-row items-center justify-between bg-elevated border border-border rounded-2xl px-3 py-3 mb-2"
                    >
                      <BankLogo
                        institution={conexao.institution}
                        size={36}
                        Fallback={Landmark}
                        style={{ marginRight: spacing[3] }}
                      />
                      <View className="flex-1 pr-3">
                        <Text
                          className="text-sm font-bold text-textPrimary"
                          numberOfLines={1}
                        >
                          {nome}
                        </Text>
                        {/* Dia e mês não diziam se a leitura tinha uma hora
                            ou onze; o carimbo diz, e muda de cor passado um
                            dia sem sincronizar */}
                        <FreshnessStamp
                          at={conexao.lastSyncedAt}
                          prefix="sincronizado"
                          style={{ marginTop: 2 }}
                        />
                      </View>
                      <TouchableOpacity
                        onPress={() => handleDesconectar(conexao.id, nome)}
                        accessibilityRole="button"
                        accessibilityLabel={`Desconectar ${nome}`}
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                      >
                        <Unlink size={16} color={t.text.tertiary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                <TouchableOpacity
                  className="flex-row items-center justify-center bg-accentMuted border border-accent rounded-full px-4 py-3 mt-1"
                  onPress={handleConectarBanco}
                  disabled={isLinking}
                  accessibilityLabel="Conectar um banco pelo Open Finance"
                  accessibilityRole="button"
                  activeOpacity={0.85}
                  style={{ opacity: isLinking ? 0.6 : 1 }}
                >
                  {isLinking ? (
                    <ActivityIndicator size="small" color={t.accent.neon} />
                  ) : (
                    <Plus size={16} color={t.accent.neon} />
                  )}
                  <Text className="text-accent font-bold text-sm ml-2">
                    {isLinking
                      ? "Abrindo…"
                      : connections.length > 0
                        ? "Conectar outro banco"
                        : "Conectar meu banco"}
                  </Text>
                </TouchableOpacity>

                {connections.length > 0 && (
                  <TouchableOpacity
                    className="flex-row items-center justify-center border border-border rounded-full px-4 py-3 mt-2"
                    onPress={handleConnectorSync}
                    disabled={isSyncing}
                    accessibilityLabel="Sincronizar bancos conectados"
                    accessibilityRole="button"
                    activeOpacity={0.85}
                    style={{ opacity: isSyncing ? 0.6 : 1 }}
                  >
                    {isSyncing ? (
                      <ActivityIndicator size="small" color={t.text.secondary} />
                    ) : (
                      <RefreshCw size={16} color={t.text.secondary} />
                    )}
                    <Text className="text-textPrimary font-bold text-sm ml-2">
                      {isSyncing ? "Sincronizando…" : "Sincronizar agora"}
                    </Text>
                  </TouchableOpacity>
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
                    className="rounded-xl justify-center items-center bg-surface border border-border"
                    style={{ width: BANK_SHORTCUT_SIZE, height: BANK_SHORTCUT_SIZE }}
                    onPress={() => openBankApp(bank.url)}
                    accessibilityLabel={`Abrir app do ${bank.name}`}
                    accessibilityRole="button"
                    activeOpacity={0.8}
                  >
                    {/* O logo carrega a marca; o rótulo embaixo é para quem
                        não a reconhece de vista — e para quem não tem logo,
                        que fica com o monograma */}
                    <BankLogo institution={bank.name} size={34} />
                    <Text
                      className="text-textSecondary font-bold mt-1"
                      style={{ fontSize: 10 }}
                      numberOfLines={1}
                    >
                      {bank.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {transactions.length > 0 && (
              <>
                <View className="flex-row items-center justify-between mt-5 mb-2">
                  {/* "Lançamentos", e não "Histórico de Transações": a
                      Carteira, aba irmã, usa este segundo título para o
                      histórico de ATIVOS — duas seções homônimas nomeando
                      coisas diferentes */}
                  <Text className="text-lg font-bold text-textPrimary">
                    Lançamentos
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
                        {isImporting ? (legendaDaImportacao ?? "Importando") : "Importar"}
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
                      onPress={() =>
                        (navigation as any).navigate(APP_ROUTES.revisao)
                      }
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
            </>
            )}
          </View>
        }
        ListEmptyComponent={
          // Na casa o vazio já é explicado no cabeçalho ("ninguém está
          // mostrando lançamentos"): repetir o convite a importar aqui pediria
          // à pessoa que resolvesse com o extrato dela algo que não é dela
          inFamilyScope ? null : (
          // EC-231: o pote vazio no lugar do glifo de arquivo num disco; o
          // card tracejado continua dizendo "aqui vai entrar algo". A segunda
          // porta (conectar o banco) só existe para quem tem o conector
          // ligado — quem não configurou não precisa nem saber dele
          <Animated.View
            entering={cardEntering}
            className="mt-6 bg-surface rounded-3xl border border-dashed border-border"
          >
            <PotEmptyState
              mood="comecar"
              size={72}
              title="Nenhum extrato importado"
              body="Exporte o extrato no app do seu banco — prefira OFX, ou CSV — e importe aqui para gerar seus gráficos e relatórios."
              actionLabel={isImporting ? "Importando…" : "Importar extrato"}
              onAction={handleImport}
              secondaryActionLabel={connector.enabled ? "Conectar banco" : undefined}
              onSecondaryAction={connector.enabled ? handleConectarBanco : undefined}
            />
          </Animated.View>
          )
        }
      />

      <TransactionDetailSheet
        transaction={detailTx}
        visible={detailTx !== null}
        onClose={() => setDetailTx(null)}
        onUpdated={applyTransaction}
      />

      {/* A âncora do ciclo é a MESMA da Home e da Análise: mudar aqui muda lá */}
      <CycleAnchorSheet
        visible={anchorSheetOpen}
        onClose={() => setAnchorSheetOpen(false)}
      />

      <AssistantFAB origin="extrato" />
    </PageContainer>
  );
}
