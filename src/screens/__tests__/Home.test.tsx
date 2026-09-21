import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider, type Metrics } from "react-native-safe-area-context";

import Home from "../Home";
import { useAnalyticsStore } from "../../store/analyticsStore";
import { useAuthStore } from "../../store/authStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useIndicatorStore } from "../../store/indicatorStore";
import { useNewsStore } from "../../store/newsStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useRecurrenceStore } from "../../store/recurrenceStore";
import { useReviewStore } from "../../store/reviewStore";
import { useShoppingStore } from "../../store/shoppingStore";
import { useUserStore } from "../../store/userStore";
import { useWalletStore } from "../../store/walletStore";
import { useWishStore } from "../../store/wishStore";
import { formatBRL } from "../../utils/money";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: { get: jest.fn().mockResolvedValue({ data: { articles: [] } }) },
  // O calendário do mês (EC-235) sai na entrada da tela. Vazio aqui: estes
  // testes cobrem os blocos da Home, e a grade tem suíte própria
  getDailyTotals: jest.fn().mockResolvedValue([]),
  getInstallments: jest
    .fn()
    .mockResolvedValue({
      totalSeries: 0,
      openSeries: 0,
      remainingTotal: 0,
      series: [],
    }),
  // Melhor dia de compra (EC-237): a Home só dispara a busca — quem lê o
  // resultado é o PurchaseDayLine, direto do store. Explícito aqui porque o
  // jest.mock deste arquivo já não devolve `undefined` por padrão
  getIncomePattern: jest.fn().mockResolvedValue(null),
  savePurchasePreference: jest.fn(),
  clearPurchasePreference: jest.fn(),
}));

// Trocável por teste: o anúncio do pote depende de a Home estar na frente
const mockUseIsFocused = jest.fn(() => true);

