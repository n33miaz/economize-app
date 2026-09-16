import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, LayoutAnimation, Text, View } from "react-native";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import Info from "lucide-react-native/dist/esm/icons/info";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import type {
  AccountInvoice,
  BankTransaction,
  ConnectorAccount,
} from "../services/api";
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
import { bankKeyFor } from "../utils/bankBrand";
import BankLogo from "../components/BankLogo";
import BlockGrid from "../components/BlockGrid";
import ErrorState from "../components/ErrorState";
import { useLoadingDeadline } from "../hooks/useLoadingDeadline";
import FilterChipRow from "../components/FilterChipRow";
import InvoiceCard from "../components/InvoiceCard";
import InvoiceReserveSheet from "../components/InvoiceReserveSheet";
import AssistantFAB, { ASSISTANT_FAB_HEIGHT } from "../components/AssistantFAB";
import FirstTimeCard from "../components/FirstTimeCard";
import { usePullToRefresh } from "../hooks/usePullToRefresh";
import PageContainer from "../components/PageContainer";
import AdSlot from "../components/AdSlot";
import PotEmptyState, { type PotMood } from "../components/PotEmptyState";
import ScreenHeader from "../components/ScreenHeader";
import SegmentedControl from "../components/SegmentedControl";
import Skeleton from "../components/Skeleton";
import TransactionDetailSheet from "../components/TransactionDetailSheet";
import { navigateToStatement } from "../routes/navigateToStatement";

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

/**
 * Bloco vazio com a mesma moldura tracejada dos cards — nunca uma tela em
 * branco. EC-231: o pote no lugar do glifo num disco; o nível do pote é quem
 * diz se é começo (nada sincronizado) ou período sem movimento.
 */
