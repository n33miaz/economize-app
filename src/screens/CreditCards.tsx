import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import Info from "lucide-react-native/dist/esm/icons/info";
import Landmark from "lucide-react-native/dist/esm/icons/landmark";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import Animated from "react-native-reanimated";

import type { BankTransaction, ConnectorAccount } from "../services/api";
import { DEFAULT_INVOICE_MONTHS, useAccountsStore } from "../store/accountsStore";
import { useCategoriesStore } from "../store/categoriesStore";
import { useBreakpoint } from "../hooks/useBreakpoint";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useMotionPresets } from "../theme/motionPresets";
import {
  INVOICE_APPROX_NOTE,
  INVOICE_APPROX_TITLE,
  accountDisplayName,
  accountSubtitle,
  buildInvoiceTimeline,
  creditCardAccounts,
  describeInvoiceGap,
  describeInvoiceWindow,
  invoiceCycleIsApproximate,
} from "../utils/accounts";
import BlockGrid from "../components/BlockGrid";
import ErrorState from "../components/ErrorState";
import FilterChipRow from "../components/FilterChipRow";
import InvoiceCard from "../components/InvoiceCard";
import PageContainer from "../components/PageContainer";
import ScreenHeader from "../components/ScreenHeader";
import SegmentedControl from "../components/SegmentedControl";
import Skeleton from "../components/Skeleton";
import TransactionDetailSheet from "../components/TransactionDetailSheet";
import { APP_ROUTES, FINANCE_TAB_ROUTES, MAIN_TAB_ROUTES } from "../routes/routeNames";

