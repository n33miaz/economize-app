import React, { useEffect, useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from "react-native";
import ArrowDownRight from "lucide-react-native/dist/esm/icons/arrow-down-right";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import Banknote from "lucide-react-native/dist/esm/icons/banknote";
import Bitcoin from "lucide-react-native/dist/esm/icons/bitcoin";
import CalendarRange from "lucide-react-native/dist/esm/icons/calendar-range";
import ChartColumn from "lucide-react-native/dist/esm/icons/chart-column";
import ChartPie from "lucide-react-native/dist/esm/icons/chart-pie";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Eye from "lucide-react-native/dist/esm/icons/eye";
import EyeOff from "lucide-react-native/dist/esm/icons/eye-off";
import ListChecks from "lucide-react-native/dist/esm/icons/list-checks";
import Star from "lucide-react-native/dist/esm/icons/star";
import TrendingUp from "lucide-react-native/dist/esm/icons/trending-up";
import Upload from "lucide-react-native/dist/esm/icons/upload";
import type { LucideIcon } from "lucide-react-native";
import {
  useFocusEffect,
  useIsFocused,
  useNavigation,
} from "@react-navigation/native";
import * as Haptics from "../utils/haptics";
import Animated from "react-native-reanimated";

import { Indicator, getDailyTotals } from "../services/api";
import type { DailyTotal } from "../services/api";
import type { AppTheme } from "../theme/colors";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import useNewsData from "../hooks/useNewsData";
import { useAuthStore } from "../store/authStore";
import { useIndicatorStore } from "../store/indicatorStore";
import { hasMovement, useAnalyticsStore } from "../store/analyticsStore";
import { useWalletStore } from "../store/walletStore";
import { useFavoritesStore } from "../store/favoritesStore";
import {
  useAdvancedView,
  usePreferencesStore,
} from "../store/preferencesStore";
import { useRecurrenceStore } from "../store/recurrenceStore";
import { useWishStore } from "../store/wishStore";
import MealVoucherPrompt from "../components/MealVoucherPrompt";
import MetricGrid from "../components/MetricGrid";
import MetricTile from "../components/MetricTile";
import SpendingCalendar from "../components/SpendingCalendar";
import { currentWeek, weekComparison } from "../utils/weekCut";
import { mealVoucherAsk } from "../utils/mealVoucher";
import { todayIso } from "../utils/cycleWindow";
import { describeSalaryTiming } from "../utils/wishes";
import { cyclePerformance } from "../utils/pot";
import PotIcon, { potStateFor } from "../components/PotIcon";
import PotStatesSheet from "../components/PotStatesSheet";
import { useOpeningStore } from "../store/openingStore";
import { useReviewStore } from "../store/reviewStore";

import BlockGrid from "../components/BlockGrid";
import AdSlot from "../components/AdSlot";
import PremiumOfferSheet from "../components/PremiumOfferSheet";
import CategoryIcon, { resolveCategoryColor } from "../components/CategoryIcon";
import CycleAnchorSheet from "../components/CycleAnchorSheet";
import CycleWindowChip from "../components/CycleWindowChip";
import HighlightCard from "../components/HighlightCard";
import PageContainer from "../components/PageContainer";
import Skeleton from "../components/Skeleton";
import ScreenHeader from "../components/ScreenHeader";
import IndicatorDetailSheet from "../components/IndicatorDetailSheet";
import AssistantFAB from "../components/AssistantFAB";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { usePremiumOffer } from "../hooks/usePremiumOffer";
import { useAccountsStore } from "../store/accountsStore";
import { ANNOUNCEMENT_PRIORITY } from "../store/announcementStore";
import { useAnnouncement } from "../hooks/useAnnouncement";
import { cashPositionFrom, creditPositionFrom } from "../utils/cashPosition";
import { installmentsSummary } from "../utils/installments";
import { buildUpcoming, type UpcomingItem } from "../utils/upcoming";
import { useInstallmentsStore } from "../store/installmentsStore";
import InstallmentsCard from "../components/InstallmentsCard";
import UpcomingBillsCard from "../components/UpcomingBillsCard";
import {
  formatBRL,
  formatBRLCompact,
  formatDecimal,
  formatPercent,
} from "../utils/money";
import { formatMonthLabel, formatWindowLabel } from "../utils/cycleWindow";
import { favoriteDisplayItems } from "../utils/indicatorList";
import {
  firstRiskMonth,
  forecastPeriodLabel,
  upcomingCommitment,
} from "../utils/recurrence";

// Mesma janela usada na aba de recorrências: o mês seguinte inteiro cabe aqui
const COMMITMENT_WINDOW_DAYS = 30;

const HIDDEN = "R$ •••••";

// O que o leitor de tela ouve quando o "olhinho" está fechado: dizer o valor
// que a tela esconde seria furar a própria preferência do usuário
const HIDDEN_SPOKEN = "valor oculto";

/**
 * Peso relativo de altura de cada bloco, para a grade de duas colunas.
 *
 * É estimativa de quem monta a tela, não medição: a altura real só existe
 * depois do layout. A escala não importa, só a proporção entre eles. Sem isto
 * o rodízio é cego e a Home de um usuário SEM extrato (que perde três dos oito
 * blocos) nascia com a coluna direita terminando na metade da esquerda —
 * justamente a primeiríssima tela de quem acabou de se cadastrar.
 */
// Peso = altura relativa do bloco, usada pela grade para equilibrar as duas
// colunas do desktop. `vale` e `calendario` estavam FORA desta lista e caíam no
// padrão 1 — e o calendário é um dos blocos mais altos da tela, o que deixava
// uma coluna com o dobro da outra. Entraram junto com os dois blocos novos.
const BLOCK_WEIGHTS = {
  mes: 5,
  vale: 1,
  revisao: 1,
  compromisso: 3,
  parcelamentos: 3,
  calendario: 5,
  destino: 5,
  atalhos: 1,
  carteira: 2,
  mercado: 3,
  noticias: 4,
};

/**
 * A Home é a tela do MÊS. O extrato é o produto: o primeiro bloco responde
 * "quanto entrou, quanto saiu, sobrou quanto", o segundo mostra o que exige
 * decisão (revisão) e o terceiro para onde o dinheiro foi. Carteira, mercado e
 * notícias vêm depois — são contexto, não a razão de abrir o app.
 */
export default function Home() {
  const navigation = useNavigation();
  const t = useTheme();
  // A Home é uma pilha de blocos independentes — o caso mais direto de grade:
  // no desktop eles se dividem em duas colunas em vez de virar uma fita de
  // 1180 px de largura por três telas de altura
  const { columns } = useBreakpoint();
  const plusOffer = usePremiumOffer();
  const { cardEntering, listItemEntering } = useMotionPresets();
  // Preferência persistida: o "olhinho" sobrevive ao fechamento do app
  const hideBalance = usePreferencesStore((s) => s.hideBalance);
  const toggleHideBalance = usePreferencesStore((s) => s.toggleHideBalance);
  const potAnnouncementSeen = usePreferencesStore((s) => s.potAnnouncementSeen);
  const setPotAnnouncementSeen = usePreferencesStore(
    (s) => s.setPotAnnouncementSeen,
  );
  const mealVoucherPromptDismissedFor = usePreferencesStore(
    (s) => s.mealVoucherPromptDismissedFor,
  );
  const dismissMealVoucherPrompt = usePreferencesStore(
    (s) => s.dismissMealVoucherPrompt,
  );
  const showBalance = !hideBalance;
  const { userName } = useAuthStore();

  const {
    indicators,
    loading: indicatorsLoading,
    fetchIndicators,
  } = useIndicatorStore();
  const favoriteSnapshots = useIndicatorStore((s) => s.favoriteSnapshots);
  const { articles: news, loading: newsLoading, fetchNews } = useNewsData();
  // Consolidação própria da Home: o mês escolhido na Análise é dela, aqui a
  // resposta é sempre sobre o mês corrente
  const {
    homeData: monthly,
    isHomeLoading: monthlyLoading,
    months: monthsWithData,
    fetchHomeMonthly,
  } = useAnalyticsStore();
  const { transactions: walletTxs, fetchTransactions: fetchWallet } =
    useWalletStore();
  const { favorites } = useFavoritesStore();
  // EC-235: os totais por dia do mês corrente, agregados no servidor. Trinta
  // números custam menos de 2 KB; baixar o extrato inteiro para somá-los
  // custaria 92 KB e segundos de espera
  const [diasDoMes, setDiasDoMes] = useState<DailyTotal[]>([]);
  /**
   * Os parcelamentos vêm do store, e não de estado local por foco.
   *
   * <p>A varredura do servidor passa por TODAS as transações do usuário a cada
   * chamada (`InstallmentProjectionService`), e a Home pedia isso a cada foco
   * de tela — voltar de Relatórios refazia a conta inteira. O store guarda por
   * cinco minutos, e duas telas que perguntam a mesma coisa dividem a resposta.
   */
  const parcelamentos = useInstallmentsStore((s) => s.overview);
  const fetchInstallments = useInstallmentsStore((s) => s.fetchInstallments);
  const mesCorrente = useMemo(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
  }, []);
  /**
   * O recorte que a chamada pede: do mês corrente MENOS 14 dias até hoje.
   *
   * Os 14 dias a mais existem para a comparação semanal: a semana anterior
   * pode começar no mês passado, e uma segunda chamada só para ela seria uma
   * segunda fonte para a mesma pergunta — exatamente como um app passa a
   * discordar de si mesmo. O calendário ignora os dias de fora sozinho.
   */
  const recorteDiario = useMemo(() => {
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate(),
      ).padStart(2, "0")}`;
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    inicio.setDate(inicio.getDate() - 14);
    return {
      kind: "window" as const,
      start: iso(inicio),
      end: iso(hoje),
    };
  }, []);
  // A semana sai dos MESMOS dias do calendário, nunca de outra consulta
  const semana = useMemo(() => currentWeek(diasDoMes), [diasDoMes]);
  const ritmoDaSemana = useMemo(() => weekComparison(semana), [semana]);
  // Só a CONTAGEM: a Home escreve "N esperando você" e não desenha
  // nenhuma das linhas. Buscar a fila agrupada custava 92 KB e 2,1 s a
  // cada abertura para chegar a um número
  const fetchPendingCount = useReviewStore((s) => s.fetchPendingCount);
  const pendingReviewCount = useReviewStore((s) => s.pendingCount ?? 0);
  // Só a lista de séries (chamada leve): a projeção de saldo depende do saldo
  // base do extrato e vive na tela dedicada — aqui basta o que já está
  // comprometido, que sai das próprias séries
  const recurringSeries = useRecurrenceStore((s) => s.series);
  const forecast = useRecurrenceStore((s) => s.forecast);
  const fetchRecurrences = useRecurrenceStore((s) => s.fetchSeries);
  // EC-136: o mesmo cartão de comprometimento ganha a leitura ancorada no
  // salário. Dois cartões seriam dois números sobre a mesma coisa
  const committed = useWishStore((s) => s.committed);
  const fetchCommitted = useWishStore((s) => s.fetchCommitted);
  // EC-137: as fontes de renda trazem a âncora do VR, que é o que diz QUANDO
  // perguntar. Chamada leve, e é a mesma que a tela de Renda já usa
  const incomeSources = useWishStore((s) => s.income?.sources);
  const fetchIncome = useWishStore((s) => s.fetchIncome);

  // EC-137: o VR cai antes do salário e é gasto antes de o mês fechar. O app
  // pergunta no momento em que a compra provavelmente aconteceu — depois, a
  // pessoa não lembra mais
  const vrAsk = useMemo(
    () =>
      mealVoucherAsk({
        sources: incomeSources ?? [],
        today: todayIso(),
        lastTransactionDate: monthly?.lastTransactionDate,
        dismissedFor: mealVoucherPromptDismissedFor,
      }),
    [
      incomeSources,
      monthly?.lastTransactionDate,
      mealVoucherPromptDismissedFor,
    ],
  );

  // EC-146: o pote conta o ciclo. `null` enquanto não há dado — e aí ele
  // aparece no estado neutro, nunca no vermelho
  const performance = useMemo(() => cyclePerformance(monthly), [monthly]);
  const potState = useMemo(
    () =>
      performance
        ? potStateFor(performance.kept, performance.income)
        : potStateFor(0, 0),
    [performance],
  );
  const [potSheetOpen, setPotSheetOpen] = useState(false);

  /**
   * Quanto existe em conta — e a diferença entre saber e chutar.
   *
   * <p>O dono olhou a Home em 15/09/2026 e disse: <i>"não faz o menor sentido
   * ter sobrado 3.021,06 — não tem nada nas minhas contas"</i>. O número estava
   * aritmeticamente certo (era o que sobrou no mês) e semanticamente errado:
   * quem abre um app de finanças e vê um valor grande no topo lê SALDO. O
   * rótulo dizia "sobrou", e ninguém lê rótulo antes de número.
   *
   * <p>A manchete passou a ser o saldo de verdade, quando ele existe — o que
   * a instituição informou, pelo conector ou pelo bloco `LEDGERBAL` do OFX que
   * a pessoa sobe. Quando não existe, a Home volta a falar do mês e DIZ que
   * não sabe o saldo, em vez de deixar a ambiguidade de pé. Ver
   * `utils/cashPosition`.
   */
  const accounts = useAccountsStore((s) => s.accounts);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);
  const cash = useMemo(() => cashPositionFrom(accounts), [accounts]);
  const credito = useMemo(() => creditPositionFrom(accounts), [accounts]);
  const saldoConhecido = cash.amount != null;

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // A cortina de abertura espera POR AQUI. O sinal é "já sei o que mostrar",
  // e não "deu tudo certo": mês sem movimento também é resposta, e segurar a
  // animação esperando um número que não existe deixaria a tela presa
  const marcarPronto = useOpeningStore((s) => s.markReady);
  useEffect(() => {
    if (!monthlyLoading) marcarPronto();
  }, [monthlyLoading, marcarPronto]);

  // EC-147: o anúncio acontece UMA vez, e só quando já há ciclo para mostrar —
  // explicar os estados do pote sobre uma tela vazia não ensina nada, e queimar
  // o anúncio no primeiro acesso desperdiça a única chance de contar isso
  // E só com a Home NA FRENTE: a aba fica montada por baixo das outras telas,
  // e a folha é um Modal — aberta com a pessoa em Relatórios, ela cobria
  // Relatórios. Aconteceu na prova em navegador: o mês chegou depois de a
  // pessoa já ter saído da Home
  const homeEmFoco = useIsFocused();
  useEffect(() => {
    if (!homeEmFoco || potAnnouncementSeen || potSheetOpen) return;
    if (!performance || performance.income <= 0) return;
    setPotSheetOpen(true);
  }, [homeEmFoco, potAnnouncementSeen, potSheetOpen, performance]);

  /**
   * A FILA DA ABERTURA. O dono relatou em 16/09/2026 que "os modais estão
   * aparecendo todos ao mesmo tempo ao entrar no app". Estavam: o anúncio de
   * versão, a apresentação do pote e a oferta do Plus têm condições que se
   * satisfazem no MESMO instante — o app acabou de abrir. Três folhas
   * empilhadas não são três avisos, são zero: a pessoa fecha tudo no reflexo.
   *
   * Cada uma continua decidindo se QUER aparecer; quem decide se PODE é a
   * ordem em `store/announcementStore` — informação antes de comercial,
   * sempre.
   */
  const poteNaVez = useAnnouncement(
    "pot-states",
    ANNOUNCEMENT_PRIORITY.potStates,
    potSheetOpen,
  );
  const plusNaVez = useAnnouncement(
    "premium-offer",
    ANNOUNCEMENT_PRIORITY.premiumOffer,
    plusOffer.visible,
  );

  const fecharAnuncioDoPote = useCallback(() => {
    setPotSheetOpen(false);
    if (!potAnnouncementSeen) setPotAnnouncementSeen(true);
  }, [potAnnouncementSeen, setPotAnnouncementSeen]);

  // As três buscas vêm de store ou de useCallback estável: entram na lista
  // por honestidade com o lint, e rodam uma vez, na montagem
  useEffect(() => {
    fetchIndicators();
    fetchNews();
    fetchWallet();
  }, [fetchIndicators, fetchNews, fetchWallet]);

  // Importar extrato ou revisar acontece em outras telas — revalida a cada
  // foco, que já cobre a montagem: uma busca só, sem duas correndo juntas
  useFocusEffect(
    useCallback(() => {
      fetchPendingCount();
      fetchHomeMonthly();
      fetchRecurrences();
      fetchCommitted();
      fetchIncome();
      // Calendário do mês (EC-235): best-effort, como a conferência de saldo.
      // Uma falha aqui apaga a grade e mantém o resto da tela — ela é leitura
      // adicional, não a resposta principal
      getDailyTotals(recorteDiario)
        .then(setDiasDoMes)
        .catch(() => setDiasDoMes([]));
      // Parcelamentos (EC-213): best-effort como o resto — são leitura
      // adicional, não a resposta principal da tela. O store decide se a
      // chamada vale (TTL de 5 min)
      fetchInstallments();
    }, [
      fetchPendingCount,
      fetchHomeMonthly,
      fetchRecurrences,
      fetchCommitted,
      fetchIncome,
      fetchInstallments,
      recorteDiario,
    ]),
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // Puxar para atualizar é pedido explícito: as buscas com janela de cache
    // recebem `force`, senão o gesto não faria nada
    await Promise.all([
      fetchIndicators(),
      fetchNews(),
      fetchWallet(true),
      fetchHomeMonthly(),
      fetchPendingCount(),
    ]);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [
    fetchIndicators,
    fetchNews,
    fetchWallet,
    fetchHomeMonthly,
    fetchPendingCount,
  ]);

  const walletBalance = useMemo(() => {
    return walletTxs.reduce((total, tx) => {
      const indicator = indicators.find((i) => i.code === tx.assetCode);
      const currentPrice = indicator ? indicator.buy : tx.priceAtTransaction;
      return total + tx.quantity * currentPrice;
    }, 0);
  }, [walletTxs, indicators]);

  // Rentabilidade real da carteira (valor atual vs custo de aquisição);
  // null quando não há base de custo — o badge some em vez de inventar número
  const walletPerformance = useMemo(() => {
    let cost = 0;
    let current = 0;
    walletTxs.forEach((tx) => {
      const indicator = indicators.find((i) => i.code === tx.assetCode);
      const currentPrice = indicator ? indicator.buy : tx.priceAtTransaction;
      cost += tx.quantity * tx.priceAtTransaction;
      current += tx.quantity * currentPrice;
    });
    if (cost <= 0) return null;
    return ((current - cost) / cost) * 100;
  }, [walletTxs, indicators]);

  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(
    null,
  );
  const [anchorSheetOpen, setAnchorSheetOpen] = useState(false);

  // Top 3 do ranking de saídas — o resto é a tela de Análise
  const topExpenses = useMemo(
    () =>
      (monthly?.categories ?? [])
        .filter((slice) => slice.expenseTotal > 0)
        .slice(0, 3),
    [monthly],
  );

  const avancado = useAdvancedView();

  const expenseDeltaPct = useMemo(() => {
    if (!monthly || monthly.previous.totalExpense <= 0) return null;
    return (
      ((monthly.totalExpense - monthly.previous.totalExpense) /
        monthly.previous.totalExpense) *
      100
    );
  }, [monthly]);

  // Duas perguntas diferentes, e confundi-las mandava importar extrato para
  // quem já tinha importado: "existe extrato?" se responde com os meses que o
  // servidor conhece; "houve movimento NESTA janela?" só com a consolidação.
  // Ciclo parado com extrato na conta é estado de período vazio, não onboarding
  const hasStatement = monthsWithData.length > 0;
  const hasMonthData = hasMovement(monthly);
  // O período já respondeu (mesmo que zerado): é o que libera a janela e a
  // engrenagem na tela, como o comentário do bloco "Para onde foi" sempre pediu
  const hasPeriod = monthly !== null;

  const recentNews = useMemo(() => (news ? news.slice(0, 3) : []), [news]);
  const isContentLoading = indicatorsLoading || newsLoading;

  // `fromFavorites` acompanha a lista para o título nunca ficar órfão:
  // "Favoritados" só aparece quando há de fato um card de favorito para
  // mostrar — favoritos sem dado renderizável (indicadores fora do ar, id
  // que não bate) caem nos destaques padrão em vez de num cabeçalho vazio
  const { items: highlights, fromFavorites } = useMemo(() => {
    // Dedup por code nos DOIS ramos: a API repete ativos e o slot liberado
    // passa naturalmente para o próximo indicador distinto
    const seen = new Set<string>();
    const isDistinct = (item: Indicator) => {
      if (seen.has(item.code)) return false;
      seen.add(item.code);
      return true;
    };

    if (favorites.length > 0) {
      // Os retratos cobrem favoritos que não vivem na lista principal
      // (favoritados a partir da busca remota do Mercado)
      const favoriteItems = favoriteDisplayItems(
        indicators,
        favoriteSnapshots,
        favorites,
      ).filter(isDistinct);
      if (favoriteItems.length > 0) {
        return { items: favoriteItems, fromFavorites: true };
      }
    }

    const defaultCodes = ["USD", "CDI", "EUR", "BTC", "IBOVESPA"];

    return {
      items: indicators.filter((item) => {
        const match =
          defaultCodes.includes(item.code) || defaultCodes.includes(item.name);
        return match && isDistinct(item);
      }),
      fromFavorites: false,
    };
  }, [indicators, favoriteSnapshots, favorites]);

  const toggleBalance = () => {
    Haptics.selectionAsync();
    toggleHideBalance();
  };

  // Compromisso dos próximos 30 dias direto das séries: número honesto sem
  // depender do saldo base, que só a tela de previsão sabe montar
  /**
   * O que vence nos próximos 30 dias, com nome e data — recorrências E faturas
   * de cartão na mesma régua, ordenadas por quem vence antes.
   *
   * <p>`upcomingCommitment` (a versão antiga) devolvia só total e nome da
   * próxima. A fatura do cartão não entrava, e ela é justamente a conta que
   * mais aperta. A dedução do vencimento de fatura e a regra de não contar a
   * mesma dívida duas vezes moram em `utils/upcoming`.
   */
  const upcoming = useMemo(
    () =>
      buildUpcoming({
        series: recurringSeries,
        accounts,
        installments: parcelamentos,
      }),
    [recurringSeries, accounts, parcelamentos],
  );

  /** As séries de parcelamento abertas, já com progresso e carga mensal. */
  const parcelas = useMemo(
    () => installmentsSummary(parcelamentos),
    [parcelamentos],
  );

  /**
   * Cada linha do "a pagar" leva ao lugar onde ela se resolve: recorrência
   * abre Recorrências, fatura abre Cartões. Levar tudo para o mesmo lugar
   * transformaria a lista em decoração.
   */
  const abrirCompromisso = useCallback(
    (item: UpcomingItem) => {
      if (item.target.route === "Cartões") {
        navigation.navigate("Cartões" as never);
        return;
      }
      (navigation as any).navigate("Finanças", { screen: "Recorrências" });
    },
    [navigation],
  );

  const commitment = useMemo(
    () => upcomingCommitment(recurringSeries, COMMITMENT_WINDOW_DAYS),
    [recurringSeries],
  );
  // Só quando a projeção já foi calculada nesta sessão — sem saldo base, um
  // "mês negativo" seria alarme falso
  const riskMonth = useMemo(() => firstRiskMonth(forecast?.months), [forecast]);

  const goToImport = () =>
    (navigation as any).navigate("Finanças", { screen: "Extrato" });
  const goToAnalytics = () => navigation.navigate("Análise" as never);
  const goToCards = () => navigation.navigate("Cartões" as never);
  const goToRecurrences = () =>
    (navigation as any).navigate("Finanças", { screen: "Recorrências" });

  const firstName = userName ? userName.split(" ")[0] : "por aqui";

  // Rótulo humano do período: mês de calendário quando a âncora é o dia 1, e o
  // recorte por extenso quando não é — dizer "agosto" sobre 12/07→11/08 seria
  // trocar o significado do número sem avisar
  const windowLabel = formatWindowLabel(monthly?.start, monthly?.end);
  const periodLabel = monthly?.month
    ? formatMonthLabel(monthly.month)
    : (windowLabel ?? "este período");
  const isWindowMode = monthly !== null && !monthly.month;
  // Janela anterior de mesmo tamanho × mês anterior do calendário: os dois
  // modos comparam coisas diferentes, e a linha do delta precisa dizer qual
  const previousLabel = monthly?.previous.month
    ? formatMonthLabel(monthly.previous.month)
    : "a janela anterior";
  const previousWindowLabel = formatWindowLabel(
    monthly?.previous.start,
    monthly?.previous.end,
  );

  return (
    // A Home era a única tela fora do PageContainer: no desktop ela corria de
    // borda a borda enquanto todas as outras paravam em 1180 px centrados.
    // `animateEntry={false}` porque os oito blocos abaixo já entram em
    // cascata: somadas, as duas animações davam 24 px de deslocamento e
    // opacidade ao quadrado no primeiro card
    <PageContainer animateEntry={false}>
      <ScreenHeader
        title={`Olá, ${firstName}`}
        subtitle={hasMonthData ? periodLabel : "Vamos organizar seu mês"}
        rightActions={[
          <TouchableOpacity
            key="market"
            className="bg-elevated active:bg-border"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
            }}
            // EC-105: a tela de favoritos foi aposentada — eles agora moram
            // no topo das abas do Mercado, para onde a estrela leva
            onPress={() =>
              (navigation as any).navigate("Main", { screen: "Indicadores" })
            }
            accessibilityLabel="Ver mercado e favoritos"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          >
            <Star size={18} color={t.text.primary} />
          </TouchableOpacity>,
        ]}
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="pb-10 pt-4"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isContentLoading}
            onRefresh={onRefresh}
            tintColor={t.accent.neon}
          />
        }
      >
        {/* Tudo aqui é bloco independente: no celular sai empilhado nesta
            ordem, que é a de prioridade; a partir de 768 px de miolo os mesmos
            blocos se revezam entre duas colunas — o card do mês fica no topo
            da esquerda e o que pede ação sobe para o topo da direita, em vez
            de um card de 1180 px de largura com o número num canto */}
        <BlockGrid columns={columns} weights={BLOCK_WEIGHTS}>
          {[
            /* O mês: a resposta que o app existe para dar */
            <Animated.View
              key="mes"
              entering={cardEntering}
              className="mx-5 mb-5 bg-surface border border-border rounded-3xl p-5"
            >
              {/* O `monthly === null` explícito é o que estreita o tipo para o ramo
                  de baixo; `hasMonthData` sozinho é boolean e não estreita nada */}
              {monthly === null || !hasMonthData ? (
                monthlyLoading ? (
                  <View>
                    <Skeleton width={120} height={14} />
                    <View style={{ height: spacing[3] }} />
                    <Skeleton width="70%" height={34} />
                    <View style={{ height: spacing[4] }} />
                    <Skeleton
                      width="100%"
                      height={44}
                      borderRadius={radius.full}
                    />
                  </View>
                ) : hasStatement ? (
                  // Tem extrato, o ciclo é que está parado. Pedir importação aqui
                  // era mentira; o que falta é poder mexer no recorte, então a
                  // engrenagem vem junto do texto
                  <View
                    style={{
                      alignItems: "center",
                      paddingVertical: spacing[2],
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.full,
                        backgroundColor: t.background.elevated,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: spacing[3],
                      }}
                    >
                      <CalendarRange size={26} color={t.text.tertiary} />
                    </View>
                    <Text
                      style={{
                        color: t.text.primary,
                        fontSize: 18,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      Nada movimentou{" "}
                      {isWindowMode ? "neste ciclo" : "neste mês"}
                    </Text>
                    <Text
                      style={{
                        color: t.text.secondary,
                        fontSize: 13,
                        lineHeight: 19,
                        textAlign: "center",
                        marginTop: spacing[1],
                      }}
                    >
                      Seu extrato está aqui, mas nenhum lançamento caiu em{" "}
                      {windowLabel ?? "no período"}. Confira o recorte ou veja o
                      histórico completo.
                    </Text>
                    <View style={{ marginTop: spacing[4] }}>
                      <CycleWindowChip
                        start={monthly?.start}
                        end={monthly?.end}
                        onPress={() => setAnchorSheetOpen(true)}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={goToImport}
                      accessibilityLabel="Ver extrato completo"
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      style={{
                        marginTop: spacing[3],
                        height: 44,
                        paddingHorizontal: spacing[5],
                        borderRadius: radius.full,
                        borderWidth: 1,
                        borderColor: t.border.subtle,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: t.text.secondary,
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        Ver extrato
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View
                    style={{
                      alignItems: "center",
                      paddingVertical: spacing[2],
                    }}
                  >
                    <View
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: radius.full,
                        backgroundColor: t.accent.neonMuted,
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: spacing[3],
                      }}
                    >
                      <Upload size={26} color={t.accent.neon} />
                    </View>
                    <Text
                      style={{
                        color: t.text.primary,
                        fontSize: 18,
                        fontWeight: "700",
                        textAlign: "center",
                      }}
                    >
                      Tudo começa com um extrato
                    </Text>
                    <Text
                      style={{
                        color: t.text.secondary,
                        fontSize: 13,
                        lineHeight: 19,
                        textAlign: "center",
                        marginTop: spacing[1],
                      }}
                    >
                      Exporte o OFX do seu banco. O Economize! categoriza
                      sozinho e fecha o mês para você.
                    </Text>
                    <TouchableOpacity
                      onPress={goToImport}
                      accessibilityLabel="Importar extrato"
                      accessibilityRole="button"
                      activeOpacity={0.85}
                      style={{
                        marginTop: spacing[4],
                        height: 48,
                        alignSelf: "stretch",
                        borderRadius: radius.full,
                        backgroundColor: t.accent.neon,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: t.text.inverse,
                          fontSize: 14,
                          fontWeight: "700",
                        }}
                      >
                        Importar extrato
                      </Text>
                    </TouchableOpacity>
                  </View>
                )
              ) : (
                <>
                  <View className="flex-row justify-between items-center">
                    <Text
                      style={{
                        color: t.text.tertiary,
                        fontSize: 11,
                        fontWeight: "700",
                        letterSpacing: 1,
                        textTransform: "uppercase",
                      }}
                    >
                      {/* A primeira linha da Home passou a ser QUANTO EXISTE
                          em conta, e não quanto sobrou no mês. Pedido do dono
                          em 15/09/2026, depois de ler "Sobrou R$ 3.021,06"
                          numa conta onde não havia nada: ele leu um saldo, e
                          "sobrou" é fluxo. Quando nenhuma conta informou
                          saldo, a manchete continua sendo o mês — dizer "em
                          conta" sem saber quanto seria a mesma mentira com
                          outro rótulo.

                          "Sobrou" em cima de número negativo é frase errada:
                          o mês em que faltou dinheiro é o mês em que a leitura
                          precisa estar mais correta, não menos */}
                      {saldoConhecido
                        ? "Em conta hoje"
                        : monthly.net < 0
                          ? isWindowMode
                            ? `Faltou no ciclo ${periodLabel}`
                            : `Faltou em ${periodLabel}`
                          : isWindowMode
                            ? `Sobrou no ciclo ${periodLabel}`
                            : `Sobrou em ${periodLabel}`}
                    </Text>
                    <TouchableOpacity
                      onPress={toggleBalance}
                      accessibilityLabel={
                        showBalance ? "Ocultar valores" : "Mostrar valores"
                      }
                      accessibilityRole="button"
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      {showBalance ? (
                        <Eye size={18} color={t.text.secondary} />
                      ) : (
                        <EyeOff size={18} color={t.text.secondary} />
                      )}
                    </TouchableOpacity>
                  </View>

                  {/* Abreviar em vez de espremer: a partir de 100 mil o número
                      vira "R$ 123,4 mil" e mantém os 36 px da escala. O
                      `adjustsFontSizeToFit` fica como rede — e na web ele é
                      ignorado pelo react-native-web, então lá a abreviação é a
                      única defesa contra o corte */}
                  {/* EC-146: o pote ao lado do número que ele representa. Solto
                      em outro canto da tela ele seria enfeite; aqui a relação
                      entre o desenho e o resultado se explica sozinha */}
                  <View
                    className="flex-row items-center"
                    style={{ gap: spacing[3] }}
                  >
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      // O que a tela abrevia, o leitor de tela fala por extenso:
                      // "R$ 123,4 mil" é resumo de leitura, não o número
                      accessibilityLabel={
                        showBalance
                          ? `${
                              monthly.net < 0
                                ? isWindowMode
                                  ? `Faltou no ciclo ${periodLabel}`
                                  : `Faltou em ${periodLabel}`
                                : isWindowMode
                                  ? `Sobrou no ciclo ${periodLabel}`
                                  : `Sobrou em ${periodLabel}`
                            }: ${formatBRL(monthly.net)}`
                          : HIDDEN_SPOKEN
                      }
                      style={{
                        ...typography.numericDisplay,
                        color:
                          (saldoConhecido ? cash.amount! : monthly.net) >= 0
                            ? t.text.primary
                            : t.chart.down,
                        marginTop: spacing[1],
                        flexShrink: 1,
                      }}
                    >
                      {showBalance
                        ? formatBRLCompact(
                            saldoConhecido ? cash.amount! : monthly.net,
                          )
                        : HIDDEN}
                    </Text>
                    <TouchableOpacity
                      onPress={() => setPotSheetOpen(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Seu pote: ${potState.label}. Entender os estados`}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <PotIcon
                        size={44}
                        level={potState.level}
                        tone={potState.tone}
                      />
                    </TouchableOpacity>
                  </View>

                  {/* A LINHA DE APOIO. Com saldo conhecido ela carrega o que
                      era manchete ("sobrou no mês") mais a procedência do
                      número; sem saldo, ela é o convite para o app passar a
                      saber — o OFX do banco traz o saldo dentro dele */}
                  {saldoConhecido ? (
                    <Text
                      style={{
                        color: t.text.tertiary,
                        fontSize: 12,
                        marginTop: spacing[1],
                      }}
                      numberOfLines={2}
                    >
                      {monthly.net < 0 ? "Faltou" : "Sobrou"}{" "}
                      {formatBRLCompact(Math.abs(monthly.net))} em {periodLabel}
                      {cash.caveat ? ` · ${cash.caveat}` : ""}
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={goToImport}
                      accessibilityRole="button"
                      accessibilityLabel="Importar extrato para o app saber seu saldo"
                      activeOpacity={0.7}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: spacing[2],
                      }}
                    >
                      <Text
                        style={{
                          flexShrink: 1,
                          color: t.text.tertiary,
                          fontSize: 12,
                        }}
                        numberOfLines={2}
                      >
                        Isto é o do mês, não o seu saldo — ainda não sei quanto
                        você tem em conta.
                      </Text>
                      <Text
                        style={{
                          color: t.accent.neon,
                          fontSize: 12,
                          fontWeight: "700",
                          marginLeft: spacing[2],
                        }}
                      >
                        Importar
                      </Text>
                      <ChevronRight size={14} color={t.accent.neon} />
                    </TouchableOpacity>
                  )}

                  {/* GASTOS EM DESTAQUE, ENTRADAS MENORES — e o gasto é
                      atalho. A ordem é pedido do dono: "destacar gastos e
                      deixar ele ser um atalho para mais detalhes, mostrar
                      entradas com menos destaque ou menor". Faz sentido: o
                      número sobre o qual dá para AGIR é o que sai */}
                  <TouchableOpacity
                    onPress={goToAnalytics}
                    accessibilityRole="button"
                    accessibilityLabel={`Gastos do período: ${formatBRL(
                      monthly.totalExpense,
                    )}. Ver no que foi o dinheiro`}
                    activeOpacity={0.7}
                    style={{ marginTop: spacing[4] }}
                  >
                    <View
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                        Gastos em {periodLabel}
                      </Text>
                      <ChevronRight size={14} color={t.text.tertiary} />
                    </View>
                    <Text
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      style={{
                        ...typography.numericMd,
                        color: t.chart.down,
                        marginTop: 2,
                      }}
                    >
                      {showBalance
                        ? formatBRLCompact(monthly.totalExpense)
                        : HIDDEN}
                    </Text>
                  </TouchableOpacity>

                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "baseline",
                      gap: spacing[2],
                      marginTop: spacing[2],
                    }}
                  >
                    <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                      Entradas
                    </Text>
                    <Text
                      style={{
                        color: t.chart.up,
                        fontSize: 14,
                        fontWeight: "700",
                        fontVariant: ["tabular-nums"],
                      }}
                    >
                      {showBalance
                        ? formatBRLCompact(monthly.totalIncome)
                        : HIDDEN}
                    </Text>
                  </View>

                  <TouchableOpacity
                    onPress={goToAnalytics}
                    accessibilityLabel="Abrir a análise do mês"
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      borderTopWidth: 1,
                      borderTopColor: t.border.subtle,
                      marginTop: spacing[4],
                      paddingTop: spacing[3],
                    }}
                  >
                    {/* EC-142: a fileira existe para levar à Análise. Na
                        visão simples ela continua levando, mas com convite no
                        lugar do percentual contra o período anterior */}
                    {!avancado ? (
                      <Text
                        numberOfLines={1}
                        style={{
                          flexShrink: 1,
                          color: t.text.tertiary,
                          fontSize: 12,
                        }}
                      >
                        Ver no que foi o dinheiro
                      </Text>
                    ) : expenseDeltaPct !== null ? (
                      <>
                        {expenseDeltaPct <= 0 ? (
                          <ArrowDownRight size={14} color={t.chart.up} />
                        ) : (
                          <ArrowUpRight size={14} color={t.chart.down} />
                        )}
                        <Text
                          style={{
                            color:
                              expenseDeltaPct <= 0 ? t.chart.up : t.chart.down,
                            fontSize: 12,
                            fontWeight: "700",
                            fontVariant: ["tabular-nums"],
                            marginLeft: 2,
                          }}
                        >
                          {expenseDeltaPct > 0 ? "+" : ""}
                          {expenseDeltaPct.toFixed(0)}%
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            flexShrink: 1,
                            color: t.text.tertiary,
                            fontSize: 12,
                            marginLeft: 4,
                          }}
                        >
                          em saídas vs {previousLabel}
                        </Text>
                      </>
                    ) : (
                      <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                        {isWindowMode
                          ? "Sem dados na janela anterior"
                          : "Sem dados do mês anterior"}
                      </Text>
                    )}
                    <View style={{ flex: 1 }} />
                    <Text
                      style={{
                        color: t.accent.neon,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Análise
                    </Text>
                    <ChevronRight size={14} color={t.accent.neon} />
                  </TouchableOpacity>

                  {/* CRÉDITO, SEPARADO DO DINHEIRO. Pedido do dono no mesmo
                      dia: "atualmente eu só tenho saldo disponível em crédito
                      nos cartões, mas sempre devemos deixar bem claro isso".
                      Fica embaixo de uma linha divisória e com rótulo próprio
                      justamente para não ser lido como dinheiro — limite é
                      permissão para gastar o que ainda não é seu.

                      Sem limite informado o bloco não some: ele PERGUNTA. O
                      limite não vem em arquivo nenhum (a fatura declara o
                      devido, não o limite), então a única fonte é o dono do
                      cartão */}
                  {credito.cards > 0 && (
                    <TouchableOpacity
                      onPress={goToCards}
                      accessibilityRole="button"
                      accessibilityLabel={
                        credito.available != null
                          ? `Crédito disponível: ${formatBRL(credito.available)} de ${formatBRL(
                              credito.limit ?? 0,
                            )}. Ver cartões`
                          : "Informar o limite dos seus cartões"
                      }
                      activeOpacity={0.7}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        borderTopWidth: 1,
                        borderTopColor: t.border.subtle,
                        marginTop: spacing[3],
                        paddingTop: spacing[3],
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
                          {credito.available != null
                            ? "Crédito disponível nos cartões"
                            : credito.limit != null
                              ? "Limite total dos cartões"
                              : `${credito.cards} ${
                                  credito.cards === 1 ? "cartão" : "cartões"
                                } sem limite informado`}
                        </Text>
                        <Text
                          numberOfLines={1}
                          style={{
                            color: t.text.primary,
                            fontSize: 15,
                            fontWeight: "700",
                            fontVariant: ["tabular-nums"],
                            marginTop: 2,
                          }}
                        >
                          {credito.available != null
                            ? showBalance
                              ? `${formatBRLCompact(credito.available)} de ${formatBRLCompact(
                                  credito.limit ?? 0,
                                )}`
                              : HIDDEN
                            : credito.limit != null
                              ? showBalance
                                ? formatBRLCompact(credito.limit)
                                : HIDDEN
                              : "Diga quanto é para eu somar"}
                        </Text>
                        {/* Limite conhecido e dívida desconhecida é um estado
                            de verdade: a fatura só entra quando o extrato do
                            cartão é importado ou a conta é conectada. Dizer
                            "disponível" aqui seria afirmar que nada foi gasto */}
                        {credito.limit != null && credito.available == null && (
                          <Text
                            style={{
                              color: t.text.tertiary,
                              fontSize: 11,
                              marginTop: 2,
                            }}
                          >
                            Ainda não sei quanto está usado
                          </Text>
                        )}
                      </View>
                      <ChevronRight size={16} color={t.accent.neon} />
                    </TouchableOpacity>
                  )}

                  {/* O comparável do modo janela não é o mês passado: é uma janela
                      de mesmo tamanho terminando na véspera. Sem esta linha, o
                      percentual acima mudaria de significado em silêncio */}
                  {isWindowMode && avancado && previousWindowLabel && (
                    <Text
                      style={{
                        color: t.text.tertiary,
                        fontSize: 11,
                        lineHeight: 16,
                        marginTop: spacing[2],
                      }}
                    >
                      Comparado com a janela anterior de mesmo tamanho:{" "}
                      {previousWindowLabel}.
                    </Text>
                  )}
                </>
              )}
            </Animated.View>,

            /* EC-137: acima da revisão porque é mais urgente — a revisão
               espera, a memória da compra do vale não */
            vrAsk !== null && (
              <Animated.View key="vale" entering={listItemEntering(1)}>
                <MealVoucherPrompt
                  ask={vrAsk}
                  onImport={goToImport}
                  onDismiss={() => dismissMealVoucherPrompt(vrAsk.landedOn)}
                />
              </Animated.View>
            ),

            /* Revisão pendente: o único bloco que pede ação do usuário */
            pendingReviewCount > 0 && (
              <Animated.View
                key="revisao"
                entering={listItemEntering(1)}
                className="px-5 mb-5"
              >
                <TouchableOpacity
                  onPress={() => navigation.navigate("Revisão" as never)}
                  accessibilityLabel={`${pendingReviewCount} ${
                    pendingReviewCount === 1
                      ? "transação aguardando revisão"
                      : "transações aguardando revisão"
                  }`}
                  accessibilityRole="button"
                  activeOpacity={0.8}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    minHeight: 52,
                    borderRadius: radius.xl,
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                    backgroundColor: t.semantic.warningMuted,
                  }}
                >
                  <ListChecks size={18} color={t.semantic.warning} />
                  <Text
                    style={{
                      flex: 1,
                      marginLeft: spacing[3],
                      color: t.semantic.warning,
                      fontSize: 13,
                      fontWeight: "700",
                    }}
                  >
                    {pendingReviewCount === 1
                      ? "1 transação esperando você"
                      : `${pendingReviewCount} transações esperando você`}
                  </Text>
                  <ChevronRight size={18} color={t.semantic.warning} />
                </TouchableOpacity>
              </Animated.View>
            ),

            /* O QUE VENCE ANTES DE O MÊS FECHAR, com nome e data.
               Antes este bloco mostrava só o total e o nome da próxima —
               dava para saber que vinha algo, não o quê nem quando. O pedido
               do dono foi "saber as coisas que eu tenho que pagar no futuro,
               e se tiver alguma muito em breve dar mais destaque nela": total
               sem lista não destaca nada. O destaque é por DATA, porque o que
               aperta é o vencimento, não o tamanho. */
            upcoming.count > 0 && (
              <Animated.View
                key="compromisso"
                entering={listItemEntering(2)}
                className="px-5 mb-5"
              >
                <UpcomingBillsCard
                  overview={upcoming}
                  showValues={showBalance}
                  riskLabel={riskMonth ? forecastPeriodLabel(riskMonth).short : null}
                  salaryLine={
                    committed?.salaryKnown && committed.salaryDate
                      ? describeSalaryTiming(
                          committed.daysUntilSalary,
                          committed.salaryDate,
                        )
                      : null
                  }
                  onPressItem={abrirCompromisso}
                  onPressAll={goToRecurrences}
                />
              </Animated.View>
            ),

            /* PARCELAMENTOS — pedido direto: "quero ver meus parcelamentos na
               tela inicial também". Eles já existiam na API, mas na Home eram
               um número sem toque escondido dentro do bloco do calendário — e
               sumiam junto com ele quando o mês não tinha movimento. */
            parcelas.count > 0 && (
              <Animated.View
                key="parcelamentos"
                entering={listItemEntering(3)}
                className="px-5 mb-5"
              >
                <InstallmentsCard
                  summary={parcelas}
                  showValues={showBalance}
                  onPressAll={goToImport}
                />
              </Animated.View>
            ),

            /* O mês em grade (EC-235). Pedido do dono depois do tour do
               concorrente: gasto tem ritmo semanal, e nenhuma lista
               cronológica mostra ritmo — numa grade, a sexta-feira cara
               aparece sozinha. O botão ao lado é a porta para o extrato
               inteiro, que era o outro pedido */
            hasStatement && diasDoMes.length > 0 && (
              <Animated.View
                key="calendario"
                entering={listItemEntering(3)}
                className="mx-5 mb-5 bg-surface border border-border rounded-3xl p-5"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text
                    style={{
                      flex: 1,
                      marginRight: spacing[2],
                      color: t.text.primary,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Seu mês, dia a dia
                  </Text>
                  <TouchableOpacity
                    onPress={goToImport}
                    accessibilityLabel="Ver o extrato inteiro"
                    accessibilityRole="button"
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                    style={{ flexDirection: "row", alignItems: "center" }}
                  >
                    <Text
                      style={{
                        color: t.accent.neon,
                        fontSize: 13,
                        fontWeight: "700",
                      }}
                    >
                      Detalhes
                    </Text>
                    <ChevronRight size={16} color={t.accent.neon} />
                  </TouchableOpacity>
                </View>
                {/* A semana ANTES da grade: é a pergunta mais imediata
                    ("como estou agora?"), e ela sai dos mesmos dias */}
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "baseline",
                    marginBottom: spacing[3],
                  }}
                >
                  <Text
                    style={{
                      color: t.text.secondary,
                      fontSize: 12,
                      marginRight: spacing[2],
                    }}
                  >
                    Esta semana
                  </Text>
                  <Text
                    style={{
                      color: t.text.primary,
                      fontSize: 18,
                      fontWeight: "700",
                    }}
                    accessibilityLabel={`Esta semana: ${formatBRL(semana.spent)} de saída`}
                  >
                    {formatBRLCompact(semana.spent)}
                  </Text>
                </View>
                {ritmoDaSemana ? (
                  <Text
                    style={{
                      color: t.text.tertiary,
                      fontSize: 11,
                      marginTop: -spacing[2],
                      marginBottom: spacing[3],
                    }}
                  >
                    {ritmoDaSemana}
                  </Text>
                ) : null}

                <SpendingCalendar month={mesCorrente} days={diasDoMes} />

                {/* EC-222: os quatro números de primeira tela, lado a lado.
                    Em coluna eles ocupariam a tela inteira e forcariam
                    rolagem antes da primeira resposta; lado a lado, comparar
                    dois deles é um movimento de olho, não de dedo.

                    Cada tile tem UM rótulo e UM número (EC-221), e o número
                    chega contando — é o que faz o olho perceber a direção
                    antes de ler o valor */}
                <View style={{ marginTop: spacing[4] }}>
                  <MetricGrid>
                    <MetricTile
                      label="Esta semana"
                      value={showBalance ? semana.spent : 0}
                      hint={ritmoDaSemana}
                      onPress={goToImport}
                    />
                    <MetricTile
                      label={`A vencer em ${COMMITMENT_WINDOW_DAYS} dias`}
                      value={showBalance ? commitment.total : 0}
                      hint={
                        commitment.nextName
                          ? `próxima: ${commitment.nextName}`
                          : null
                      }
                      onPress={goToRecurrences}
                    />
                    {committed?.free != null ? (
                      <MetricTile
                        label="Sobra depois do salário"
                        value={showBalance ? committed.free : 0}
                        tone={committed.free < 0 ? "negative" : "positive"}
                        onPress={goToRecurrences}
                      />
                    ) : null}
                    {parcelamentos && parcelamentos.openSeries > 0 ? (
                      <MetricTile
                        label="Parcelas a vencer"
                        value={showBalance ? parcelamentos.remainingTotal : 0}
                        hint={
                          parcelamentos.openSeries === 1
                            ? "1 parcelamento"
                            : `${parcelamentos.openSeries} parcelamentos`
                        }
                      />
                    ) : null}
                  </MetricGrid>
                </View>

                {/* EC-213: o que ainda vai cobrar, como número de primeira
                    tela. O Pierre mostrava "1 de 3, última em Agosto/2026" em
                    setembro — aqui a projeção é por mês e tem teste */}
                {parcelamentos && parcelamentos.openSeries > 0 ? (
                  <View
                    style={{
                      marginTop: spacing[4],
                      paddingTop: spacing[3],
                      borderTopWidth: 1,
                      borderTopColor: t.border.subtle,
                    }}
                  >
                    <Text
                      style={{ color: t.text.secondary, fontSize: 12 }}
                      accessibilityLabel={`${parcelamentos.openSeries} ${
                        parcelamentos.openSeries === 1
                          ? "parcelamento em andamento"
                          : "parcelamentos em andamento"
                      }, ${formatBRL(parcelamentos.remainingTotal)} a vencer`}
                    >
                      {parcelamentos.openSeries === 1
                        ? "1 parcelamento em andamento"
                        : `${parcelamentos.openSeries} parcelamentos em andamento`}
                      {" · "}
                      <Text
                        style={{ color: t.text.primary, fontWeight: "700" }}
                      >
                        {formatBRLCompact(parcelamentos.remainingTotal)}
                      </Text>
                      {" a vencer"}
                    </Text>
                  </View>
                ) : null}
              </Animated.View>
            ),

            /* Para onde foi: as 3 maiores saídas da janela. O bloco depende de
               haver período carregado, e não de haver saída — é aqui que mora a
               engrenagem do ciclo, e ela não pode sumir junto com a lista.
               (`hasStatement` só exclui quem ainda não importou nada: para esse,
               a resposta é o onboarding acima, não o recorte) */
            hasPeriod && hasStatement && (
              <Animated.View
                key="destino"
                entering={listItemEntering(3)}
                className="px-5 mb-5"
              >
                <View className="flex-row items-center justify-between mb-3">
                  <Text
                    style={{
                      flex: 1,
                      marginRight: spacing[2],
                      color: t.text.primary,
                      fontSize: 16,
                      fontWeight: "700",
                    }}
                  >
                    Para onde foi
                  </Text>
                  <CycleWindowChip
                    start={monthly?.start}
                    end={monthly?.end}
                    onPress={() => setAnchorSheetOpen(true)}
                  />
                </View>
                <View
                  style={{
                    backgroundColor: t.background.surface,
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                    borderRadius: radius["2xl"],
                    paddingHorizontal: spacing[4],
                    paddingVertical: spacing[3],
                  }}
                >
                  {topExpenses.length === 0 && (
                    <Text
                      style={{
                        color: t.text.secondary,
                        fontSize: 13,
                        paddingVertical: spacing[2],
                      }}
                    >
                      Nenhuma saída categorizada nesta janela.
                    </Text>
                  )}
                  {topExpenses.map((slice, index) => {
                    const color = resolveCategoryColor(slice, t as AppTheme);
                    const share =
                      monthly && monthly.totalExpense > 0
                        ? (slice.expenseTotal / monthly.totalExpense) * 100
                        : 0;
                    return (
                      <View
                        key={slice.categoryId ?? "sem-categoria"}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          marginTop: index === 0 ? 0 : spacing[3],
                        }}
                      >
                        <CategoryIcon
                          category={slice}
                          theme={t as AppTheme}
                          size={32}
                        />
                        <View style={{ flex: 1, marginLeft: spacing[3] }}>
                          <View className="flex-row items-center justify-between">
                            <Text
                              numberOfLines={1}
                              style={{
                                flex: 1,
                                marginRight: spacing[2],
                                color: t.text.primary,
                                fontSize: 13,
                                fontWeight: "600",
                              }}
                            >
                              {slice.name}
                            </Text>
                            <Text
                              accessibilityLabel={
                                showBalance
                                  ? `${slice.name}: ${formatBRL(
                                      slice.expenseTotal,
                                    )}`
                                  : `${slice.name}: ${HIDDEN_SPOKEN}`
                              }
                              style={{
                                color: t.text.primary,
                                fontSize: 13,
                                fontWeight: "700",
                                fontVariant: ["tabular-nums"],
                              }}
                            >
                              {/* Nome da categoria e valor dividem a linha; o
                                  valor abreviado é o que impede o nome de ser
                                  cortado em "Alimenta...". Quem ouve recebe o
                                  nome e o valor cheio no mesmo nó */}
                              {showBalance
                                ? formatBRLCompact(slice.expenseTotal)
                                : HIDDEN}
                            </Text>
                          </View>
                          <View
                            style={{
                              marginTop: spacing[1],
                              height: 6,
                              borderRadius: radius.full,
                              backgroundColor: t.border.subtle,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${Math.min(100, Math.max(share, 1.5))}%`,
                                height: 6,
                                borderRadius: radius.full,
                                backgroundColor: color,
                              }}
                            />
                          </View>
                        </View>
                      </View>
                    );
                  })}

                  {/* "Ver tudo" desceu para o rodapé do card: o topo virou a linha
                      do recorte, e um link de texto ao lado do chip disputaria o
                      mesmo canto com um alvo de toque menor que o mínimo */}
                  <TouchableOpacity
                    onPress={goToAnalytics}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Ver todas as categorias na análise"
                    accessibilityRole="button"
                    activeOpacity={0.7}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      minHeight: 40,
                      borderTopWidth: 1,
                      borderTopColor: t.border.subtle,
                      marginTop: spacing[3],
                      paddingTop: spacing[3],
                    }}
                  >
                    <Text
                      style={{
                        color: t.accent.neon,
                        fontWeight: "700",
                        fontSize: 13,
                      }}
                    >
                      Ver todas as categorias
                    </Text>
                    <ChevronRight size={14} color={t.accent.neon} />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            ),

            /* Atalhos: só o que não está a um toque na tab bar */
            <Animated.View
              key="atalhos"
              entering={listItemEntering(4)}
              className="flex-row px-5 mb-5"
              style={{ gap: spacing[3] }}
            >
              <QuickAction
                Icon={Upload}
                label="Importar"
                onPress={goToImport}
              />
              <QuickAction
                Icon={ChartColumn}
                label="Análise"
                onPress={goToAnalytics}
              />
              <QuickAction
                Icon={ChartPie}
                label="Relatórios"
                onPress={() => navigation.navigate("Relatórios" as never)}
              />
            </Animated.View>,

            /* Patrimônio e mercado: contexto, não o centro da tela */
            <Animated.View
              key="carteira"
              entering={listItemEntering(5)}
              className="px-5 mb-5"
            >
              <TouchableOpacity
                onPress={() =>
                  (navigation as any).navigate("Finanças", {
                    screen: "Carteira",
                  })
                }
                // O valor entra AQUI: o rótulo do touchable substitui o dos
                // filhos, então um label só de ação fazia o patrimônio nunca
                // ser anunciado — e agora ele ainda é abreviado na tela
                accessibilityLabel={
                  showBalance
                    ? `Investido: ${formatBRL(walletBalance)}${
                        walletPerformance !== null
                          ? `, rentabilidade de ${formatDecimal(
                              walletPerformance,
                              1,
                            )} por cento`
                          : ""
                      }. Abrir a carteira`
                    : `Investido: ${HIDDEN_SPOKEN}. Abrir a carteira`
                }
                accessibilityRole="button"
                activeOpacity={0.8}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: t.background.surface,
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                  borderRadius: radius["2xl"],
                  padding: spacing[4],
                }}
              >
                <View
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: radius.full,
                    backgroundColor: t.accent.neonMuted,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <TrendingUp size={18} color={t.accent.neon} />
                </View>
                <View style={{ flex: 1, marginLeft: spacing[3] }}>
                  <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
                    Investido
                  </Text>
                  <Text
                    style={{
                      color: t.text.primary,
                      fontSize: 16,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {showBalance ? formatBRLCompact(walletBalance) : HIDDEN}
                  </Text>
                </View>
                {walletPerformance !== null && (
                  <Text
                    style={{
                      color: walletPerformance >= 0 ? t.chart.up : t.chart.down,
                      fontSize: 13,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                      marginRight: spacing[1],
                    }}
                  >
                    {formatPercent(walletPerformance, {
                      decimals: 1,
                      signed: true,
                    })}
                  </Text>
                )}
                <ChevronRight size={18} color={t.text.tertiary} />
              </TouchableOpacity>
            </Animated.View>,

            <Animated.View
              key="mercado"
              entering={listItemEntering(5)}
              className="mb-5"
            >
              <Text className="px-5 text-base font-bold text-textPrimary mb-3">
                {fromFavorites ? "Favoritados" : "Mercado agora"}
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerClassName="px-4"
              >
                {isContentLoading && highlights.length === 0
                  ? [1, 2, 3].map((i) => (
                      <View
                        key={i}
                        className="bg-surface rounded-2xl p-5 mx-2 border border-border min-w-[150px]"
                      >
                        <Skeleton
                          width={36}
                          height={36}
                          borderRadius={18}
                          className="mb-3"
                        />
                        <Skeleton width={80} height={20} className="mb-2" />
                        <Skeleton width={50} height={16} />
                      </View>
                    ))
                  : highlights.map((item, index) => (
                      <HighlightCard
                        key={`${item.id}-${index}`}
                        title={item.code || item.name}
                        value={item.buy || item.points || 0}
                        variation={item.variation}
                        type={item.type}
                        Icon={
                          item.type === "crypto"
                            ? Bitcoin
                            : item.type === "index"
                              ? TrendingUp
                              : Banknote
                        }
                        onPress={() => setSelectedIndicator(item)}
                      />
                    ))}
              </ScrollView>
            </Animated.View>,

            <Animated.View
              key="noticias"
              entering={listItemEntering(6)}
              className="px-5 mb-5"
            >
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-base font-bold text-textPrimary">
                  Radar de notícias
                </Text>
                <TouchableOpacity
                  onPress={() => navigation.navigate("Notícias" as never)}
                  accessibilityLabel="Ver mais notícias"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-primary font-bold text-sm">
                    Ver mais
                  </Text>
                </TouchableOpacity>
              </View>

              {recentNews.map((article, index) => (
                <TouchableOpacity
                  key={index}
                  className="bg-surface rounded-2xl p-4 mb-2 flex-row items-center border border-border"
                  onPress={() => Linking.openURL(article.url)}
                  accessibilityLabel={`Abrir notícia: ${article.title}`}
                  accessibilityRole="button"
                  activeOpacity={0.7}
                >
                  <View className="flex-1 pr-4">
                    <Text className="text-primary text-[10px] font-bold uppercase mb-1 tracking-wider">
                      {article.source.name}
                    </Text>
                    <Text
                      className="text-textPrimary text-sm font-bold leading-5"
                      numberOfLines={2}
                    >
                      {article.title}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={t.text.secondary} />
                </TouchableOpacity>
              ))}
            </Animated.View>,
          ]}
        </BlockGrid>

        {/* Depois de tudo, e nunca entre o usuário e os números dele: o slot
            é a última coisa do rolamento. Some por completo no Plus */}
        <AdSlot style={{ marginTop: spacing[4] }} />
      </ScrollView>

      {/* A oferta do Plus decide sozinha se sobe (regras em utils/premiumOffer:
          nunca nas duas primeiras sessões, uma por sessão, 7 dias entre
          convites, 30 depois de um "tenho interesse") */}
      <PremiumOfferSheet
        visible={plusNaVez}
        onClose={plusOffer.close}
      />

      {/* Detalhes do indicador: sheet canônico compartilhado com as listas */}
      <IndicatorDetailSheet
        indicator={selectedIndicator}
        visible={!!selectedIndicator}
        onClose={() => setSelectedIndicator(null)}
      />

      <CycleAnchorSheet
        visible={anchorSheetOpen}
        onClose={() => setAnchorSheetOpen(false)}
      />

      <PotStatesSheet
        visible={poteNaVez}
        onClose={fecharAnuncioDoPote}
        performance={performance}
      />

      <AssistantFAB origin="home" />
    </PageContainer>
  );
}

function QuickAction({
  Icon,
  label,
  onPress,
}: {
  Icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const { pressStyle, onPressIn, onPressOut } = usePressScale();

  return (
    <Animated.View style={[pressStyle, { flex: 1 }]}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={label}
        accessibilityRole="button"
        activeOpacity={0.7}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 46,
          borderRadius: radius.full,
          backgroundColor: t.background.surface,
          borderWidth: 1,
          borderColor: t.border.subtle,
        }}
      >
        <Icon size={16} color={t.accent.neon} />
        <Text
          numberOfLines={1}
          style={{
            color: t.text.primary,
            fontSize: 12,
            fontWeight: "700",
            marginLeft: spacing[2],
          }}
        >
          {label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}