function EmptyBlock({
  mood,
  title,
  message,
  action,
}: {
  mood: PotMood;
  title: string;
  message: string;
  action: { label: string; onPress: () => void };
}) {
  const t = useTheme();
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
      {/* Menor que o pote de tela cheia: aqui ele mora dentro de um card */}
      <PotEmptyState
        mood={mood}
        size={72}
        title={title}
        body={message}
        actionLabel={action.label}
        onAction={action.onPress}
      />
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
  const insets = useSafeAreaInsets();
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

  // Puxar para atualizar: o gesto que a plataforma inteira ensinou
  // nao pode faltar numa tela de dados
  const { control: refreshControl } = usePullToRefresh(() => fetchAccounts(true));

  const [selectedId, setSelectedId] = useState<string | null>(
    requestedId ?? null,
  );
  const [months, setMonths] = useState(String(DEFAULT_INVOICE_MONTHS));
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [detailTx, setDetailTx] = useState<BankTransaction | null>(null);
  // A fatura sendo coberta pela reserva (EC-181): guardo a fatura inteira, e
  // não só a referência, porque a folha precisa do total para propor "o valor
  // exato" e do que já está salvo para abrir preenchida
  const [reserveFor, setReserveFor] = useState<AccountInvoice | null>(null);

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
  // Antes dos returns antecipados de propósito: hook não pode ficar depois de
  // saída condicional. O prazo do esqueleto (EC-216) é lido lá embaixo
  const faturaDemorouDemais = useLoadingDeadline(!slot || slot.isLoading);
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

  // Pelo helper único, e já filtrado pelo cartão em foco quando há um: quem
  // sai daqui sem fatura quer ver o extrato DESTE cartão, não a lista inteira
  // para filtrar de novo
  const goToStatement = (account?: ConnectorAccount) =>
    navigateToStatement(
      navigation,
      account ? { accountId: account.id } : undefined,
    );

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
              mood="comecar"
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
              action={{
                label: "Ir para o Extrato",
                onPress: () => goToStatement(),
              }}
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
  // A instituição decide o logo do cabeçalho; o nome do cartão só entra quando
  // ele mesmo carrega a marca. Sem nenhum dos dois, fica o ícone genérico
  const cardBrand = selected
    ? selected.institution ?? (bankKeyFor(selected.name) ? selected.name : null)
    : null;

  const listHeader = (
    <View style={{ paddingTop: spacing[4] }}>
      {/* EC-228: a primeira vez explica, DENTRO da tela e na posição onde a
          dúvida acontece. Não é tour: tour é pedágio */}
      <View style={{ paddingHorizontal: spacing[5] }}>
        <FirstTimeCard
          id="fatura-ciclo"
          title="O ciclo desta fatura"
          body="O período segue o dia de fechamento que o banco informa — quando ele não informa, o corte é o mês do calendário, e a tela avisa."
        />
      </View>
      {cards.length > 1 && (
        <View style={{ paddingHorizontal: spacing[5], marginBottom: spacing[4] }}>
          <FilterChipRow
            // Pelo helper, e não por `card.name` cru: cartão que o provedor
            // mandou sem nome viraria um chip em branco
            options={cards.map((card) => ({
              key: card.id,
              label: accountDisplayName(card),
              // EC-229: reconhecer o roxo do Nubank e mais rapido do que ler
              // "Ultravioleta ····1234" numa fileira rolante
              brand: card.institution ?? (bankKeyFor(card.name) ? card.name : null),
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
              {cardBrand ? (
                <BankLogo
                  institution={cardBrand}
                  size={40}
                  style={{ marginRight: spacing[3] }}
                />
              ) : (
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
              )}
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
    // EC-216: esqueleto tem prazo. Esta é exatamente a aba que ficava eterna
    // no concorrente — Faturas nunca terminava de carregar, sem erro e sem
    // botão. Passado o prazo, a promessa "está vindo" vira mentira animada
    if (isLoadingInvoices && faturaDemorouDemais) {
      return (
        <ErrorState
          message="A fatura está demorando mais do que deveria. Pode ser a conexão com a instituição."
          onRetry={() => selectedId && fetchInvoices(selectedId, Number(months))}
        />
      );
    }
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
          // Há cartão, só não houve movimento no recorte: pote pela metade
          mood="sem-movimento"
          title="Nenhuma fatura no período"
          // Pela janela que o servidor respondeu, e não pela que o seletor
          // mostra: durante uma troca em voo as duas divergem
          message={`Este cartão não teve lançamento nos últimos ${loadedMonths} meses. Amplie o período ou sincronize o banco de novo no Extrato.`}
          action={{
            label: "Ir para o Extrato",
            onPress: () => goToStatement(selected),
          }}
        />
      </View>
    );
  };

  return (
    <PageContainer>
      {header}
      <FlatList
            refreshControl={refreshControl}
        data={timeline}
        keyExtractor={(item) => item.key}
        // Memoizado: um objeto literal novo a cada render invalida a
        // comparação da FlatList e re-renderiza toda célula visível de graça
        extraData={cellDeps}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // O rodapé reserva o que flutua sobre a lista — o FAB do
          // assistente — mais a barra de gestos, senão o último card e o
          // anúncio ficam sob o botão (fórmula dos Relatórios)
          paddingBottom:
            insets.bottom + spacing[5] + ASSISTANT_FAB_HEIGHT + spacing[4],
          flexGrow: 1,
        }}
        ListHeaderComponent={listHeader}
        // Só monta o vazio quando ele vai aparecer: com a lista cheia, o
        // `renderEmpty()` de antes construía esqueletos a cada render
        ListFooterComponent={
          // Fim da lista: o slot nunca fica entre o usuário e os
          // números dele. Devolve null no Plus, sem reservar espaço
          // Com o mesmo respiro lateral dos cards: colado nas duas bordas, o
          // banner com raio e borda lia como defeito
          <AdSlot style={{ marginTop: spacing[4], marginHorizontal: spacing[5] }} />
        }
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
                onEditReserve={setReserveFor}
                categories={categories}
              />
            </View>
          );
        }}
      />

      <InvoiceReserveSheet
        visible={reserveFor !== null}
        invoice={reserveFor}
        cardAccountId={selectedId}
        accounts={accounts}
        onClose={() => setReserveFor(null)}
        onSaved={() => {
          // A reserva volta DENTRO da fatura: recarregar o cartão é o único
          // jeito de o chip e o valor guardado não discordarem
          if (selectedId) fetchInvoices(selectedId, Number(months));
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
    {/* EC-201: o assistente e porta, nao aba. Ele chega sabendo de
        qual tela foi aberto, e sugere as perguntas dela */}
    <AssistantFAB origin="fatura" />
    </PageContainer>
  );
}
