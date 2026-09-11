import React, { useCallback, useMemo, useState } from "react";
import {
  Linking,
  RefreshControl,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ArrowDownRight from "lucide-react-native/dist/esm/icons/arrow-down-right";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import Newspaper from "lucide-react-native/dist/esm/icons/newspaper";
import Pencil from "lucide-react-native/dist/esm/icons/pencil";
import Plus from "lucide-react-native/dist/esm/icons/plus";
import RefreshCw from "lucide-react-native/dist/esm/icons/refresh-cw";
import Trash2 from "lucide-react-native/dist/esm/icons/trash-2";
import X from "lucide-react-native/dist/esm/icons/x";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import Animated from "react-native-reanimated";

import type {
  InvestmentMovement,
  InvestmentPosition,
  InvestmentSummary,
  TopicNewsArticle,
  TreasuryBond,
} from "../services/api";
import { useConnectorStore } from "../store/connectorStore";
import { askConfirm } from "../store/confirmStore";
import {
  selectQuotes,
  selectServerLacksInvestments,
  selectUsdBrl,
  useInvestmentStore,
  type Slice,
} from "../store/investmentStore";
import { useToastStore } from "../store/toastStore";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useTheme, type Theme } from "../theme/ThemeProvider";
import { radius, SHEET_PADDING, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets, usePressScale } from "../theme/motionPresets";
import * as Haptics from "../utils/haptics";
import { formatDayMonthShort } from "../utils/cycleWindow";
import {
  buildWatchCards,
  explainIndicatorForUser,
  formatBRLOrNull,
  formatProfit,
  formatRelativeTime,
  formatShortDate,
  groupPositionsByType,
  hasTreasuryInterest,
  investmentSourceLabel,
  maturityLabel,
  movementKindLabel,
  movementSignedAmount,
  positionCurrentValue,
  positionNeedsQuote,
  positionSubtitle,
  profitOf,
  treasuryRateLabel,
  treasuryRelevantTo,
  type WatchCardData,
} from "../utils/investments";
import { formatBRL, formatBRLCompact, formatPercent } from "../utils/money";
import BlockGrid from "../components/BlockGrid";
import CustomModal from "../components/CustomModal";
import ErrorState from "../components/ErrorState";
import PotEmptyState from "../components/PotEmptyState";
import InvestmentInterestSheet from "../components/InvestmentInterestSheet";
import InvestmentPositionSheet from "../components/InvestmentPositionSheet";
import AssistantFAB from "../components/AssistantFAB";
import PageContainer from "../components/PageContainer";
import AdSlot from "../components/AdSlot";
import Skeleton from "../components/Skeleton";
import { APP_ROUTES, FINANCE_TAB_ROUTES } from "../routes/routeNames";

/**
 * Peso relativo de altura por bloco, para a grade do desktop. O resumo e a
 * fileira de indicadores são baixos; a lista de posições é a mais alta.
 */
const BLOCK_WEIGHTS = {
  resumo: 2,
  indicadores: 2,
  tesouro: 2,
  posicoes: 4,
  movimentacoes: 3,
  radar: 3,
};

/** Quantas movimentações a lista mostra antes do "ver todas". */
const MOVEMENTS_PREVIEW = 6;

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** Primeira carga: a fatia nunca respondeu e está em voo. */
const isFirstLoad = (slice: Slice<unknown>) =>
  slice.fetchedAt === null && slice.loading;

/** Falhou e não há nada anterior para mostrar no lugar. */
const isBlockingError = (slice: Slice<unknown>) =>
  slice.error !== null && slice.data === null;

/**
 * Investimentos (EC-15x): a quarta leitura do mesmo dinheiro — "o que está
 * rendendo". Consolida o que o conector trouxe, o que o extrato deixou ver e
 * o que o usuário cadastrou à mão, e PERSONALIZA o resto da tela pelo que ele
 * tem: os indicadores que mexem no CDB dele, os títulos do Tesouro nos
 * indexadores dele, as manchetes dos tópicos dele.
 *
 * Hierarquia dos blocos, que é a ordem no celular e a semente da grade no
 * desktop: (1) o resumo — a resposta que a aba existe para dar; (2) os
 * indicadores dele — o que mexe nessa resposta hoje; (3) o Tesouro nos
 * indexadores dele — a referência de mercado para comparar; (4) as posições
 * — o detalhe da resposta; (5) as movimentações — o histórico; (6) o radar —
 * contexto, por último porque é o que menos muda a decisão.
 *
 * Cada bloco falha sozinho: `ErrorState` compacto com "tentar de novo" no
 * lugar dele, nunca a tela inteira.
 */
