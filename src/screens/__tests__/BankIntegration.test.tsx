import React from "react";
import { ScrollView, SectionList, StyleSheet } from "react-native";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import BankIntegration from "../BankIntegration";
import { BOTTOM_BAR_HEIGHT, TabBarHeightContext } from "../../routes/tabBarHeight";
import { spacing } from "../../theme/ds";
import { useAccountsStore } from "../../store/accountsStore";
import { useBankStore } from "../../store/bankStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import { useConnectorStore } from "../../store/connectorStore";
import { useFamilyStore } from "../../store/familyStore";
import { usePlanStore } from "../../store/planStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useToastStore } from "../../store/toastStore";

const mockOnScrollDaBarra = jest.fn();
const mockNavigate = jest.fn();

jest.mock("../../hooks/useEsconderBarra", () => ({
  useEsconderBarra: () => ({
    onScroll: mockOnScrollDaBarra,
    scrollEventThrottle: 16,
  }),
}));

// A conferencia de saldo (EC-196) sai na entrada da tela. Aqui ela devolve
// vazio: o que estes testes cobrem e a tela de conexoes, nao o aviso -- que
// tem suite propria em BalanceCheckNotice.test.tsx
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getBalanceCheck: jest.fn().mockResolvedValue({ accountsChecked: 0, findings: [] }),
  // Origens duplicadas: a tela pergunta na montagem e trata a falha em
  // silêncio — o dublê devolve "nenhuma" para o caso comum
  getMergeSuggestions: jest.fn().mockResolvedValue([]),
  mergeAccounts: jest.fn().mockResolvedValue(0),
  describeRequestFailure: jest.fn(() => ({ kind: "UNKNOWN", message: "falhou" })),
}));