// Janelas oferecidas, dentro da faixa 1–24 que a API aceita. Contam faturas
// FECHADAS: a que está em aberto vem sempre, e de graça.
const MONTH_OPTIONS = [
  { label: "3 meses", value: "3" },
  { label: "6 meses", value: "6" },
  { label: "12 meses", value: "12" },
];

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** Bloco vazio com a mesma moldura dos cards — nunca uma tela em branco. */
function EmptyBlock({
  Icon,
  title,
  message,
  action,
}: {
  Icon: typeof CreditCard;
  title: string;
  message: string;
  action?: { label: string; onPress: () => void };
}) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: t.background.surface,
        borderRadius: radius["3xl"],
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: t.border.default,
        padding: spacing[8],
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: radius.full,
          backgroundColor: t.background.elevated,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing[4],
        }}
      >
        <Icon size={34} color={t.accent.neon} />
      </View>
      <Text
        style={{
          color: t.text.primary,
          fontSize: 17,
          fontWeight: "700",
          textAlign: "center",
          marginBottom: spacing[2],
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: 19,
          textAlign: "center",
        }}
      >
        {message}
      </Text>
      {action ? (
        <TouchableOpacity
          onPress={action.onPress}
          accessibilityLabel={action.label}
          accessibilityRole="button"
          activeOpacity={0.85}
          style={{
            marginTop: spacing[5],
            height: 48,
            paddingHorizontal: spacing[6],
            borderRadius: radius.full,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
          }}
        >
          <Text
            style={{ color: t.text.inverse, fontSize: 14, fontWeight: "700" }}
          >
            {action.label}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Faturas do cartão (EC-113).
 *
 * O cartão é escolhido por uma FILEIRA DE CHIPS, e não por uma tela de lista
 * que empilha outra por cima. Quem tem dois cartões compara os dois em um
 * toque, sem ir e voltar — e não existe o beco de voltar de uma tela de
 * detalhe para uma lista de um item só. O `accountId` ainda chega por
 * parâmetro de rota (é assim que o Extrato manda o usuário para o cartão que
 * ele estava filtrando), mas ele só escolhe o chip inicial.
 */
export default function CreditCards() {
  const t = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { columns } = useBreakpoint();
  const { cardEntering, reducedMotion } = useMotionPresets();

  // O projeto não tem ParamList tipado — cast local e pontual, como nas
  // outras telas que recebem parâmetro
  const requestedId = (route.params as any)?.accountId as string | undefined;

  const accounts = useAccountsStore((s) => s.accounts);
  const isLoadingAccounts = useAccountsStore((s) => s.isLoading);
  const hasLoadedAccounts = useAccountsStore((s) => s.hasLoadedOnce);
  const accountsError = useAccountsStore((s) => s.error);
  const fetchAccounts = useAccountsStore((s) => s.fetchAccounts);
  const fetchInvoices = useAccountsStore((s) => s.fetchInvoices);
  const invoicesByAccount = useAccountsStore((s) => s.invoices);

  const categoryItems = useCategoriesStore((s) => s.items);
  const fetchCategories = useCategoriesStore((s) => s.fetch);

  const [selectedId, setSelectedId] = useState<string | null>(
    requestedId ?? null,
  );
  const [months, setMonths] = useState(String(DEFAULT_INVOICE_MONTHS));
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<BankTransaction | null>(null);

  useFocusEffect(
    useCallback(() => {
      // Cacheado no store: só bate na rede na primeira tela que precisar
      fetchAccounts();
      fetchCategories();
    }, [fetchAccounts, fetchCategories]),
  );

  const cards = useMemo(() => creditCardAccounts(accounts), [accounts]);

  // Sem escolha válida, o primeiro cartão assume. O `id` pedido pela rota pode
  // ter sumido entre uma sincronização e outra — cair no primeiro é melhor do
  // que uma tela vazia apontando para um cartão que não existe mais
  useEffect(() => {
    if (cards.length === 0) return;
    setSelectedId((current) =>
      current && cards.some((card) => card.id === current)
        ? current
        : cards[0].id,
    );
  }, [cards]);

  useEffect(() => {
    if (!selectedId) return;
    fetchInvoices(selectedId, Number(months));
  }, [selectedId, months, fetchInvoices]);

  const selected: ConnectorAccount | undefined = useMemo(
    () => cards.find((card) => card.id === selectedId),
    [cards, selectedId],
  );
  const slot = selectedId ? invoicesByAccount[selectedId] : undefined;
  const payload = slot?.data;
  const approximate = payload
    ? invoiceCycleIsApproximate(payload.cycleSource)
    : false;

  const timeline = useMemo(
    () => buildInvoiceTimeline(payload?.invoices ?? []),
    [payload],
  );

  const categories = useMemo(
    () => new Map(categoryItems.map((c) => [c.id, c])),
    [categoryItems],
  );

  // Tudo que a célula lê de fora do `item`. Estável entre renders que não
  // mudam nada disso, que é o ponto do `extraData`
  const cellDeps = useMemo(
    () => ({ expandedKey, categories, approximate }),
    [expandedKey, categories, approximate],
  );

  const handleToggle = (key: string) => {
    if (!reducedMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setExpandedKey((prev) => (prev === key ? null : key));
  };

  const goToStatement = () => {
    (navigation as any).navigate(APP_ROUTES.main, {
      screen: MAIN_TAB_ROUTES.financas,
      params: { screen: FINANCE_TAB_ROUTES.extrato },
    });
  };

  // O subtítulo fala da COLEÇÃO, não do cartão escolhido: o nome e o ciclo dele
  // já estão no bloco de identidade logo abaixo, e repetir os dois aqui faria o
  // cabeçalho mudar a cada troca de chip sem dizer nada de novo
  const subtitle = !hasLoadedAccounts
    ? "Carregando suas contas"
    : cards.length === 0
      ? "Nenhum cartão sincronizado"
      : `${cards.length} ${plural(cards.length, "cartão sincronizado", "cartões sincronizados")}`;

  // Sem botão de volta: Cartões é DESTINO de trilho, e nenhum par dela no
  // grupo "Aprofundar" (Análise, Relatórios, Previsão, Categorias) tem um. As
  // telas do app que têm são tarefa/modal — Revisão, Nino, Agendamento — e
  // todas usam "X · Fechar". Uma seta "Voltar" aqui seria um terceiro padrão
  // criado de passagem; quem chega do Extrato volta pelo gesto e pela aba.
  const header = (
    <ScreenHeader title="Cartões" subtitle={subtitle} showProfileButton={false} />
  );

  // Primeira carga das contas: esqueletos com a geometria dos cards de fatura
  if (!hasLoadedAccounts && isLoadingAccounts) {
    return (
      <PageContainer>
        {header}
        <View style={{ padding: spacing[5] }}>
          <Skeleton width={220} height={36} borderRadius={radius.full} />
          <View style={{ height: spacing[4] }} />
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: spacing[3] }}>
              <Skeleton height={132} borderRadius={radius["2xl"]} />
            </View>
          ))}
        </View>
      </PageContainer>
    );
  }

  if (accountsError && accounts.length === 0) {
    return (
      <PageContainer>
        {header}
        <ErrorState
          message={accountsError}
          onRetry={() => fetchAccounts(true)}
        />
      </PageContainer>
    );
  }

  if (cards.length === 0) {
    // Dois vazios diferentes: quem nunca sincronizou não tem conta nenhuma;
    // quem sincronizou só a conta corrente tem contas, mas nenhum cartão. A
    // mensagem que serve para um mente para o outro.
    const neverSynced = accounts.length === 0;
    return (
      <PageContainer>
        {header}
        <View style={{ padding: spacing[5] }}>
          <Animated.View entering={cardEntering}>
            <EmptyBlock
              Icon={neverSynced ? CreditCard : Landmark}
              title={
                neverSynced
                  ? "Nenhuma conta sincronizada"
                  : "Nenhum cartão por aqui"
              }
              message={
                neverSynced
                  ? "As faturas nascem da sincronização com o banco. Extrato importado de arquivo não diz de qual cartão ele veio, então esses lançamentos ficam sem origem — e sem fatura."
                  : `Você tem ${accounts.length} ${plural(accounts.length, "conta sincronizada", "contas sincronizadas")}, mas nenhuma é cartão de crédito. Só cartão fecha em ciclos.`
              }
              action={{ label: "Ir para o Extrato", onPress: goToStatement }}
            />
          </Animated.View>
        </View>
      </PageContainer>
    );
  }

  const invoicesError = slot?.error ?? null;
  // Sem slot é porque o pedido ainda nem saiu (o cartão acabou de ser
  // escolhido). Tratar isso como "carregando" evita o pisca-pisca de "nenhuma
  // fatura" no quadro anterior à requisição
  const isLoadingInvoices = !slot || slot.isLoading;
  // Janela nova pedida com a anterior ainda na tela: o seletor já mudou e a
  // lista embaixo ainda é a antiga. Sem dizer isso, os dois se contradizem em
  // silêncio — que era exatamente o defeito do descarte no store
  const windowPending = Boolean(slot?.data) && isLoadingInvoices;
  // A janela que produziu o que está na tela, não a que o seletor mostra: são
  // a mesma coisa em regime, e diferentes justamente enquanto a troca não
  // fecha — que é quando a frase importa
  const loadedMonths = slot?.months ?? Number(months);
  const windowNote = payload
    ? describeInvoiceWindow(payload.invoices, loadedMonths)
    : null;

  const listHeader = (
    <View style={{ paddingTop: spacing[4] }}>
      {cards.length > 1 && (
        <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
          <FilterChipRow
            // Pelo helper, e não por `card.name` cru: cartão que o provedor
            // mandou sem nome viraria um chip em branco
            options={cards.map((card) => ({
              key: card.id,
              label: accountDisplayName(card),
            }))}
            value={selectedId ?? cards[0].id}
            onChange={setSelectedId}
            spokenPrefix="Cartão"
          />
        </View>
      )}

      <BlockGrid columns={columns} weights={{ identidade: 2, aviso: 3 }}>
        {[
          <View key="identidade" style={{ paddingHorizontal: spacing[5] }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: t.background.surface,
                borderRadius: radius["2xl"],
                borderWidth: 1,
                borderColor: t.border.subtle,
                padding: spacing[4],
                marginBottom: spacing[4],
              }}
            >
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  backgroundColor: t.accent.neonMuted,
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: spacing[3],
                }}
              >
                <CreditCard size={20} color={t.accent.neon} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  numberOfLines={1}
                  style={{
                    color: t.text.primary,
                    fontSize: 15,
                    fontWeight: "700",
                  }}
                >
                  {selected ? accountDisplayName(selected) : ""}
                </Text>
                <Text
                  style={{
                    color: t.text.secondary,
                    fontSize: 12,
                    marginTop: 2,
                  }}
                >
                  {selected ? accountSubtitle(selected) : ""}
                </Text>
              </View>
            </View>
          </View>,

          approximate ? (
            <View key="aviso" style={{ paddingHorizontal: spacing[5] }}>
              <View
                accessible
                accessibilityLabel={`${INVOICE_APPROX_TITLE}. ${INVOICE_APPROX_NOTE}`}
                style={{
                  flexDirection: "row",
                  backgroundColor: t.semantic.warningMuted,
                  borderRadius: radius.xl,
                  padding: spacing[4],
                  marginBottom: spacing[4],
                }}
              >
                <Info size={16} color={t.semantic.warning} />
                <View style={{ flex: 1, marginLeft: spacing[2] }}>
                  <Text
                    style={{
                      color: t.semantic.warning,
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    {INVOICE_APPROX_TITLE}
                  </Text>
                  <Text
                    style={{
                      color: t.text.secondary,
                      fontSize: 12,
                      lineHeight: 17,
                      marginTop: 2,
                    }}
                  >
                    {INVOICE_APPROX_NOTE}
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            false
          ),
        ]}
      </BlockGrid>

      {/* Rótulo em cima e controle de largura cheia: lado a lado, num iPhone
          SE a frase quebrava em três linhas ao lado da pílula */}
      <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
        <Text
          numberOfLines={1}
          style={{
            color: t.text.tertiary,
            fontSize: 10,
            fontWeight: "700",
            textTransform: "uppercase",
            letterSpacing: 1.2,
            marginBottom: spacing[2],
          }}
        >
          Período · faturas fechadas
        </Text>
        {/* `size="md"`: 44px de alvo. Este é o controle principal da tela — ele
            decide o que está na lista —, não um ajuste de preferência, e é o
            critério que o próprio SegmentedControl documenta */}
        <SegmentedControl
          options={MONTH_OPTIONS}
          value={months}
          onChange={setMonths}
          size="md"
        />
        {windowPending ? (
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              marginTop: spacing[2],
            }}
          >
            Atualizando o período…
          </Text>
        ) : windowNote ? (
          // "Pedi 6, vieram 4": a API omite ciclo sem lançamento, e sem esta
          // frase o seletor afirma um número que a lista embaixo não confirma
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 11,
              lineHeight: 16,
              marginTop: spacing[2],
            }}
          >
            {windowNote}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (isLoadingInvoices) {
      return (
        <View style={{ paddingHorizontal: spacing[5] }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ marginBottom: spacing[3] }}>
              <Skeleton height={132} borderRadius={radius["2xl"]} />
            </View>
          ))}
        </View>
      );
    }
    if (invoicesError) {
      return (
        <ErrorState
          message={invoicesError}
          onRetry={() => selectedId && fetchInvoices(selectedId, Number(months))}
        />
      );
    }
    return (
      <View style={{ paddingHorizontal: spacing[5] }}>
        <EmptyBlock
          Icon={CreditCard}
          title="Nenhuma fatura no período"
          // Pela janela que o servidor respondeu, e não pela que o seletor
          // mostra: durante uma troca em voo as duas divergem
          message={`Este cartão não teve lançamento nos últimos ${loadedMonths} meses. Amplie o período ou sincronize o banco de novo no Extrato.`}
          action={{ label: "Ir para o Extrato", onPress: goToStatement }}
        />
      </View>
    );
  };

  return (
    <PageContainer>
      {header}
      <FlatList
        data={timeline}
        keyExtractor={(item) => item.key}
        // Memoizado: um objeto literal novo a cada render invalida a
        // comparação da FlatList e re-renderiza toda célula visível de graça
        extraData={cellDeps}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: spacing[10], flexGrow: 1 }}
        ListHeaderComponent={listHeader}
        // Só monta o vazio quando ele vai aparecer: com a lista cheia, o
        // `renderEmpty()` de antes construía esqueletos a cada render
        ListEmptyComponent={timeline.length === 0 ? renderEmpty() : null}
        renderItem={({ item }) => {
          if (item.kind === "gap") {
            // O buraco é informação: a API OMITE ciclo sem lançamento, e sem
            // esta linha o usuário leria dezembro logo depois de outubro sem
            // perceber que novembro existiu e foi zero
            return (
              <View
                style={{
                  paddingHorizontal: spacing[5],
                  paddingVertical: spacing[2],
                  marginBottom: spacing[3],
                  flexDirection: "row",
                  alignItems: "center",
                }}
              >
                <View
                  style={{ flex: 1, height: 1, backgroundColor: t.border.subtle }}
                />
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontSize: 11,
                    marginHorizontal: spacing[3],
                    textAlign: "center",
                  }}
                >
                  {describeInvoiceGap(item.gap)}
                </Text>
                <View
                  style={{ flex: 1, height: 1, backgroundColor: t.border.subtle }}
                />
              </View>
            );
          }
          return (
            <View style={{ paddingHorizontal: spacing[5] }}>
              <InvoiceCard
                invoice={item.invoice}
                approximate={approximate}
                expanded={expandedKey === item.key}
                onToggle={() => handleToggle(item.key)}
                onOpenTransaction={setDetailTx}
                categories={categories}
              />
            </View>
          );
        }}
      />

      <TransactionDetailSheet
        transaction={detailTx}
        visible={detailTx !== null}
        onClose={() => setDetailTx(null)}
        onUpdated={() => {
          // O apelido salvo vale para a lista inteira; a fatura é derivada no
          // servidor, então recarregar o cartão é o caminho honesto para a
          // folha e a lista não discordarem do nome
          if (selectedId) fetchInvoices(selectedId, Number(months));
        }}
      />
    </PageContainer>
  );
}