export default function Investments() {
  const t = useTheme();
  const navigation = useNavigation();
  const { columns } = useBreakpoint();
  const { cardEntering } = useMotionPresets();
  const showToast = useToastStore((s) => s.showToast);

  // Única leitura do conector nesta tela: o estado da conexão bancária
  // mora em `status`, sem nome de provedor (o app não cita quem faz o meio)
  const connectorEnabled = useConnectorStore((s) => s.status.enabled);

  const summary = useInvestmentStore((s) => s.summary);
  const positions = useInvestmentStore((s) => s.positions);
  const movements = useInvestmentStore((s) => s.movements);
  const profile = useInvestmentStore((s) => s.profile);
  const macro = useInvestmentStore((s) => s.macro);
  const treasury = useInvestmentStore((s) => s.treasury);
  const news = useInvestmentStore((s) => s.news);
  const quoteSlices = useInvestmentStore((s) => s.quotes);
  const syncing = useInvestmentStore((s) => s.syncing);
  const serverLacks = useInvestmentStore(selectServerLacksInvestments);
  const usdBrl = useInvestmentStore(selectUsdBrl);

  const fetchAll = useInvestmentStore((s) => s.fetchAll);
  const fetchSummary = useInvestmentStore((s) => s.fetchSummary);
  const fetchPositions = useInvestmentStore((s) => s.fetchPositions);
  const fetchMovements = useInvestmentStore((s) => s.fetchMovements);
  const fetchProfile = useInvestmentStore((s) => s.fetchProfile);
  const fetchMacro = useInvestmentStore((s) => s.fetchMacro);
  const fetchTreasury = useInvestmentStore((s) => s.fetchTreasury);
  const fetchNews = useInvestmentStore((s) => s.fetchNews);
  const sync = useInvestmentStore((s) => s.sync);
  const deletePosition = useInvestmentStore((s) => s.deletePosition);
  const removeInterest = useInvestmentStore((s) => s.removeInterest);

  const [refreshing, setRefreshing] = useState(false);
  const [explaining, setExplaining] = useState<WatchCardData | null>(null);
  const [interestOpen, setInterestOpen] = useState(false);
  const [positionSheet, setPositionSheet] = useState<{
    open: boolean;
    position: InvestmentPosition | null;
  }>({ open: false, position: null });
  const [showAllTreasury, setShowAllTreasury] = useState(false);
  const [showAllMovements, setShowAllMovements] = useState(false);

  // Cacheado por fatia no store: voltar à aba dentro de cinco minutos não
  // custa uma requisição — e a montagem já é um foco
  useFocusEffect(
    useCallback(() => {
      fetchAll();
    }, [fetchAll]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await fetchAll(true);
    setRefreshing(false);
  }, [fetchAll]);

  const quotes = useMemo(
    () => selectQuotes({ quotes: quoteSlices }),
    [quoteSlices],
  );

  const watchCards = useMemo(
    () => buildWatchCards(profile.data, macro.data ?? [], quotes),
    [profile.data, macro.data, quotes],
  );

  const groups = useMemo(
    () => groupPositionsByType(positions.data ?? []),
    [positions.data],
  );

  const treasuryInterest = hasTreasuryInterest(profile.data);
  const relevantBonds = useMemo(
    () => treasuryRelevantTo(profile.data, treasury.data ?? []),
    [profile.data, treasury.data],
  );

  const goToStatement = () =>
    navigation.navigate(FINANCE_TAB_ROUTES.extrato as never);
  const goToNews = () => navigation.navigate(APP_ROUTES.noticias as never);
  const openNewPosition = () =>
    setPositionSheet({ open: true, position: null });

  const handleSync = async () => {
    const result = await sync();
    if (!result) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      showToast(
        useInvestmentStore.getState().syncError ?? "Falha ao sincronizar.",
        "error",
      );
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const changed = result.created + result.updated;
    if (changed === 0) {
      showToast("Nenhuma posição nova no conector.", "info");
      return;
    }
    const parts: string[] = [];
    if (result.created > 0) {
      parts.push(`${result.created} ${plural(result.created, "nova", "novas")}`);
    }
    if (result.updated > 0) {
      parts.push(
        `${result.updated} ${plural(result.updated, "atualizada", "atualizadas")}`,
      );
    }
    showToast(`Investimentos sincronizados: ${parts.join(", ")}.`, "success");
  };

  const confirmDelete = (position: InvestmentPosition) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    askConfirm({
      title: "Excluir posição",
      message: `"${position.name}" sai da sua lista. Isso não mexe em nada no banco — a posição foi cadastrada à mão.`,
      confirmLabel: "Excluir",
      destructive: true,
      onConfirm: async () => {
        try {
          await deletePosition(position.id);
          showToast("Posição excluída.", "success");
        } catch {
          showToast("Não foi possível excluir agora.", "error");
        }
      },
    });
  };

  const confirmRemoveWatch = (card: WatchCardData) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    askConfirm({
      title: "Deixar de acompanhar",
      message: `${card.label} sai de Seus indicadores. Dá para voltar pelo "+ acompanhar".`,
      confirmLabel: "Remover",
      destructive: true,
      onConfirm: async () => {
        try {
          await removeInterest(card.watch.kind, card.watch.code);
          setExplaining(null);
        } catch {
          showToast("Não foi possível remover agora.", "error");
        }
      },
    });
  };

  const hasPositions = (positions.data?.length ?? 0) > 0;
  const summaryEmpty =
    summary.data !== null && summary.data.positionsCount === 0 && !hasPositions;

  // --- Bloco 1: resumo ---
  const resumo = (
    <Animated.View key="resumo" entering={cardEntering} style={blockStyle}>
      {isFirstLoad(summary) ? (
        <Card t={t}>
          <Skeleton width={120} height={14} />
          <View style={{ height: spacing[3] }} />
          <Skeleton width="70%" height={34} />
          <View style={{ height: spacing[4] }} />
          <Skeleton width="100%" height={44} borderRadius={radius.full} />
        </Card>
      ) : isBlockingError(summary) ? (
        <ErrorState
          compact
          message={summary.error ?? undefined}
          onRetry={() => fetchSummary(true)}
        />
      ) : summaryEmpty || summary.data === null ? (
        <EmptyBlock
          t={t}
          title={
            serverLacks
              ? "Investimentos ainda não disponíveis"
              : "Ainda não encontramos investimentos."
          }
          message={
            serverLacks
              ? "Este servidor ainda não oferece o módulo de investimentos. Assim que ele for atualizado, suas posições aparecem aqui."
              : "Conecte seu banco ou cadastre à mão."
          }
          actions={
            serverLacks
              ? []
              : [
                  { label: "Conectar banco", onPress: goToStatement },
                  {
                    label: "Cadastrar à mão",
                    onPress: openNewPosition,
                    secondary: true,
                  },
                ]
          }
        />
      ) : (
        <SummaryCard
          t={t}
          summary={summary.data}
          stale={summary.error !== null}
          connectorEnabled={connectorEnabled}
          syncing={syncing}
          onSync={handleSync}
          onAddManual={openNewPosition}
        />
      )}
    </Animated.View>
  );

  // --- Bloco 2: seus indicadores ---
  const indicadores = (
    <Animated.View key="indicadores" entering={cardEntering} style={blockStyle}>
      <BlockHeader
        t={t}
        title="Seus indicadores"
        subtitle={
          profile.data?.isDefault
            ? "Sugestão inicial — vira seu perfil conforme você investe"
            : "O que mexe no seu dinheiro hoje"
        }
        action={
          <TouchableOpacity
            onPress={() => setInterestOpen(true)}
            accessibilityLabel="Acompanhar indicador"
            accessibilityRole="button"
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[3],
              minHeight: 36,
              borderRadius: radius.full,
              backgroundColor: t.accent.neonMuted,
            }}
          >
            <Plus size={14} color={t.accent.neon} />
            <Text
              style={{
                color: t.accent.neon,
                fontSize: 12,
                fontWeight: "700",
                marginLeft: spacing[1],
              }}
            >
              acompanhar
            </Text>
          </TouchableOpacity>
        }
      />
      {isFirstLoad(profile) ? (
        <View style={{ flexDirection: "row", gap: spacing[3] }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} width={150} height={112} borderRadius={radius["2xl"]} />
          ))}
        </View>
      ) : isBlockingError(profile) ? (
        <ErrorState
          compact
          message={profile.error ?? undefined}
          onRetry={() => fetchProfile(true)}
        />
      ) : watchCards.length === 0 ? (
        <Card t={t} dashed>
          <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19 }}>
            Nenhum indicador acompanhado. Toque em "+ acompanhar" para escolher
            o que importa para o seu dinheiro: CDI, Selic, IPCA, dólar ou um
            ticker.
          </Text>
        </Card>
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: spacing[3], paddingRight: spacing[1] }}
          >
            {watchCards.map((card) => (
              <WatchCard
                key={card.key}
                t={t}
                card={card}
                onPress={() => setExplaining(card)}
                onRemove={() => confirmRemoveWatch(card)}
              />
            ))}
          </ScrollView>
          {macro.error && macro.data === null ? (
            <View style={{ marginTop: spacing[3] }}>
              <ErrorState
                compact
                message={macro.error}
                onRetry={() => fetchMacro(true)}
              />
            </View>
          ) : null}
        </>
      )}
    </Animated.View>
  );

  // --- Bloco 3: Tesouro Direto ---
  const allBonds = treasury.data ?? [];
  const shownBonds = showAllTreasury ? allBonds : relevantBonds;
  const tesouro =
    treasury.unavailable && allBonds.length === 0 ? null : (
      <Animated.View key="tesouro" entering={cardEntering} style={blockStyle}>
        <BlockHeader
          t={t}
          title="Tesouro Direto"
          subtitle={
            treasuryInterest
              ? "Taxas de hoje nos indexadores que você tem"
              : "Taxas de hoje"
          }
          action={
            allBonds.length > relevantBonds.length ? (
              <TouchableOpacity
                onPress={() => setShowAllTreasury((prev) => !prev)}
                accessibilityLabel={
                  showAllTreasury
                    ? "Mostrar só os títulos dos meus indexadores"
                    : "Ver todos os títulos"
                }
                accessibilityRole="button"
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={{ color: t.accent.neon, fontSize: 12, fontWeight: "700" }}>
                  {showAllTreasury ? "Só os meus" : "Ver todos"}
                </Text>
              </TouchableOpacity>
            ) : undefined
          }
        />
        {isFirstLoad(treasury) ? (
          <Card t={t}>
            {[0, 1].map((i) => (
              <View key={i} style={{ marginBottom: i === 0 ? spacing[3] : 0 }}>
                <Skeleton width="60%" height={14} />
                <View style={{ height: spacing[2] }} />
                <Skeleton width="40%" height={12} />
              </View>
            ))}
          </Card>
        ) : isBlockingError(treasury) ? (
          <ErrorState
            compact
            message={treasury.error ?? undefined}
            onRetry={() => fetchTreasury(true)}
          />
        ) : shownBonds.length === 0 ? (
          <Card t={t} dashed>
            <Text style={{ color: t.text.secondary, fontSize: 13, lineHeight: 19 }}>
              {treasuryInterest
                ? "Nenhum título nos seus indexadores hoje."
                : "Você não tem título atrelado a Selic, IPCA ou prefixado. Toque em \"Ver todos\" para ver as taxas do dia."}
            </Text>
          </Card>
        ) : (
          <Card t={t}>
            {shownBonds.map((bond, index) => (
              <TreasuryRow
                key={`${bond.name}-${bond.maturity}`}
                t={t}
                bond={bond}
                last={index === shownBonds.length - 1}
              />
            ))}
            <Text
              style={{
                color: t.text.tertiary,
                fontSize: 11,
                marginTop: spacing[3],
              }}
            >
              {`Fonte: ${shownBonds[0].source}${
                formatRelativeTime(shownBonds[0].asOf)
                  ? ` · ${formatRelativeTime(shownBonds[0].asOf)}`
                  : ""
              }`}
            </Text>
          </Card>
        )}
      </Animated.View>
    );

  // --- Bloco 4: posições ---
  const posicoes =
    !hasPositions && !positions.loading && positions.error === null ? null : (
      <Animated.View key="posicoes" entering={cardEntering} style={blockStyle}>
        <BlockHeader
          t={t}
          title="Posições"
          subtitle={
            hasPositions
              ? `${positions.data!.length} ${plural(positions.data!.length, "posição", "posições")}`
              : undefined
          }
          action={
            <TouchableOpacity
              onPress={openNewPosition}
              accessibilityLabel="Cadastrar posição à mão"
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            >
              <Plus size={18} color={t.accent.neon} />
            </TouchableOpacity>
          }
        />
        {isFirstLoad(positions) ? (
          <>
            {[0, 1, 2].map((i) => (
              <View key={i} style={{ marginBottom: spacing[3] }}>
                <Skeleton height={84} borderRadius={radius["2xl"]} />
              </View>
            ))}
          </>
        ) : isBlockingError(positions) ? (
          <ErrorState
            compact
            message={positions.error ?? undefined}
            onRetry={() => fetchPositions(true)}
          />
        ) : (
          groups.map((group) => (
            <View key={group.type} style={{ marginBottom: spacing[3] }}>
              <Text
                accessibilityRole="header"
                style={{
                  color: t.text.tertiary,
                  fontSize: 11,
                  fontWeight: "700",
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  marginBottom: spacing[2],
                }}
              >
                {group.label}
              </Text>
              {group.positions.map((position) => (
                <PositionRow
                  key={position.id}
                  t={t}
                  position={position}
                  value={positionCurrentValue(position, quotes, usdBrl)}
                  onEdit={() => setPositionSheet({ open: true, position })}
                  onDelete={() => confirmDelete(position)}
                />
              ))}
            </View>
          ))
        )}
      </Animated.View>
    );

  // --- Bloco 5: movimentações ---
  const movementItems = movements.data?.items ?? [];
  const shownMovements = showAllMovements
    ? movementItems
    : movementItems.slice(0, MOVEMENTS_PREVIEW);
  const movimentacoes =
    !hasPositions && movementItems.length === 0 && !movements.loading
      ? null
      : (
          <Animated.View key="movimentacoes" entering={cardEntering} style={blockStyle}>
            <BlockHeader t={t} title="Movimentações" subtitle="Últimos 12 meses" />
            {isFirstLoad(movements) ? (
              <Card t={t}>
                <Skeleton width="100%" height={44} />
                <View style={{ height: spacing[3] }} />
                <Skeleton width="100%" height={40} />
              </Card>
            ) : isBlockingError(movements) ? (
              <ErrorState
                compact
                message={movements.error ?? undefined}
                onRetry={() => fetchMovements(true)}
              />
            ) : (
              <Card t={t}>
                <View style={{ flexDirection: "row", marginBottom: spacing[3] }}>
                  <Stat t={t} label="Aplicado" value={movements.data?.totals.applied ?? 0} />
                  <Stat t={t} label="Resgatado" value={movements.data?.totals.redeemed ?? 0} />
                  <Stat
                    t={t}
                    label="Rendimentos"
                    value={movements.data?.totals.yield ?? 0}
                    tone="success"
                  />
                </View>
                {movementItems.length === 0 ? (
                  <Text style={{ color: t.text.tertiary, fontSize: 13 }}>
                    Nenhuma movimentação reconhecida no período.
                  </Text>
                ) : (
                  <>
                    {shownMovements.map((movement, index) => (
                      <MovementRow
                        key={movement.transactionId}
                        t={t}
                        movement={movement}
                        last={index === shownMovements.length - 1}
                      />
                    ))}
                    {movementItems.length > MOVEMENTS_PREVIEW ? (
                      <TouchableOpacity
                        onPress={() => setShowAllMovements((prev) => !prev)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          showAllMovements
                            ? "Mostrar menos movimentações"
                            : `Ver todas as ${movementItems.length} movimentações`
                        }
                        style={{ alignSelf: "center", marginTop: spacing[3], minHeight: 36, justifyContent: "center" }}
                      >
                        <Text style={{ color: t.accent.neon, fontSize: 12, fontWeight: "700" }}>
                          {showAllMovements
                            ? "Mostrar menos"
                            : `Ver todas (${movementItems.length})`}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </>
                )}
              </Card>
            )}
          </Animated.View>
        );

  // --- Bloco 6: radar ---
  const radar = (
    <Animated.View key="radar" entering={cardEntering} style={blockStyle}>
      <BlockHeader
        t={t}
        title="Radar do investidor"
        subtitle="Manchetes dos seus tópicos"
      />
      {isFirstLoad(news) || (news.data === null && profile.loading) ? (
        <Card t={t}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: i === 2 ? 0 : spacing[3] }}>
              <Skeleton width="90%" height={14} />
              <View style={{ height: spacing[1] }} />
              <Skeleton width="40%" height={11} />
            </View>
          ))}
        </Card>
      ) : isBlockingError(news) ? (
        <ErrorState
          compact
          message={news.error ?? undefined}
          onRetry={() => fetchNews(true)}
        />
      ) : (
        <Card t={t}>
          {(news.data ?? []).length === 0 ? (
            <Text style={{ color: t.text.tertiary, fontSize: 13, lineHeight: 19 }}>
              Nenhuma manchete para os seus tópicos hoje.
            </Text>
          ) : (
            (news.data ?? []).map((article, index) => (
              <HeadlineRow
                key={article.url}
                t={t}
                article={article}
                last={index === (news.data?.length ?? 0) - 1}
              />
            ))
          )}
          <TouchableOpacity
            onPress={goToNews}
            accessibilityRole="button"
            accessibilityLabel="Ver mais em Notícias"
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              marginTop: spacing[3],
              minHeight: 40,
            }}
          >
            <Text style={{ color: t.accent.neon, fontSize: 13, fontWeight: "700" }}>
              Ver mais em Notícias
            </Text>
            <ChevronRight size={16} color={t.accent.neon} />
          </TouchableOpacity>
        </Card>
      )}
    </Animated.View>
  );

  return (
    <PageContainer refadeOnFocus>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: spacing[4], paddingBottom: spacing[10] }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[t.accent.neon]}
            tintColor={t.accent.neon}
          />
        }
      >
        <BlockGrid columns={columns} weights={BLOCK_WEIGHTS}>
          {[resumo, indicadores, tesouro, posicoes, movimentacoes, radar]}
        </BlockGrid>
        {/* Fim do conteúdo: o slot nunca fica entre o usuário e os
            números dele. Some por completo no Plus */}
        <AdSlot style={{ marginTop: spacing[4] }} />
      </ScrollView>

      <IndicatorExplainSheet
        t={t}
        card={explaining}
        explanation={
          explaining
            ? explainIndicatorForUser(explaining.explainCode, profile.data)
            : ""
        }
        onClose={() => setExplaining(null)}
        onRemove={() => explaining && confirmRemoveWatch(explaining)}
      />
      <InvestmentInterestSheet
        visible={interestOpen}
        onClose={() => setInterestOpen(false)}
      />
      <InvestmentPositionSheet
        visible={positionSheet.open}
        position={positionSheet.position}
        onClose={() => setPositionSheet((prev) => ({ ...prev, open: false }))}
      />
    {/* EC-201: o assistente e porta, nao aba. Ele chega sabendo de
        qual tela foi aberto, e sugere as perguntas dela */}
    <AssistantFAB origin="investimentos" />
    </PageContainer>
  );
}

