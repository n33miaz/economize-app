import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  LayoutAnimation,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ChevronDown from "lucide-react-native/dist/esm/icons/chevron-down";
import CircleCheck from "lucide-react-native/dist/esm/icons/circle-check";
import Info from "lucide-react-native/dist/esm/icons/info";
import TriangleAlert from "lucide-react-native/dist/esm/icons/triangle-alert";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useReducedMotion } from "react-native-reanimated";
import * as Haptics from "../utils/haptics";

import type {
  ForecastItem,
  ForecastMonth,
  InstallmentOverview,
} from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets } from "../theme/motionPresets";
import { APP_ROUTES } from "../routes/routeNames";
import { useAccountsStore } from "../store/accountsStore";
import { useBankStore } from "../store/bankStore";
import {
  FORECAST_WINDOWS,
  type ForecastWindow,
  useRecurrenceStore,
} from "../store/recurrenceStore";
import { useWishStore } from "../store/wishStore";
import ChartLegend from "../components/ChartLegend";
import ErrorState from "../components/ErrorState";
import FirstTimeCard from "../components/FirstTimeCard";
import PotEmptyState from "../components/PotEmptyState";
import PurchaseDayCard from "../components/PurchaseDayCard";
import AssistantFAB from "../components/AssistantFAB";
import { getInstallments, getMonthlyAnalytics } from "../services/api";
import BalanceRuler, { BalanceRulerHeadline } from "../components/BalanceRuler";
import CommitmentTimeline from "../components/CommitmentTimeline";
import { buildCommitmentTimeline } from "../utils/commitmentTimeline";
import {
  contratados as contratadosDaRegua,
  montarRegua,
  somasContratadas,
  tresCenarios,
} from "../utils/balanceRuler";
import PageContainer from "../components/PageContainer";
import AdSlot from "../components/AdSlot";
import ScreenHeader from "../components/ScreenHeader";
import SegmentedControl from "../components/SegmentedControl";
import Skeleton from "../components/Skeleton";
import { cashPositionFrom } from "../utils/cashPosition";
import { monthKeyOf, shiftMonthKey, todayIso } from "../utils/cycleWindow";
import { declaredCaveat, forecastOrigin } from "../utils/forecastOrigin";
import { formatBRL, formatBRLCompact } from "../utils/money";
import {
  forecastItemWhen,
  forecastPeriodKey,
  forecastPeriodLabel,
  isMonthAtRisk,
  splitForecastMonth,
} from "../utils/recurrence";

const WINDOW_OPTIONS = FORECAST_WINDOWS.map((months) => ({
  label: months === 1 ? "1 mês" : `${months} meses`,
  value: String(months) as `${ForecastWindow}`,
}));

// Altura das colunas do comparativo da janela — alto o bastante para a
// diferença ser visível, baixo o bastante para caber acima da dobra
const BAR_MAX_HEIGHT = 96;

/** Uma linha da composição do período: quando cai, o quê e quanto. */
function ForecastRow({
  item,
  settled,
  periodNoun,
}: {
  item: ForecastItem;
  settled: boolean;
  /** "mês" ou "ciclo" — a palavra que o cabeçalho do card já usou */
  periodNoun: string;
}) {
  const t = useTheme();
  const isIncome = item.flow === "INCOME";
  const color = settled
    ? t.text.tertiary
    : isIncome
      ? t.chart.up
      : t.chart.down;
  // O selo escreve dia/mês a partir da data completa: em ciclo ancorado "dia
  // 20" (agosto) e "dia 5" (setembro) não localizam nada. Cadência semanal não
  // tem dia nem data, e o valor da linha já é a projeção do período (4,33
  // ocorrências): o selo assume a conta — "semanal" ao lado de um valor 4,3×
  // maior que a cobrança confundiria.
  const when = forecastItemWhen(item);
  const origem = forecastOrigin(item);

  return (
    <View
      accessible
      accessibilityLabel={`${item.displayName}, ${when.spoken}, ${
        isIncome ? "entrada" : "saída"
      } de ${formatBRL(item.amount)}, ${origem.spoken}${
        settled ? `, já liquidada neste ${periodNoun}` : ""
      }`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        minHeight: 36,
      }}
    >
      <View
        style={{
          minWidth: 62,
          paddingHorizontal: spacing[2],
          paddingVertical: 2,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          alignItems: "center",
        }}
      >
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
          }}
          numberOfLines={1}
        >
          {when.label}
        </Text>
      </View>
      <View style={{ flex: 1, marginHorizontal: spacing[3] }}>
        <Text
          numberOfLines={1}
          style={{
            color: settled ? t.text.secondary : t.text.primary,
            fontSize: 13,
            fontWeight: "600",
          }}
        >
          {item.displayName}
        </Text>
        {/* EC-206: medido e informado não podem ter a mesma cara. O primeiro
            tem histórico no extrato; o segundo é intenção de quem digitou — e
            sem a marca, a previsão parece mais firme do que é */}
        <Text
          numberOfLines={1}
          style={{
            color:
              origem.kind === "declared" ? t.semantic.warning : t.text.tertiary,
            fontSize: 10,
            marginTop: 1,
          }}
        >
          {origem.badge}
        </Text>
      </View>
      <Text
        style={{
          color,
          fontSize: 13,
          fontWeight: "700",
          fontVariant: ["tabular-nums"],
        }}
      >
        {isIncome ? "+" : "−"}
        {formatBRLCompact(item.amount)}
      </Text>
    </View>
  );
}