// Estável entre chamadas de `useNavigation`: com um `jest.fn()` criado dentro
// da fábrica, cada chamada devolvia um espião novo e nenhum atalho podia ser
// conferido. Mesmo padrão do `mockUseIsFocused` acima
const mockNavigate = jest.fn();

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    canGoBack: () => false,
    getState: () => ({ index: 0, routes: [{ name: "Principal" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => mockUseIsFocused(),
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const MES = {
  month: "2026-08",
  start: "2026-08-01",
  end: "2026-08-31",
  totalIncome: 5423.68,
  totalExpense: 6862.7,
  net: -1439.02,
  previous: {
    month: "2026-07",
    start: "2026-07-01",
    end: "2026-07-31",
    totalIncome: 5256.31,
    totalExpense: 4391.99,
    net: 864.32,
  },
  categories: [],
  pendingReviewCount: 0,
  caveats: [],
  lastTransactionDate: "2026-08-31",
};

function prepararStores() {
  useAuthStore.setState({ token: "t", userName: "Neemias" } as never);
  useAnalyticsStore.setState({
    homeData: MES,
    isHomeLoading: false,
    months: ["2026-08"],
    fetchHomeMonthly: jest.fn().mockResolvedValue(undefined),
  } as never);
  useIndicatorStore.setState({
    indicators: [],
    loading: false,
    favoriteSnapshots: {},
    fetchIndicators: jest.fn().mockResolvedValue(undefined),
  } as never);
  useWalletStore.setState({
    transactions: [],
    fetchedAt: Date.now(),
    fetchTransactions: jest.fn().mockResolvedValue(undefined),
  } as never);
  useFavoritesStore.setState({ favorites: [] } as never);
  useReviewStore.setState({
    pendingCount: 0,
    fetchPendingCount: jest.fn().mockResolvedValue(undefined),
  } as never);
  useRecurrenceStore.setState({
    series: [],
    forecast: null,
    fetchSeries: jest.fn().mockResolvedValue(undefined),
  } as never);
  useWishStore.setState({
    committed: null,
    income: null,
    incomePattern: null,
    fetchCommitted: jest.fn().mockResolvedValue(undefined),
    fetchIncome: jest.fn().mockResolvedValue(undefined),
    fetchIncomePattern: jest.fn().mockResolvedValue(undefined),
  } as never);
  usePreferencesStore.setState({
    hideBalance: false,
    potAnnouncementSeen: true,
    mealVoucherPromptDismissedFor: "always",
    cycleAnchorDay: 1,
    hasHydrated: true,
    sessionCount: 1,
  } as never);
  useUserStore.setState({ me: null } as never);
  usePlanStore.setState({ plan: "FREE", adsEnabled: true });
  useNewsStore.getState().reset();
  // O carrinho lê do aparelho: sem compra aberta, a linha não aparece
  useShoppingStore.getState().reset();
}

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Home />
    </SafeAreaProvider>,
  );

describe("Início", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseIsFocused.mockReturnValue(true);
    prepararStores();
  });

  /**
   * Escolha 4 do dono em 16/09 — "seis atalhos em grade" — e o "mais atalhos,
   * aproveitando telas e funcionalidades que já existem" da mesma lista.
   *
   * <p>A regra de quem entra: só o que NÃO está a um toque na barra de abas e
   * não é bloco próprio da Home. Cartões já é o destino da pastilha de
   * crédito, Recorrências é o do bloco de compromissos, e Revisão tem bloco
   * próprio quando há algo a revisar — nenhum dos três vira atalho.
   */
  it("tem os seis atalhos, e nenhum deles repete um destino da tela", async () => {
    const { getAllByText, queryByText } = montar();

    // `getAllByText`: "Importar" também é o botão do estado vazio do extrato
    // na mesma tela — o atalho não é a única porta com esse nome
    await waitFor(() =>
      expect(getAllByText("Importar").length).toBeGreaterThan(0),
    );
    // Compras entrou no lugar de Relatórios: é o que o dono usa no mercado,
    // e Relatórios continua a um toque no Perfil
    ["Análise", "Compras", "Previsão", "Categorias", "Desejos"].forEach(
      (rotulo) => expect(getAllByText(rotulo).length).toBeGreaterThan(0),
    );

    // O que NÃO pode estar entre os atalhos, porque já é destino na tela
    expect(queryByText("Cartões")).toBeNull();
    expect(queryByText("Recorrências")).toBeNull();
    expect(queryByText("Relatórios")).toBeNull();
  });

  it("o atalho Compras abre a lista de compras", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Compras")).toBeTruthy());
    fireEvent.press(getByText("Compras"));

    expect(mockNavigate).toHaveBeenCalledWith("Compras");
  });

  it("com uma compra aberta, a Home anuncia o total e abre a compra", async () => {
    useShoppingStore.setState({
      hasHydrated: true,
      trips: [
        {
          clientId: "t1",
          storeName: "Carrefour",
          status: "OPEN",
          budget: null,
          startedAt: new Date().toISOString(),
          closedAt: null,
          receiptTotal: null,
          notes: null,
          shareWithFamily: false,
          items: [
            { clientId: "a", name: "Arroz", quantity: 1, unitPrice: 100, promoNote: null, checked: true, photoRef: null, deleted: false, addedByName: null, clientUpdatedAt: "2026-09-21T10:00:00.000Z" },
            { clientId: "b", name: "Feijão", quantity: 2, unitPrice: 106.2, promoNote: null, checked: true, photoRef: null, deleted: false, addedByName: null, clientUpdatedAt: "2026-09-21T10:00:00.000Z" },
          ],
          clientUpdatedAt: "2026-09-21T10:00:00.000Z",
          dirty: true,
          mine: true,
          ownerName: null,
          transactionId: null,
        },
      ],
    } as never);

    const { getByText } = montar();

    const linha = await waitFor(() =>
      getByText(`Compra em andamento: ${formatBRL(312.4)} · 2 itens`),
    );
    fireEvent.press(linha);

    expect(mockNavigate).toHaveBeenCalledWith("Compra", { clientId: "t1" });
  });

  it("sem compra aberta, a linha não ocupa espaço", async () => {
    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText(/Olá/)).toBeTruthy());
    expect(queryByText(/Compra em andamento/)).toBeNull();
  });

  /**
   * O buraco que este teste fecha: a Home não tinha <b>um único link</b> para
   * a Previsão, sendo que é a tela que responde "o que vem". Estava alcançável
   * só pelo trilho lateral (desktop) — no telefone, por nada.
   */
  it("a Previsão passou a ser alcançável da Home", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("Previsão")).toBeTruthy());
    fireEvent.press(getByText("Previsão"));

    expect(mockNavigate).toHaveBeenCalledWith("Previsão");
  });

  it("o anúncio do pote abre uma vez, com a Home na frente e um ciclo para mostrar", async () => {
    usePreferencesStore.setState({ potAnnouncementSeen: false } as never);

    const { getByText } = montar();

    await waitFor(() => expect(getByText("Seu pote conta o mês")).toBeTruthy());
  });

  it("com a Home por baixo de outra tela, o anúncio do pote espera", async () => {
    // A aba fica montada enquanto a pessoa está em Relatórios; a folha é um
    // Modal e cobriria Relatórios. Foi visto na prova em navegador
    usePreferencesStore.setState({ potAnnouncementSeen: false } as never);
    mockUseIsFocused.mockReturnValue(false);

    const { queryByText, getByText } = montar();

    await waitFor(() => expect(getByText(/Olá/)).toBeTruthy());
    expect(queryByText("Seu pote conta o mês")).toBeNull();
  });

  it("abre com o mês respondido", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("pede a CONTAGEM da revisão, nunca a fila inteira", async () => {
    const fetchPendingCount = jest.fn().mockResolvedValue(undefined);
    const fetchQueue = jest.fn().mockResolvedValue(undefined);
    useReviewStore.setState({
      pendingCount: 0,
      fetchPendingCount,
      fetchQueue,
    } as never);

    montar();

    // A Home escreve "N esperando você" e não desenha nenhuma linha: buscar a
    // fila agrupada custava 92 KB e 2,1 s a cada abertura
    await waitFor(() => expect(fetchPendingCount).toHaveBeenCalled());
    expect(fetchQueue).not.toHaveBeenCalled();
  });

  it("com revisão pendente, o bloco convida a revisar", async () => {
    useReviewStore.setState({
      pendingCount: 253,
      fetchPendingCount: jest.fn().mockResolvedValue(undefined),
    } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText("253 transações esperando você")).toBeTruthy(),
    );
  });

  it("sem nada pendente, o bloco de revisão não ocupa espaço", async () => {
    const { queryByText } = montar();

    await waitFor(() => expect(queryByText(/esperando você/)).toBeNull());
  });

  it("busca o mês e as recorrências ao ganhar foco", async () => {
    const fetchHomeMonthly = jest.fn().mockResolvedValue(undefined);
    const fetchSeries = jest.fn().mockResolvedValue(undefined);
    useAnalyticsStore.setState({ fetchHomeMonthly } as never);
    useRecurrenceStore.setState({ fetchSeries } as never);

    montar();

    await waitFor(() => expect(fetchHomeMonthly).toHaveBeenCalled());
    expect(fetchSeries).toHaveBeenCalled();
  });

  it("com o olhinho fechado, o valor não aparece nem para o leitor de tela", async () => {
    usePreferencesStore.setState({ hideBalance: true } as never);

    const { queryByText } = montar();

    // Falar o número que a tela esconde seria furar a própria preferência
    await waitFor(() => expect(queryByText("R$ 5.423,68")).toBeNull());
  });

  it("busca o melhor dia de compra ao ganhar foco, best-effort como o resto", async () => {
    const fetchIncomePattern = jest.fn().mockResolvedValue(undefined);
    useWishStore.setState({ fetchIncomePattern } as never);

    montar();

    await waitFor(() => expect(fetchIncomePattern).toHaveBeenCalled());
  });

  /**
   * EC-237: a linha mora dentro do card "A vencer" — só desenha algo com
   * `upcoming.count > 0`, então o fixture da recorrência é o que faz o bloco
   * existir. A data fica sempre a 5 dias de "agora": o teste não pode
   * depender de que dia é hoje de verdade.
   */
  const RECORRENCIA_A_VENCER = () => {
    const emCincoDias = new Date();
    emCincoDias.setDate(emCincoDias.getDate() + 5);
    return [
      {
        id: "s1",
        merchantKey: "netflix",
        displayName: "Netflix",
        categoryId: null,
        flow: "EXPENSE",
        cadence: "MONTHLY",
        anchorDay: 20,
        dayTolerance: 2,
        amountType: "FIXED",
        expectedAmount: 55.9,
        occurrences: 6,
        firstSeenAt: "2026-03-20",
        lastSeenAt: "2026-08-20",
        active: true,
        dismissed: false,
        source: "DETECTED",
        startsAt: null,
        endsAt: null,
        nextDueDate: emCincoDias.toISOString().slice(0, 10),
      },
    ];
  };

  const PADRAO_READY = {
    status: "READY",
    message: null,
    today: "2026-09-15",
    sources: [],
    preference: null,
    inferred: null,
    advice: {
      cadence: "MONTHLY",
      cadenceOrigin: "MEASURED",
      paymentMode: "CASH",
      bestDay: "2026-10-03",
      bestDayWeekday: "SATURDAY",
      fundingSource: null,
      fundingDate: null,
      mustLastUntil: "2026-11-09",
      daysToCover: 37,
      card: null,
      weeklyDay: null,
      nextDates: [],
      confidence: "MEDIUM",
      explanation: { headline: "Melhor dia para as compras: sáb 03/10", lines: [] },
      basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" },
    },
  };

  it("com o padrão pronto, a linha do melhor dia aparece e leva à Previsão", async () => {
    useRecurrenceStore.setState({
      series: RECORRENCIA_A_VENCER(),
      fetchSeries: jest.fn().mockResolvedValue(undefined),
    } as never);
    useWishStore.setState({ incomePattern: PADRAO_READY } as never);

    const { getByText } = montar();

    await waitFor(() =>
      expect(getByText(/Melhor dia para as compras/)).toBeTruthy(),
    );
    fireEvent.press(getByText(/Melhor dia para as compras/));

    expect(mockNavigate).toHaveBeenCalledWith("Previsão");
  });

  it("sem o padrão pronto (ainda não READY), a linha não ocupa espaço mesmo com contas a vencer", async () => {
    useRecurrenceStore.setState({
      series: RECORRENCIA_A_VENCER(),
      fetchSeries: jest.fn().mockResolvedValue(undefined),
    } as never);
    useWishStore.setState({
      incomePattern: { ...PADRAO_READY, status: "INSUFFICIENT_HISTORY", advice: null },
    } as never);

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("Netflix")).toBeTruthy());
    expect(queryByText(/Melhor dia para as compras/)).toBeNull();
  });
});