// --- Peças da tela ---

const blockStyle = { paddingHorizontal: spacing[5], marginBottom: spacing[5] };

function Card({
  t,
  children,
  dashed = false,
}: {
  t: Theme;
  children: React.ReactNode;
  dashed?: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: t.background.surface,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: t.border.default,
        padding: spacing[4],
      }}
    >
      {children}
    </View>
  );
}

function BlockHeader({
  t,
  title,
  subtitle,
  action,
}: {
  t: Theme;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: spacing[3],
      }}
    >
      <View style={{ flex: 1, marginRight: spacing[3] }}>
        <Text
          accessibilityRole="header"
          style={{ color: t.text.primary, fontSize: 18, fontWeight: "700" }}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {action}
    </View>
  );
}

function EmptyBlock({
  t,
  title,
  message,
  actions,
}: {
  t: Theme;
  title: string;
  message: string;
  actions: { label: string; onPress: () => void; secondary?: boolean }[];
}) {
  const principal = actions.find((a) => !a.secondary);
  const secundaria = actions.find((a) => a.secondary);
  return (
    <View
      style={{
        backgroundColor: t.background.surface,
        borderRadius: radius["3xl"],
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: t.border.default,
      }}
    >
      {/* EC-231: o pote vazio no lugar do glifo de tendência num disco. A
          primeira ação é a principal (conectar), a segunda vem como fantasma
          (cadastrar à mão) — e o PotEmptyState só desenha a segunda quando
          existe a primeira */}
      <PotEmptyState
        mood="comecar"
        size={72}
        title={title}
        body={message}
        actionLabel={principal?.label}
        onAction={principal?.onPress}
        secondaryActionLabel={secundaria?.label}
        onSecondaryAction={secundaria?.onPress}
      />
    </View>
  );
}