/**
 * Um período da projeção. O período que fecha negativo veste o token de perigo
 * (borda, fundo e valor): é a única informação da tela que exige reação, e o
 * accent — cor da marca — nunca significa alta nem baixa.
 */
function ForecastMonthCard({
  month,
  index,
  expanded,
  onToggle,
  saldoConhecido,
}: {
  month: ForecastMonth;
  index: number;
  expanded: boolean;
  onToggle: () => void;
  /**
   * Existe saldo informado para a projeção partir de algum lugar? Sem ele o
   * card mostra MOVIMENTO em vez de saldo — e diz qual dos dois está
   * mostrando. Ver o bloco grande em `cash` mais abaixo.
   */
  saldoConhecido: boolean;
}) {
  const t = useTheme();
  const { listItemEntering } = useMotionPresets();
  const atRisk = isMonthAtRisk(month);
  const split = useMemo(() => splitForecastMonth(month), [month]);
  // O nome do período sai do recorte (`start`/`end`), não do `month`: em ciclo
  // ancorado o "2026-08" é o ciclo 12/08→11/09, e escrevê-lo "ago 2026" era a
  // ambiguidade que o EC-116 veio matar. Mês do calendário segue "set 2026"
  const period = forecastPeriodLabel(month);
  const label = period.short;
  // A palavra que o resto do card usa acompanha o recorte — "fim do mês" sob
  // um cabeçalho "12/08 → 11/09" seria a segunda régua de novo
  const periodNoun = period.isCalendarMonth ? "mês" : "ciclo";

  const total = month.expectedIncome + month.expectedExpense;
  const incomeShare = total > 0 ? (month.expectedIncome / total) * 100 : 0;
  // O que o período mexe por si só, sem depender de um ponto de partida
  const movimento = month.expectedIncome - month.expectedExpense;

  const itemCount = month.items.length;

  return (
    <Animated.View
      entering={listItemEntering(index)}
      style={{
        backgroundColor: atRisk ? t.semantic.dangerMuted : t.background.surface,
        borderRadius: radius["2xl"],
        borderWidth: atRisk ? 2 : 1,
        borderColor: atRisk ? t.semantic.danger : t.border.subtle,
        padding: spacing[5],
        marginBottom: spacing[3],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          style={{
            flex: 1,
            color: t.text.tertiary,
            fontSize: 11,
            fontWeight: "700",
            letterSpacing: 1,
            textTransform: "uppercase",
          }}
        >
          {label}
        </Text>
        {atRisk && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: radius.full,
              backgroundColor: t.semantic.danger,
            }}
          >
            <TriangleAlert size={12} color={t.text.inverse} />
            <Text
              style={{
                color: t.text.inverse,
                fontSize: 11,
                fontWeight: "700",
                marginLeft: 4,
              }}
            >
              No vermelho
            </Text>
          </View>
        )}
      </View>

      {/* Com saldo conhecido o card responde "quanto sobra no fim"; sem
          saldo, responde "quanto este período mexe" — e diz qual das duas
          coisas está respondendo. Mostrar um acumulado partindo de zero seria
          a mesma mentira de antes com outro nome */}
      <Text
        style={{ color: t.text.secondary, fontSize: 12, marginTop: spacing[2] }}
      >
        {saldoConhecido
          ? `Saldo previsto no fim do ${periodNoun}`
          : `Movimento previsto do ${periodNoun}`}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={
          saldoConhecido
            ? `Saldo previsto ao fechar ${period.spoken}: ${formatBRL(month.cumulativeNet)}`
            : `Movimento previsto em ${period.spoken}: ${formatBRL(movimento)}`
        }
        style={{
          ...typography.numericLg,
          color: atRisk ? t.semantic.danger : t.text.primary,
          marginTop: 2,
        }}
      >
        {formatBRLCompact(saldoConhecido ? month.cumulativeNet : movimento)}
      </Text>

      {/* Proporção entrada × saída do mês: a barra dá a leitura de relance que
          dois números lado a lado não dão. Sem previsão no mês (tudo já
          liquidado), a trilha fica neutra — pintá-la 100% de saída afirmaria
          uma proporção que não existe */}
      <View
        style={{
          flexDirection: "row",
          height: 8,
          borderRadius: radius.full,
          overflow: "hidden",
          backgroundColor: t.border.subtle,
          marginTop: spacing[4],
        }}
      >
        {total > 0 && (
          <>
            <View
              style={{
                width: `${incomeShare}%`,
                backgroundColor: t.chart.up,
              }}
            />
            <View style={{ flex: 1, backgroundColor: t.chart.down }} />
          </>
        )}
      </View>

      <View
        style={{ flexDirection: "row", gap: spacing[4], marginTop: spacing[3] }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Entradas previstas
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Entradas previstas: ${formatBRL(month.expectedIncome)}`}
            style={{
              color: t.chart.up,
              fontSize: 15,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              marginTop: 2,
            }}
          >
            {formatBRLCompact(month.expectedIncome)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            Saídas previstas
          </Text>
          <Text
            numberOfLines={1}
            accessibilityLabel={`Saídas previstas: ${formatBRL(month.expectedExpense)}`}
            style={{
              color: t.chart.down,
              fontSize: 15,
              fontWeight: "700",
              fontVariant: ["tabular-nums"],
              marginTop: 2,
            }}
          >
            {formatBRLCompact(month.expectedExpense)}
          </Text>
        </View>
      </View>

      {itemCount > 0 && (
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${
            expanded ? "Ocultar" : "Ver"
          } os ${itemCount} lançamentos previstos para ${period.spoken}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            minHeight: 44,
            borderTopWidth: 1,
            borderTopColor: t.border.subtle,
            marginTop: spacing[3],
            paddingTop: spacing[3],
          }}
        >
          <Text
            style={{
              flex: 1,
              color: t.text.secondary,
              fontSize: 13,
              fontWeight: "700",
            }}
          >
            {expanded
              ? `Ocultar o que compõe o ${periodNoun}`
              : `Ver o que compõe o ${periodNoun} (${itemCount})`}
          </Text>
          <ChevronDown
            size={16}
            color={t.text.secondary}
            style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}
          />
        </TouchableOpacity>
      )}

      {expanded && (
        <View style={{ marginTop: spacing[2], gap: spacing[1] }}>
          {/* EC-206: quanto deste período é estimativa da pessoa. Só aparece
              quando pesa (10%+): ressalva que aparece sempre não é lida, que é
              a mesma lição do piso de materialidade */}
          {declaredCaveat(month.items) ? (
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                marginBottom: spacing[1],
              }}
            >
              {declaredCaveat(month.items)}
            </Text>
          ) : null}
          {split.pendingItems.map((item) => (
            <ForecastRow
              key={item.seriesId}
              item={item}
              settled={false}
              periodNoun={periodNoun}
            />
          ))}

          {split.settledItems.length > 0 && (
            <View style={{ marginTop: spacing[3] }}>
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: spacing[1],
                }}
              >
                <CircleCheck size={13} color={t.semantic.success} />
                <Text
                  style={{
                    color: t.semantic.success,
                    fontSize: 11,
                    fontWeight: "700",
                    marginLeft: 4,
                  }}
                >
                  Já aconteceu — fora da soma acima
                </Text>
              </View>
              {split.settledItems.map((item) => (
                <ForecastRow
                  key={item.seriesId}
                  item={item}
                  settled
                  periodNoun={periodNoun}
                />
              ))}
            </View>
          )}
        </View>
      )}
    </Animated.View>
  );
}

function ForecastSkeleton() {
  return (
    <View style={{ paddingHorizontal: spacing[5], paddingTop: spacing[4] }}>
      <Skeleton width="100%" height={48} borderRadius={radius.full} />
      <View style={{ height: spacing[4] }} />
      <Skeleton width="100%" height={150} borderRadius={radius["2xl"]} />
      <View style={{ height: spacing[4] }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginBottom: spacing[3] }}>
          <Skeleton width="100%" height={190} borderRadius={radius["2xl"]} />
        </View>
      ))}
    </View>
  );
}

/**
 * Perspectiva de saldo: para onde o saldo vai se as recorrências se
 * confirmarem. O ponto de partida vem do extrato importado — o servidor não
 * tem saldo consolidado e projetar a partir do zero seria inventar número.
 */
export default function BalanceForecast() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const { cardEntering } = useMotionPresets();

  const transactions = useBankStore((s) => s.transactions);
  const fetchTransactions = useBankStore((s) => s.fetchTransactions);
  // As contas são a fonte do saldo base. Carregam uma vez e ficam em memória
  // (o store cuida disso): o extrato devolve só `accountId`, e é aqui que o id
  // vira tipo, saldo informado e limite
  const accounts = useAccountsStore((s) => s.accounts);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);

  const forecast = useRecurrenceStore((s) => s.forecast);
  const isForecastLoading = useRecurrenceStore((s) => s.isForecastLoading);
  const hasLoadedForecastOnce = useRecurrenceStore(
    (s) => s.hasLoadedForecastOnce,
  );
  const forecastError = useRecurrenceStore((s) => s.forecastError);
  const fetchForecast = useRecurrenceStore((s) => s.fetchForecast);

  // Melhor dia de compra (EC-237): mora no mesmo store da renda porque nasce
  // das mesmas fontes. `null` cobre tanto "ainda não buscou" quanto "servidor
  // antigo sem o endpoint" — as duas situações renderizam o card como ausente
  const incomePattern = useWishStore((s) => s.incomePattern);
  const fetchIncomePattern = useWishStore((s) => s.fetchIncomePattern);

  const [window, setWindow] = useState<ForecastWindow>(3);
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null);
  const [baselineReady, setBaselineReady] = useState(transactions.length > 0);
  const bankAttempted = useRef(false);

  /**
   * De onde a projeção parte — e por que ela agora pode não partir de lugar
   * nenhum.
   *
   * <p><b>O que estava errado, com data.</b> Até 15/09/2026 o ponto de partida
   * era o LÍQUIDO DO EXTRATO: a soma de tudo que já tinha sido importado,
   * entradas menos saídas. O dono olhou o resultado e disse <i>"esse número é
   * absurdo"</i> — o app projetava que ele fecharia o mês devendo dezenove mil
   * reais, partindo de −R$ 20.515,63.
   *
   * <p>Não era um erro de arredondamento: <b>soma de movimento não é saldo</b>.
   * Ela só coincidiria com o saldo se o extrato começasse no dia em que a conta
   * foi aberta e não faltasse uma linha. E pior — a fatura do cartão caía na
   * mesma soma: cada compra derrubava o total, e o pagamento da fatura pela
   * conta corrente derrubava de novo. O mesmo dinheiro descontado duas vezes,
   * sempre para baixo, mês após mês.
   *
   * <p><b>Agora o saldo tem dono e data</b>: vem do que a instituição informou,
   * seja pelo conector, seja pelo bloco `LEDGERBAL` do OFX que a pessoa sobe.
   * Quando ninguém informou, o valor é `null` — e `null` NÃO vira zero. A tela
   * passa a projetar o MOVIMENTO do período em vez de um saldo inventado, e
   * diz isso com todas as letras. Ver `utils/cashPosition`.
   */
  const cash = useMemo(() => cashPositionFrom(accounts), [accounts]);
  const startingBalance = cash.amount ?? 0;
  const saldoConhecido = cash.amount != null;

  useEffect(() => {
    if (transactions.length > 0) {
      setBaselineReady(true);
      return;
    }
    // uma tentativa só: sem extrato importado o baseline é zero mesmo, e
    // repetir a busca a cada render seria um laço de rede
    if (bankAttempted.current) return;
    bankAttempted.current = true;
    fetchTransactions().finally(() => setBaselineReady(true));
  }, [transactions.length, fetchTransactions]);

  // O saldo base vem das contas, não mais do extrato: sem esta busca a
  // projeção partiria de "não sei" mesmo com o saldo já guardado no servidor
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    if (!baselineReady) return;
    fetchForecast(window, startingBalance);
  }, [baselineReady, window, startingBalance, fetchForecast]);

  // Parcelamentos: best-effort, uma vez. Sao a terceira fonte da linha do
  // tempo (EC-226) e uma falha aqui so tira as parcelas dela -- a previsao
  // inteira nao pode cair por causa de um bloco a mais
  useEffect(() => {
    getInstallments()
      .then(setParcelamentos)
      .catch(() => setParcelamentos(null));
  }, []);

  // Melhor dia de compra: revalida a cada foco, como a renda (a fonte muda em
  // outra tela). Best-effort — o store já engole o 404 do servidor antigo e
  // qualquer outro erro sem sujar a tela; se falhar, o card some sozinho
  useFocusEffect(
    useCallback(() => {
      fetchIncomePattern();
    }, [fetchIncomePattern]),
  );

  const handleWindowChange = useCallback((next: string) => {
    setWindow(Number(next) as ForecastWindow);
    setExpandedMonth(null);
  }, []);

  const handleToggleMonth = useCallback(
    (month: string) => {
      if (!reducedMotion) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      }
      setExpandedMonth((prev) => (prev === month ? null : month));
    },
    [reducedMotion],
  );

  const onRefresh = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await Promise.all([
      fetchTransactions(),
      fetchForecast(window, startingBalance),
    ]);
  }, [fetchTransactions, fetchForecast, window, startingBalance]);

  const months = useMemo(() => forecast?.months ?? [], [forecast]);
  // EC-226: seis meses à frente com o que JÁ tem dono. As três fontes
  // (parcela, fatura prevista e recorrência) somadas respondem quanto de
  // cada mês está comprometido antes de ele começar
  const [parcelamentos, setParcelamentos] =
    useState<InstallmentOverview | null>(null);
  const linhaDoTempo = useMemo(
    () => buildCommitmentTimeline(months, parcelamentos),
    [months, parcelamentos],
  );

  // Totais da janela alimentam a legenda: a regra do design system pede legenda
  // a partir de duas séries, e são exatamente estas duas
  const windowTotals = useMemo(() => {
    return months.reduce(
      (acc, month) => ({
        income: acc.income + month.expectedIncome,
        expense: acc.expense + month.expectedExpense,
      }),
      { income: 0, expense: 0 },
    );
  }, [months]);

  const hasProjection = months.some((month) => month.items.length > 0);

  /**
   * A RÉGUA DE 30 DIAS (escolha 9 do dono em 16/09).
   *
   * <p>Os itens vêm de TODOS os meses da resposta, não só do primeiro: com
   * ciclo ancorado (o de 12/08 a 11/09, por exemplo), os dias dos próximos 30
   * caem em dois períodos, e olhar só o primeiro perderia metade da janela.
   * Quem recorta por data é a própria `montarRegua`.
   */
  const regua = useMemo(
    () =>
      montarRegua({
        saldoInicial: startingBalance,
        itens: months.flatMap((mes) => mes.items),
        hoje: todayIso(),
      }),
    [months, startingBalance],
  );
  const listaContratada = useMemo(() => contratadosDaRegua(regua), [regua]);
  const somas = useMemo(() => somasContratadas(regua), [regua]);

  /**
   * Os três cenários precisam de gasto REAL passado, que a previsão não tem —
   * ela só sabe do que está contratado.
   *
   * <p>Três meses de CALENDÁRIO FECHADOS, e não os últimos 90 dias: o mês
   * corrente está no meio, e incluí-lo puxaria a média para baixo só porque
   * ele ainda não acabou — a "média" viraria um número que sempre parece
   * melhor do que a vida. Falha aqui não é erro de tela: sem histórico, a
   * seção mostra só o cenário "folgado", que não depende de estimativa.
   */
  const [gastoPassado, setGastoPassado] = useState<{
    media: number | null;
    pior: number | null;
  }>({ media: null, pior: null });

  useEffect(() => {
    let vivo = true;
    const mesAtual = monthKeyOf(todayIso());
    const fechados = [1, 2, 3].map((atras) => shiftMonthKey(mesAtual, -atras));

    Promise.all(
      fechados.map((month) =>
        getMonthlyAnalytics({ kind: "month", month }).catch(() => null),
      ),
    ).then((respostas) => {
      if (!vivo) return;
      const gastos = respostas
        .filter((r): r is NonNullable<typeof r> => r !== null)
        .map((r) => Math.abs(r.totalExpense))
        // Mês sem gasto nenhum é mês sem extrato importado, não um mês barato:
        // incluí-lo como zero afundaria a média e mentiria para o lado otimista
        .filter((valor) => valor > 0);
      if (gastos.length === 0) return;
      setGastoPassado({
        media: gastos.reduce((soma, v) => soma + v, 0) / gastos.length,
        pior: Math.max(...gastos),
      });
    });

    return () => {
      vivo = false;
    };
  }, []);

  const cenarios = useMemo(
    () =>
      tresCenarios({
        saldoInicial: startingBalance,
        receitaContratada: somas.receita,
        despesaContratada: somas.despesa,
        despesaMedia: gastoPassado.media,
        despesaPiorMes: gastoPassado.pior,
      }),
    [startingBalance, somas, gastoPassado],
  );
  const showSkeleton = !hasLoadedForecastOnce || !baselineReady;

  if (forecastError && !forecast) {
    return (
      <PageContainer>
        <ScreenHeader
          title="Perspectiva de saldo"
          subtitle="Para onde seu saldo vai"
          showProfileButton={false}
        />
        <ErrorState
          message={forecastError}
          onRetry={() => fetchForecast(window, startingBalance)}
        />
      </PageContainer>
    );
  }

  const chartMax = Math.max(windowTotals.income, windowTotals.expense, 1);

  return (
    <PageContainer>
      <ScreenHeader
        title="Perspectiva de saldo"
        subtitle="Para onde seu saldo vai"
        showProfileButton={false}
      />

      {showSkeleton ? (
        <ForecastSkeleton />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing[5],
            paddingTop: spacing[4],
            paddingBottom: insets.bottom + spacing[12],
          }}
          refreshControl={
            <RefreshControl
              refreshing={isForecastLoading}
              onRefresh={onRefresh}
              tintColor={t.accent.neon}
              colors={[t.accent.neon]}
            />
          }
        >
          <SegmentedControl
            options={WINDOW_OPTIONS}
            value={String(window) as `${ForecastWindow}`}
            onChange={handleWindowChange}
            size="md"
          />

          <FirstTimeCard
            id="previsao-medido-informado"
            title="Medido é uma coisa, informado é outra"
            body="Linha detectada no extrato leva o valor que o banco registrou; a que você digitou leva marca própria. A projeção soma as duas, mas nunca as confunde."
          />

          {/* Falha no refetch (trocar de janela, atualizar) mantém os dados
              antigos na tela — sem este aviso, o seletor marcaria uma janela e
              os cards mostrariam outra, em silêncio */}
          {forecastError && (
            <View
              accessible
              accessibilityLabel={`${forecastError} Os valores abaixo são da última janela carregada. Toque em tentar de novo para recarregar`}
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginTop: spacing[4],
                padding: spacing[3],
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: t.semantic.danger,
                backgroundColor: t.semantic.dangerMuted,
              }}
            >
              <TriangleAlert size={16} color={t.semantic.danger} />
              <Text
                style={{
                  flex: 1,
                  marginHorizontal: spacing[2],
                  color: t.semantic.danger,
                  fontSize: 12,
                  lineHeight: 17,
                  fontWeight: "600",
                }}
              >
                {forecastError} Os valores abaixo são da última janela
                carregada.
              </Text>
              <TouchableOpacity
                onPress={() => fetchForecast(window, startingBalance)}
                accessibilityRole="button"
                accessibilityLabel="Tentar calcular a previsão de novo"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                activeOpacity={0.8}
                style={{
                  minHeight: 36,
                  justifyContent: "center",
                  paddingHorizontal: spacing[3],
                  borderRadius: radius.full,
                  backgroundColor: t.semantic.danger,
                }}
              >
                <Text
                  style={{
                    color: t.text.inverse,
                    fontSize: 12,
                    fontWeight: "700",
                  }}
                >
                  Tentar de novo
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* De onde a projeção parte — declarado na cara, porque a conta
              inteira depende dele. Quando não há saldo informado, o que se
              declara é a AUSÊNCIA: a tela projeta movimento, não saldo */}
          <View
            accessible
            accessibilityLabel={
              saldoConhecido
                ? `Partindo de ${formatBRL(startingBalance)}, o saldo que suas contas informaram`
                : "Sem saldo informado: a projeção mostra o movimento do período, não o saldo"
            }
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[4],
              padding: spacing[3],
              borderRadius: radius.xl,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: saldoConhecido
                ? t.border.subtle
                : t.semantic.warning,
            }}
          >
            {saldoConhecido ? (
              <Info size={16} color={t.text.tertiary} />
            ) : (
              <TriangleAlert size={16} color={t.semantic.warning} />
            )}
            <Text
              style={{
                flex: 1,
                marginLeft: spacing[2],
                color: t.text.secondary,
                fontSize: 12,
                lineHeight: 17,
              }}
            >
              {saldoConhecido ? (
                <>
                  Partindo de{" "}
                  <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                    {formatBRLCompact(startingBalance)}
                  </Text>
                  , o saldo que suas contas informaram
                  {cash.caveat ? ` — ${cash.caveat.toLowerCase()}` : "."}
                </>
              ) : (
                <>
                  <Text style={{ color: t.text.primary, fontWeight: "700" }}>
                    Não sei quanto você tem hoje.
                  </Text>{" "}
                  Nenhuma conta informou saldo, então os valores abaixo são o{" "}
                  <Text style={{ fontWeight: "700" }}>movimento</Text> previsto
                  do período — quanto entra e quanto sai —, e não o saldo.
                  Importe um OFX do banco ou conecte a conta para a projeção
                  ganhar um ponto de partida.
                </>
              )}
            </Text>
          </View>

          {/* Melhor dia de compra (EC-237): o padrão de renda existe mesmo
              sem série de despesa nenhuma, então este card fica FORA do
              `!hasProjection` — quem não tem projeção de gastos ainda pode
              muito bem já ter salário e vale detectados.
              NO_INCOME fica de fora daqui: "cadastre uma renda" já é a
              conversa do bloco de baixo (`EmptyForecast`/o próprio card de
              saldo) quando não há nada para projetar — duplicar o convite
              aqui em cima seria a mesma pergunta feita duas vezes na tela */}
          {incomePattern && incomePattern.status !== "NO_INCOME" ? (
            <Animated.View
              entering={cardEntering}
              style={{ marginTop: spacing[4] }}
            >
              <PurchaseDayCard
                pattern={incomePattern}
                onAdjust={() =>
                  navigation.navigate(APP_ROUTES.renda as never)
                }
                onRegisterIncome={() =>
                  navigation.navigate(APP_ROUTES.renda as never)
                }
              />
            </Animated.View>
          ) : null}

          {!hasProjection ? (
            <EmptyForecast onBack={() => navigation.goBack()} />
          ) : (
            <>
              {/**
               * A RÉGUA DE 30 DIAS vem PRIMEIRO, e é a única parte da tela que
               * não estima nada (escolha 9 do dono em 16/09: "só com o que está
               * escrito em algum lugar (...) Nenhum número inventado").
               *
               * <p>Ela termina com a faixa "daqui para frente eu não sei". O
               * que vem depois dela nesta tela — os seis meses de projeção — é
               * estimativa, e agora está do lado certo daquela faixa. O dono
               * escolheu "a tela pára" ali; deixei os meses abaixo porque
               * apagá-los é irreversível e é decisão dele, não minha.
               */}
              {regua.dias.length > 0 ? (
                <Animated.View
                  entering={cardEntering}
                  style={{
                    backgroundColor: t.background.surface,
                    borderRadius: radius["2xl"],
                    borderWidth: 1,
                    borderColor: t.border.subtle,
                    padding: spacing[5],
                    marginTop: spacing[4],
                  }}
                >
                  {saldoConhecido ? (
                    <BalanceRulerHeadline
                      saldoInicial={regua.saldoInicial}
                      saldoNoFim={regua.saldoNoFimDoConhecido}
                    />
                  ) : null}
                  <View style={{ marginTop: spacing[4] }}>
                    <BalanceRuler
                      regua={regua}
                      contratados={listaContratada}
                      cenarios={cenarios}
                    />
                  </View>
                </Animated.View>
              ) : null}

              {/* Comparativo da janela: duas séries, legenda obrigatória */}
              <Animated.View
                entering={cardEntering}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-end",
                  backgroundColor: t.background.surface,
                  borderRadius: radius["2xl"],
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                  padding: spacing[4],
                  marginTop: spacing[4],
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "flex-end",
                    gap: spacing[2],
                    height: BAR_MAX_HEIGHT,
                  }}
                  // O gráfico é redundante com a legenda ao lado; anunciá-lo de
                  // novo só duplicaria os números para o leitor de tela
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <View
                    style={{
                      width: 26,
                      height: Math.max(
                        6,
                        (windowTotals.income / chartMax) * BAR_MAX_HEIGHT,
                      ),
                      borderRadius: radius.md,
                      backgroundColor: t.chart.up,
                    }}
                  />
                  <View
                    style={{
                      width: 26,
                      height: Math.max(
                        6,
                        (windowTotals.expense / chartMax) * BAR_MAX_HEIGHT,
                      ),
                      borderRadius: radius.md,
                      backgroundColor: t.chart.down,
                    }}
                  />
                </View>
                <ChartLegend
                  items={[
                    {
                      label: `Entradas previstas (${months.length} ${
                        months.length === 1 ? "mês" : "meses"
                      })`,
                      value: formatBRL(windowTotals.income),
                      color: t.chart.up,
                    },
                    {
                      label: "Saídas previstas",
                      value: formatBRL(windowTotals.expense),
                      color: t.chart.down,
                    },
                  ]}
                />
              </Animated.View>

              {/* A linha do tempo ANTES da lista: a barra responde "qual
                  mês aperta" num relance, e a lista responde "por quê".
                  Comparar seis valores em reais exigiria ler seis números e
                  lembrar dos anteriores */}
              {linhaDoTempo.length > 0 ? (
                <View style={{ marginTop: spacing[4] }}>
                  <CommitmentTimeline months={linhaDoTempo} showValues />
                </View>
              ) : null}

              <View style={{ marginTop: spacing[4] }}>
                {/* Identidade do card pelo `start` do recorte, que é o que o
                    rótulo descreve — `month` é só o mês em que o período
                    começa */}
                {months.map((month, index) => {
                  const key = forecastPeriodKey(month);
                  return (
                    <ForecastMonthCard
                      key={key}
                      month={month}
                      index={index}
                      expanded={expandedMonth === key}
                      onToggle={() => handleToggleMonth(key)}
                      saldoConhecido={saldoConhecido}
                    />
                  );
                })}
              </View>

              <Text
                style={{
                  color: t.text.tertiary,
                  fontSize: 11,
                  lineHeight: 16,
                  marginTop: spacing[2],
                }}
              >
                O período corrente projeta só o que ainda falta acontecer: o que
                já caiu na conta aparece marcado e fica fora da soma.
                Transferências entre suas próprias contas e séries sem ritmo
                definido não entram na projeção.
              </Text>
            </>
          )}
          {/* Fim do conteúdo: o slot nunca fica entre o usuário e os
            números dele. Some por completo no Plus */}
          <AdSlot style={{ marginTop: spacing[4] }} />
        </ScrollView>
      )}
      {/* EC-201: o assistente e porta, nao aba. Ele chega sabendo de
        qual tela foi aberto, e sugere as perguntas dela */}
      <AssistantFAB origin="previsao" />
    </PageContainer>
  );
}

function EmptyForecast({ onBack }: { onBack: () => void }) {
  const { cardEntering } = useMotionPresets();
  return (
    <Animated.View
      entering={cardEntering}
      style={{ alignItems: "center", paddingTop: spacing[10] }}
    >
      {/* EC-231: o pote vazio no lugar do relógio genérico — a projeção não
          tem de onde nascer, e o pote diz isso antes da frase */}
      <PotEmptyState
        mood="comecar"
        title="Ainda não há o que projetar"
        body="A projeção nasce das suas recorrências. Rode a varredura do extrato ou agende um gasto fixo para o app ter o que somar."
        actionLabel="Voltar para recorrências"
        onAction={onBack}
      />
    </Animated.View>
  );
}