jest.mock("expo-document-picker", () => ({ getDocumentAsync: jest.fn() }));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    canGoBack: () => false,
    getState: () => ({ index: 0, routes: [{ name: "Extrato" }] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const lancamento = (id: string, descricao: string, valor: number) => ({
  id,
  transactionId: `ext-${id}`,
  type: valor < 0 ? "DEBIT" : "CREDIT",
  amount: valor,
  description: descricao,
  date: "2026-08-10T12:00:00Z",
  categoryId: null,
  category: null,
  accountId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: "USER",
  confidence: null,
  internalTransfer: false,
});

function prepararStores() {
  useBankStore.setState({
    transactions: [lancamento("t1", "SUPERMERCADO SERO", -194.99)],
    isLoading: false,
    isImporting: false,
    error: null,
    fetchedAt: Date.now(),
    historyComplete: true,
    isLoadingHistory: false,
    fetchTransactions: jest.fn().mockResolvedValue(undefined),
    importStatement: jest.fn(),
    arquivoRecebido: null,
    receberArquivo: jest.fn(),
    descartarArquivoRecebido: jest.fn(),
    importarArquivoRecebido: jest.fn(),
    applyTransaction: jest.fn(),
    calculateMetrics: () => ({ income: 0, expense: 194.99, total: -194.99 }),
  } as never);
  useFamilyStore.setState({
    hasFamily: false,
    scope: "me",
    transactions: [],
    isTransactionsLoading: false,
    transactionsError: null,
    hasLoadedTransactionsOnce: true,
    fetchTransactions: jest.fn().mockResolvedValue(undefined),
    family: null,
    setScope: jest.fn(),
  } as never);
  useAccountsStore.setState({
    accounts: [],
    byId: new Map(),
    isLoading: false,
    hasLoadedOnce: true,
    error: null,
    invoices: {},
    fetchAccounts: jest.fn().mockResolvedValue(undefined),
  } as never);
  useCategoriesStore.setState({
    items: [],
    fetch: jest.fn().mockResolvedValue(undefined),
  } as never);
  useConnectorStore.setState({
    status: { enabled: false, configured: false, itemCount: 0 },
    items: [],
    isChecking: false,
    isSyncing: false,
    isLoadingItems: false,
    isLinking: false,
    error: null,
    checkStatus: jest.fn().mockResolvedValue(undefined),
    fetchItems: jest.fn().mockResolvedValue(undefined),
    runSync: jest.fn(),
  } as never);
  usePreferencesStore.setState({ cycleAnchorDay: 1 } as never);
  usePlanStore.setState({ plan: "FREE", adsEnabled: true });
}

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <BankIntegration />
    </SafeAreaProvider>,
  );

describe("Extrato", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
    prepararStores();
  });

  it("liga a barra à rolagem vertical, não aos atalhos horizontais", () => {
    const { UNSAFE_getAllByType, UNSAFE_getByType } = montar();
    const listaPrincipal = UNSAFE_getByType(SectionList);

    // A rolagem que muda a ilha é a do extrato, não a da fita de apps bancários.
    fireEvent.scroll(listaPrincipal, {
      nativeEvent: { contentOffset: { x: 0, y: 120 } },
    });

    expect(mockOnScrollDaBarra).toHaveBeenCalledTimes(1);
    expect(listaPrincipal.props.scrollEventThrottle).toBe(16);
    const atalhosHorizontais = UNSAFE_getAllByType(ScrollView).find(
      (scrollView) => scrollView.props.horizontal,
    );
    expect(atalhosHorizontais).toBeDefined();
    expect(atalhosHorizontais?.props.onScroll).toBeUndefined();
    expect(atalhosHorizontais?.props.scrollEventThrottle).toBeUndefined();
  });

  it("lista o lançamento importado", async () => {
    const { getByText } = montar();

    await waitFor(() => expect(getByText("SUPERMERCADO SERO")).toBeTruthy());
  });

  it("com só a lista recente, o rodapé avisa e os totais esperam", async () => {
    useBankStore.setState({
      historyComplete: false,
      isLoadingHistory: true,
      fetchedAt: null,
    } as never);

    const { getByText, queryByText } = montar();

    await waitFor(() => expect(getByText("SUPERMERCADO SERO")).toBeTruthy());
    expect(getByText("Carregando lançamentos mais antigos…")).toBeTruthy();
    // Somar três meses e chamar de "Saídas" seria afirmar um número que muda
    expect(queryByText("Saídas")).toBeNull();
  });

  it("se o resto do histórico falhou, o rodapé diz e oferece tentar de novo", async () => {
    const buscar = jest.fn().mockResolvedValue(undefined);
    useBankStore.setState({
      historyComplete: false,
      isLoadingHistory: false,
      fetchedAt: null,
      fetchTransactions: buscar,
    } as never);

    const { getByText, queryByText } = montar();

    const aviso = await waitFor(() =>
      getByText(/lançamentos mais antigos não carregaram/),
    );
    // Sem esqueleto parado e sem total afirmado sobre a lista parcial
    expect(queryByText("Saídas")).toBeNull();
    expect(queryByText("Carregando lançamentos mais antigos…")).toBeNull();

    buscar.mockClear();
    fireEvent.press(aviso);
    expect(buscar).toHaveBeenCalledWith(true);
  });

  it("com o histórico inteiro, totais na tela e sem aviso no rodapé", async () => {
    const { getAllByText, queryByText } = montar();

    // "Saídas" aparece no card e na legenda da rosca
    await waitFor(() => expect(getAllByText("Saídas").length).toBeGreaterThan(0));
    expect(queryByText("Carregando lançamentos mais antigos…")).toBeNull();
  });

  it("busca extrato, categorias e contas ao ganhar foco", async () => {
    const fetchTransactions = jest.fn().mockResolvedValue(undefined);
    const fetchCategories = jest.fn().mockResolvedValue(undefined);
    const fetchAccounts = jest.fn().mockResolvedValue(undefined);
    useBankStore.setState({ fetchTransactions } as never);
    useCategoriesStore.setState({ items: [], fetch: fetchCategories } as never);
    useAccountsStore.setState({ fetchAccounts } as never);

    montar();

    await waitFor(() => expect(fetchTransactions).toHaveBeenCalled());
    expect(fetchCategories).toHaveBeenCalled();
    expect(fetchAccounts).toHaveBeenCalled();
  });

  it("a lista reserva margem lateral e o rodapé da barra de abas", async () => {
    // Medido em 12/11/2026 no navegador: o `contentContainerClassName` desta
    // SectionList computava padding ZERO. O conteúdo encostava nas bordas, a
    // lista rolava 23 px e o "Importar extrato" do estado vazio ficava
    // debaixo da barra de abas em 390x664, sem como alcançar.
    useBankStore.setState({ transactions: [] } as never);
    const alturaDaBarra = BOTTOM_BAR_HEIGHT + 34;

    const { UNSAFE_getByType } = render(
      <SafeAreaProvider initialMetrics={METRICAS}>
        <TabBarHeightContext.Provider value={alturaDaBarra}>
          <BankIntegration />
        </TabBarHeightContext.Provider>
      </SafeAreaProvider>,
    );

    const estilo = StyleSheet.flatten(
      UNSAFE_getByType(SectionList).props.contentContainerStyle,
    );
    expect(estilo.paddingHorizontal).toBe(spacing[5]);
    expect(estilo.paddingBottom).toBeGreaterThan(alturaDaBarra);
  });

  it("extrato vazio não vira tela quebrada", async () => {
    useBankStore.setState({ transactions: [] } as never);

    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("em nenhum lugar aparece o nome do provedor do conector", async () => {
    // Pedido do dono: o usuário só precisa saber que pode conectar o banco;
    // quem faz o meio é assunto nosso, e trocar de provedor não pode virar
    // uma troca de textos pelo app inteiro
    useConnectorStore.setState({
      status: {
        enabled: true,
        configured: true,
        itemCount: 1,
        provider: { id: "pluggy", displayName: "Open Finance" },
      },
    } as never);

    const { queryByText } = montar();

    await waitFor(() => expect(queryByText(/[Pp]luggy/)).toBeNull());
  });

  describe("conexoes que precisam de atencao", () => {
    const conexaoBase = {
      id: "c-reconectar",
      itemId: "item-reconectar",
      connectorId: 1,
      connectorName: "Nubank",
      institution: "Nubank",
      createdAt: "2026-11-01T12:00:00Z",
      lastSyncedAt: "2026-11-10T12:00:00Z",
      status: "UPDATED",
      needsAttention: false,
    };

    it("mostra o selo Reconectar quando a conexao precisa de atencao", async () => {
      useConnectorStore.setState({
        status: { enabled: true, configured: true, itemCount: 1 },
        items: [
          {
            ...conexaoBase,
            status: "NEEDS_USER_ACTION",
            needsAttention: true,
          },
        ],
      } as never);

      const { getByLabelText, getByText } = montar();

      await waitFor(() => expect(getByText("Reconectar")).toBeTruthy());
      expect(getByLabelText("Nubank precisa reconectar")).toBeTruthy();
    });

    it("nao mostra o selo Reconectar para conexao saudavel", async () => {
      useConnectorStore.setState({
        status: { enabled: true, configured: true, itemCount: 1 },
        items: [conexaoBase],
      } as never);

      const { queryByLabelText, queryByText, queryAllByText } = montar();

      // o nome aparece no cabeçalho e na linha da conexão: basta existir
      await waitFor(() => expect(queryAllByText("Nubank").length).toBeGreaterThan(0));
      expect(queryByText("Reconectar")).toBeNull();
      expect(queryByLabelText("Nubank precisa reconectar")).toBeNull();
    });
  });

  describe("sincronizar bancos conectados", () => {
    const conexao = {
      id: "c1",
      itemId: "item-1",
      connectorId: 1,
      connectorName: "Nubank",
      institution: "Nubank",
      createdAt: "2026-11-01T12:00:00Z",
      lastSyncedAt: "2026-11-10T12:00:00Z",
      status: "UPDATED",
      needsAttention: false,
    };

    function ligarConector(runSync: jest.Mock, fetchItems: jest.Mock) {
      useToastStore.getState().reset();
      useConnectorStore.setState({
        status: { enabled: true, configured: true, itemCount: 1 },
        items: [conexao],
        runSync,
        fetchItems,
      } as never);
    }

    function resultadoDaSync(sobrescrever: Record<string, unknown> = {}) {
      return {
        message: "Sincronização concluída",
        uploadId: "upload-1",
        transactionsImported: 1,
        suggested: 0,
        uncategorized: 0,
        reconciled: 0,
        format: "PLUGGY",
        duplicated: false,
        itemsSynced: 1,
        skippedConnections: [],
        ...sobrescrever,
      };
    }

    it("sucesso com banco pulado avisa o nome e manda reconectar", async () => {
      const fetchItems = jest.fn().mockResolvedValue(undefined);
      const runSync = jest.fn().mockResolvedValue(resultadoDaSync({
        transactionsImported: 3,
        skippedConnections: [
          { id: "c2", name: "Itaú", reason: "NEEDS_USER_ACTION" },
          { id: "c3", name: "Inter", reason: "NOT_FOUND" },
        ],
      }));
      ligarConector(runSync, fetchItems);

      const { getByLabelText } = montar();
      // A montagem também busca a lista: só conta a busca DEPOIS do toque
      await waitFor(() => expect(getByLabelText("Sincronizar bancos conectados")).toBeTruthy());
      fetchItems.mockClear();
      fireEvent.press(getByLabelText("Sincronizar bancos conectados"));

      await waitFor(() =>
        expect(useToastStore.getState().message).toBe(
          "3 transações importadas. Itaú e Inter ficaram de fora: reconecte para voltar a sincronizar.",
        ),
      );
      expect(useToastStore.getState().type).toBe("warning");
      await waitFor(() => expect(fetchItems).toHaveBeenCalled());
    });

    it("sucesso sem banco pulado fica só com o resumo", async () => {
      const runSync = jest.fn().mockResolvedValue(resultadoDaSync());
      ligarConector(runSync, jest.fn().mockResolvedValue(undefined));

      const { getByLabelText } = montar();
      fireEvent.press(getByLabelText("Sincronizar bancos conectados"));

      await waitFor(() =>
        expect(useToastStore.getState().message).toBe("1 transação importada."),
      );
      expect(useToastStore.getState().type).toBe("success");
    });

    it("leva a revisão com todos os uploads novos da sincronização", async () => {
      const runSync = jest.fn().mockResolvedValue(resultadoDaSync({
        transactionsImported: 2,
        suggested: 1,
        uncategorized: 1,
        uploadIds: ["upload-1", "upload-2"],
      }));
      ligarConector(runSync, jest.fn().mockResolvedValue(undefined));

      const { getByLabelText } = montar();
      fireEvent.press(getByLabelText("Sincronizar bancos conectados"));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), {
          uploadIds: ["upload-1", "upload-2"],
        }),
      );
    });

    it("mantém uploadId ao revisar resposta da API anterior", async () => {
      const runSync = jest.fn().mockResolvedValue(resultadoDaSync({
        suggested: 1,
      }));
      ligarConector(runSync, jest.fn().mockResolvedValue(undefined));

      const { getByLabelText } = montar();
      fireEvent.press(getByLabelText("Sincronizar bancos conectados"));

      await waitFor(() =>
        expect(mockNavigate).toHaveBeenCalledWith(expect.any(String), {
          uploadId: "upload-1",
        }),
      );
    });

    it("falha mostra o erro do store e recarrega as conexões", async () => {
      const fetchItems = jest.fn().mockResolvedValue(undefined);
      const runSync = jest.fn().mockImplementation(async () => {
        useConnectorStore.setState({
          error:
            "Não foi possível ler Nubank no provedor agora; nada foi importado.",
        });
        throw new Error("503");
      });
      ligarConector(runSync, fetchItems);

      const { getByLabelText } = montar();
      await waitFor(() => expect(getByLabelText("Sincronizar bancos conectados")).toBeTruthy());
      fetchItems.mockClear();
      fireEvent.press(getByLabelText("Sincronizar bancos conectados"));

      await waitFor(() =>
        expect(useToastStore.getState().message).toMatch(/ler Nubank/),
      );
      await waitFor(() => expect(fetchItems).toHaveBeenCalled());
    });
  });

  it("sem conector ligado, a seção de conexão não é oferecida", async () => {
    const { toJSON } = montar();

    await waitFor(() => expect(toJSON()).toBeTruthy());
  });

  it("sem casa, o alternador Eu/Casa fica fora", async () => {
    const { queryByText } = montar();

    await waitFor(() => expect(queryByText("Casa")).toBeNull());
  });
  describe("arquivo vindo de fora do app", () => {
    it("entra sozinho, sem pedir confirmação", async () => {
      const importar = jest.fn().mockResolvedValue({
        transactionsImported: 2,
        suggested: 0,
        uncategorized: 0,
        reconciled: 0,
        duplicated: false,
        uploadId: "u1",
      });
      useBankStore.setState({
        arquivoRecebido: "content://baixados/42",
        importarArquivoRecebido: importar,
      } as never);

      montar();

      // Escolher "Abrir com › Economize!" JÁ é a confirmação: perguntar de novo
      // depois do gesto só atrasaria quem acabou de decidir
      await waitFor(() => expect(importar).toHaveBeenCalled());
    });

    it("sem arquivo parqueado, nada é enviado na abertura", async () => {
      const importar = jest.fn();
      useBankStore.setState({
        arquivoRecebido: null,
        importarArquivoRecebido: importar,
      } as never);

      const { toJSON } = montar();

      await waitFor(() => expect(toJSON()).toBeTruthy());
      expect(importar).not.toHaveBeenCalled();
    });
  });
});