function SummaryCard({
  t,
  summary,
  stale,
  connectorEnabled,
  syncing,
  onSync,
  onAddManual,
}: {
  t: Theme;
  summary: InvestmentSummary;
  /** A atualização falhou e o número na tela é o anterior. */
  stale: boolean;
  connectorEnabled: boolean;
  syncing: boolean;
  onSync: () => void;
  onAddManual: () => void;
}) {
  const syncPress = usePressScale();
  const positive = summary.profit >= 0;
  const tone = positive ? t.semantic.success : t.semantic.danger;
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
  const updated = formatRelativeTime(summary.updatedAt);

  return (
    <Card t={t}>
      <Text style={{ color: t.text.secondary, fontSize: 13 }}>Valor atual</Text>
      {/* Abreviar em vez de quebrar: o número grande divide a linha com o
          selo de resultado. Quem ouve recebe o valor inteiro */}
      <Text
        numberOfLines={1}
        accessibilityLabel={`Valor atual: ${formatBRL(summary.currentValue)}`}
        style={[typography.numericDisplay, { color: t.text.primary, marginTop: spacing[1] }]}
      >
        {formatBRLCompact(summary.currentValue)}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flexWrap: "wrap",
          gap: spacing[2],
          marginTop: spacing[2],
        }}
      >
        <View
          accessible
          accessibilityLabel={`Resultado: ${formatProfit({
            value: summary.profit,
            percent: summary.profitPercent,
          })}`}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: spacing[2],
            paddingVertical: spacing[1],
            borderRadius: radius.lg,
            backgroundColor: positive ? t.semantic.successMuted : t.semantic.dangerMuted,
          }}
        >
          <DeltaIcon size={14} color={tone} />
          <Text
            style={{
              color: tone,
              fontSize: 12,
              fontWeight: "700",
              marginLeft: spacing[1],
            }}
          >
            {formatProfit({ value: summary.profit, percent: summary.profitPercent })}
          </Text>
        </View>
        <Text style={{ color: t.text.secondary, fontSize: 12 }}>
          {`investido ${formatBRL(summary.totalInvested)}`}
        </Text>
      </View>

      <View
        style={{
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "center",
          gap: spacing[2],
          marginTop: spacing[3],
        }}
      >
        {summary.sources.map((source) => (
          <View
            key={source}
            style={{
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[1],
              borderRadius: radius.full,
              backgroundColor: t.background.elevated,
              borderWidth: 1,
              borderColor: t.border.subtle,
            }}
          >
            <Text style={{ color: t.text.secondary, fontSize: 11, fontWeight: "700" }}>
              {investmentSourceLabel(source)}
            </Text>
          </View>
        ))}
        <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
          {[
            `${summary.positionsCount} ${plural(summary.positionsCount, "posição", "posições")}`,
            updated ? `atualizado ${updated}` : null,
            stale ? "sem atualizar agora" : null,
            summary.stalePositions > 0
              ? `${summary.stalePositions} ${plural(summary.stalePositions, "desatualizada", "desatualizadas")}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: spacing[3], marginTop: spacing[4] }}>
        {connectorEnabled ? (
          <Animated.View style={[{ flex: 1 }, syncPress.pressStyle]}>
            <TouchableOpacity
              onPress={onSync}
              onPressIn={syncPress.onPressIn}
              onPressOut={syncPress.onPressOut}
              disabled={syncing}
              accessibilityLabel="Sincronizar investimentos"
              accessibilityRole="button"
              accessibilityState={{ disabled: syncing, busy: syncing }}
              activeOpacity={0.85}
              style={{
                height: 44,
                borderRadius: radius.full,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.accent.neon,
                opacity: syncing ? 0.7 : 1,
              }}
            >
              <RefreshCw size={16} color={t.text.inverse} />
              <Text
                style={{
                  color: t.text.inverse,
                  fontSize: 13,
                  fontWeight: "700",
                  marginLeft: spacing[2],
                }}
              >
                {syncing ? "Sincronizando…" : "Sincronizar investimentos"}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ) : null}
        <TouchableOpacity
          onPress={onAddManual}
          accessibilityLabel="Cadastrar à mão"
          accessibilityRole="button"
          activeOpacity={0.85}
          style={{
            flex: connectorEnabled ? undefined : 1,
            height: 44,
            paddingHorizontal: spacing[4],
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: t.border.strong,
          }}
        >
          <Text style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>
            Cadastrar à mão
          </Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

function WatchCard({
  t,
  card,
  onPress,
  onRemove,
}: {
  t: Theme;
  card: WatchCardData;
  onPress: () => void;
  onRemove: () => void;
}) {
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const variation = card.variation;
  const positive = (variation ?? 0) >= 0;
  const tone = positive ? t.semantic.success : t.semantic.danger;
  const DeltaIcon = positive ? ArrowUpRight : ArrowDownRight;
  const spoken = [
    `${card.label}: ${card.value ?? "indisponível"}`,
    card.secondary,
    variation !== null ? formatPercent(variation, { signed: true }) : null,
    card.staleNote,
    "Toque para entender por que importa para você",
  ]
    .filter(Boolean)
    .join(". ");

  return (
    // O "x" de deixar de acompanhar é IRMÃO do card, não filho: botão dentro
    // de botão é HTML inválido na web (o React avisava a cada render) e o
    // leitor de tela anunciava os dois como um só. Ele fica absoluto no canto
    // e o rótulo reserva o espaço à direita
    <Animated.View
      style={[{ minWidth: 150, maxWidth: 190, position: "relative" }, pressStyle]}
    >
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onRemove}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityLabel={spoken}
        accessibilityRole="button"
        activeOpacity={0.85}
        style={{
          padding: spacing[4],
          borderRadius: radius["2xl"],
          borderWidth: 1,
          borderColor: t.border.default,
          backgroundColor: t.background.surface,
          minHeight: 112,
        }}
      >
        <Text
          numberOfLines={2}
          style={{
            color: t.text.secondary,
            fontSize: 12,
            fontWeight: "700",
            marginRight: spacing[5],
          }}
        >
          {card.label}
        </Text>
        <Text
          numberOfLines={1}
          style={[
            typography.numericMd,
            {
              color: card.value ? t.text.primary : t.text.tertiary,
              marginTop: spacing[2],
              fontSize: card.value ? 20 : 13,
            },
          ]}
        >
          {card.value ?? "indisponível"}
        </Text>
        {card.secondary ? (
          <Text style={{ color: t.text.secondary, fontSize: 11, marginTop: 2 }}>
            {card.secondary}
          </Text>
        ) : null}
        {variation !== null ? (
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              marginTop: spacing[2],
              paddingHorizontal: spacing[2],
              paddingVertical: 2,
              borderRadius: radius.lg,
              backgroundColor: positive ? t.semantic.successMuted : t.semantic.dangerMuted,
            }}
          >
            <DeltaIcon size={12} color={tone} />
            <Text style={{ color: tone, fontSize: 11, fontWeight: "700", marginLeft: 2 }}>
              {formatPercent(variation, { signed: true })}
            </Text>
          </View>
        ) : null}
        {card.staleNote ? (
          <Text
            style={{
              color: t.semantic.warning,
              fontSize: 11,
              fontWeight: "700",
              marginTop: spacing[2],
            }}
          >
            {card.staleNote}
          </Text>
        ) : null}
      </TouchableOpacity>
      <TouchableOpacity
        onPress={onRemove}
        accessibilityLabel={`Deixar de acompanhar ${card.label}`}
        accessibilityRole="button"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{
          position: "absolute",
          top: spacing[3],
          right: spacing[3],
          padding: 4,
        }}
      >
        <X size={14} color={t.text.tertiary} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function IndicatorExplainSheet({
  t,
  card,
  explanation,
  onClose,
  onRemove,
}: {
  t: Theme;
  card: WatchCardData | null;
  explanation: string;
  onClose: () => void;
  onRemove: () => void;
}) {
  return (
    <CustomModal visible={card !== null} onClose={onClose}>
      {card ? (
        <View style={SHEET_PADDING}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: spacing[3],
            }}
          >
            <Text
              style={{ flex: 1, color: t.text.primary, fontSize: 18, fontWeight: "700" }}
            >
              {card.label}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: t.background.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={18} color={t.text.secondary} />
            </TouchableOpacity>
          </View>
          <Text style={[typography.numericLg, { color: t.text.primary }]}>
            {card.value ?? "indisponível"}
          </Text>
          {card.secondary ? (
            <Text style={{ color: t.text.secondary, fontSize: 13, marginTop: 2 }}>
              {card.secondary}
            </Text>
          ) : null}
          {card.staleNote ? (
            <Text style={{ color: t.semantic.warning, fontSize: 12, fontWeight: "700", marginTop: spacing[2] }}>
              {card.staleNote}
            </Text>
          ) : null}
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              fontWeight: "700",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginTop: spacing[5],
              marginBottom: spacing[2],
            }}
          >
            Por que importa para você
          </Text>
          <Text style={{ color: t.text.primary, fontSize: 15, lineHeight: 22 }}>
            {explanation}
          </Text>
          <TouchableOpacity
            onPress={onRemove}
            accessibilityLabel={`Deixar de acompanhar ${card.label}`}
            accessibilityRole="button"
            style={{ alignSelf: "flex-start", marginTop: spacing[5], minHeight: 40, justifyContent: "center" }}
          >
            <Text style={{ color: t.semantic.danger, fontSize: 13, fontWeight: "700" }}>
              Deixar de acompanhar
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </CustomModal>
  );
}

function TreasuryRow({ t, bond, last }: { t: Theme; bond: TreasuryBond; last: boolean }) {
  const rate = treasuryRateLabel(bond);
  const maturity = formatShortDate(bond.maturity);
  return (
    <View
      accessible
      accessibilityLabel={`${bond.name}${rate ? `, taxa de compra ${rate}` : ""}${maturity ? `, vence em ${maturity}` : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing[3],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.border.subtle,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing[3],
        }}
      >
        <Landmark size={16} color={t.text.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text.primary, fontSize: 14, fontWeight: "700" }}>
          {bond.name}
        </Text>
        <Text style={{ color: t.text.tertiary, fontSize: 12, marginTop: 2 }}>
          {maturity ? `vence ${maturity}` : "sem vencimento informado"}
        </Text>
      </View>
      <Text style={[typography.body, { color: t.text.primary, fontFamily: "Roboto_700Bold" }]}>
        {rate ?? "—"}
      </Text>
    </View>
  );
}

function PositionRow({
  t,
  position,
  value,
  onEdit,
  onDelete,
}: {
  t: Theme;
  position: InvestmentPosition;
  value: number | null;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const manual = position.source === "MANUAL";
  const subtitle = positionSubtitle(position);
  const maturity = maturityLabel(position.maturityDate);
  const profit = profitOf(position.investedAmount, value);
  const valueLabel = formatBRLOrNull(value);
  const profitPositive = (profit?.value ?? 0) >= 0;

  return (
    <View
      style={{
        backgroundColor: t.background.surface,
        borderRadius: radius["2xl"],
        borderWidth: 1,
        borderColor: t.border.subtle,
        padding: spacing[4],
        marginBottom: spacing[2],
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ flex: 1, marginRight: spacing[3] }}>
          <Text numberOfLines={1} style={{ color: t.text.primary, fontSize: 15, fontWeight: "700" }}>
            {position.name}
          </Text>
          {subtitle ? (
            <Text numberOfLines={1} style={{ color: t.text.secondary, fontSize: 12, marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
          {maturity ? (
            <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
              {maturity}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {valueLabel ? (
            <Text
              numberOfLines={1}
              style={[typography.numericMd, { color: t.text.primary, fontSize: 16 }]}
            >
              {valueLabel}
            </Text>
          ) : (
            // Manual em dólar sem preço: dizer "indisponível" é honesto;
            // R$ 0,00 seria uma perda inventada
            <Text style={{ color: t.text.tertiary, fontSize: 12, fontStyle: "italic" }}>
              {positionNeedsQuote(position) ? "cotação indisponível" : "sem valor"}
            </Text>
          )}
          {profit ? (
            <Text
              numberOfLines={1}
              style={{
                color: profitPositive ? t.semantic.success : t.semantic.danger,
                fontSize: 11,
                fontWeight: "700",
                marginTop: 2,
              }}
            >
              {formatProfit(profit)}
            </Text>
          ) : null}
        </View>
      </View>

      {(manual || position.stale) && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            flexWrap: "wrap",
            gap: spacing[2],
            marginTop: spacing[3],
          }}
        >
          {position.stale ? (
            <View
              style={{
                paddingHorizontal: spacing[2],
                paddingVertical: 2,
                borderRadius: radius.full,
                backgroundColor: t.semantic.warningMuted,
              }}
            >
              <Text style={{ color: t.semantic.warning, fontSize: 11, fontWeight: "700" }}>
                desatualizada
              </Text>
            </View>
          ) : null}
          {manual ? (
            <>
              <View
                style={{
                  paddingHorizontal: spacing[2],
                  paddingVertical: 2,
                  borderRadius: radius.full,
                  backgroundColor: t.background.elevated,
                  borderWidth: 1,
                  borderColor: t.border.subtle,
                }}
              >
                <Text style={{ color: t.text.secondary, fontSize: 11, fontWeight: "700" }}>
                  Manual
                </Text>
              </View>
              <View style={{ flex: 1 }} />
              <TouchableOpacity
                onPress={onEdit}
                accessibilityLabel={`Editar ${position.name}`}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: spacing[1] }}
              >
                <Pencil size={16} color={t.text.secondary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onDelete}
                accessibilityLabel={`Excluir ${position.name}`}
                accessibilityRole="button"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={{ padding: spacing[1] }}
              >
                <Trash2 size={16} color={t.text.tertiary} />
              </TouchableOpacity>
            </>
          ) : null}
        </View>
      )}
    </View>
  );
}

function Stat({
  t,
  label,
  value,
  tone,
}: {
  t: Theme;
  label: string;
  value: number;
  tone?: "success";
}) {
  return (
    <View style={{ flex: 1 }} accessible accessibilityLabel={`${label}: ${formatBRL(value)}`}>
      <Text style={{ color: t.text.tertiary, fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[
          typography.numericMd,
          {
            fontSize: 15,
            color: tone === "success" && value > 0 ? t.semantic.success : t.text.primary,
            marginTop: 2,
          },
        ]}
      >
        {formatBRLCompact(value)}
      </Text>
    </View>
  );
}

function MovementRow({
  t,
  movement,
  last,
}: {
  t: Theme;
  movement: InvestmentMovement;
  last: boolean;
}) {
  const signed = movementSignedAmount(movement.kind, movement.amount);
  const color =
    movement.kind === "YIELD"
      ? t.semantic.success
      : movement.kind === "REDEEM"
        ? t.text.secondary
        : t.text.primary;
  return (
    <View
      accessible
      accessibilityLabel={`${movementKindLabel(movement.kind)} de ${formatBRL(Math.abs(signed))} em ${formatDayMonthShort(movement.date)}${movement.institution ? `, ${movement.institution}` : ""}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing[2],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.border.subtle,
      }}
    >
      <Text style={{ width: 52, color: t.text.tertiary, fontSize: 12 }}>
        {formatDayMonthShort(movement.date)}
      </Text>
      <View style={{ flex: 1, marginHorizontal: spacing[2] }}>
        <Text numberOfLines={1} style={{ color: t.text.primary, fontSize: 13, fontWeight: "700" }}>
          {movementKindLabel(movement.kind)}
        </Text>
        <Text numberOfLines={1} style={{ color: t.text.tertiary, fontSize: 11 }}>
          {[movement.institution, movement.description].filter(Boolean).join(" · ")}
        </Text>
      </View>
      <Text style={[typography.numericMd, { fontSize: 14, color }]}>
        {`${signed < 0 ? "-" : movement.kind === "YIELD" ? "+" : ""}${formatBRL(Math.abs(signed))}`}
      </Text>
    </View>
  );
}

function HeadlineRow({
  t,
  article,
  last,
}: {
  t: Theme;
  article: TopicNewsArticle;
  last: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={() => Linking.openURL(article.url)}
      accessibilityRole="link"
      accessibilityLabel={`${article.title}. Abrir em ${article.source.name}`}
      activeOpacity={0.85}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: spacing[3],
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: t.border.subtle,
        minHeight: 44,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          alignItems: "center",
          justifyContent: "center",
          marginRight: spacing[3],
        }}
      >
        <Newspaper size={14} color={t.text.secondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={2} style={{ color: t.text.primary, fontSize: 13, lineHeight: 18, fontWeight: "700" }}>
          {article.title}
        </Text>
        <Text style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}>
          {[article.source.name, article.publishedAt ? formatDayMonthShort(article.publishedAt) : null]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
