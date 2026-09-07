import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";
import {
  SafeAreaProvider,
  type Metrics,
} from "react-native-safe-area-context";

import Investments from "../Investments";
import type {
  InvestmentPosition,
  InvestmentProfile,
  InvestmentSummary,
} from "../../services/api";
import { useConnectorStore } from "../../store/connectorStore";
import { EMPTY_SUMMARY, useInvestmentStore } from "../../store/investmentStore";
import { useToastStore } from "../../store/toastStore";

// O prefixo "mock" é exigência do Jest: só nomes assim podem ser lidos de
// dentro da fábrica do jest.mock, que sobe para o topo do arquivo
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    canGoBack: () => false,
    getState: () => ({ type: "tab", index: 0, routes: [] }),
  }),
  useRoute: () => ({ params: {} }),
  useIsFocused: () => true,
  useFocusEffect: (efeito: () => void | (() => void)) => {
    const React = require("react");
    React.useEffect(efeito, []);
  },
}));

// A camada de rede é o limite: a tela é montada de verdade sobre o store de
// verdade, e só as funções da API são dublês
jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getInvestmentSummary: jest.fn(),
  getInvestmentPositions: jest.fn(),
  getInvestmentMovements: jest.fn(),
  getInvestmentProfile: jest.fn(),
  getMacroIndicators: jest.fn(),
  getTreasuryBonds: jest.fn(),
  getForeignQuote: jest.fn(),
  getNewsByTopics: jest.fn(),
  syncInvestments: jest.fn(),
  createInvestmentPosition: jest.fn(),
  updateInvestmentPosition: jest.fn(),
  deleteInvestmentPosition: jest.fn(),
  addInvestmentInterest: jest.fn(),
  removeInvestmentInterest: jest.fn(),
  getApiErrorStatus: (error: any) => error?.response?.status ?? null,
  getApiErrorDetail: () => null,
}));

const api = jest.requireMock("../../services/api");

const METRICAS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

const montar = () =>
  render(
    <SafeAreaProvider initialMetrics={METRICAS}>
      <Investments />
    </SafeAreaProvider>,
  );

const problem = (status: number) => ({ response: { status, data: {} } });

const PERFIL: InvestmentProfile = {
  indexers: ["CDI", "SELIC", "USD"],
  watch: [
    { kind: "RATE", code: "CDI" },
    { kind: "RATE", code: "SELIC" },
    { kind: "CURRENCY", code: "USD" },
    { kind: "TICKER", code: "VT", market: "US" },
  ],
  topics: ["selic-cdi", "tesouro", "etf-exterior"],
  derivedFrom: { positions: 2, movements: 3, manualInterests: 0 },
  isDefault: false,
};

const RESUMO: InvestmentSummary = {
  ...EMPTY_SUMMARY,
  totalInvested: 15000,
  currentValue: 16850.5,
  profit: 1850.5,
  profitPercent: 12.34,
  positionsCount: 2,
  sources: ["CONNECTOR", "MANUAL"],
  updatedAt: new Date().toISOString(),
  needsQuote: ["VT"],
};

const CDB: InvestmentPosition = {
  id: "pos-cdb",
  source: "CONNECTOR",
  institution: "Inter",
  accountId: "acc-1",
  name: "CDB Inter 110% CDI",
  code: null,
  type: "FIXED_INCOME",
  subtype: "CDB",
  indexer: "CDI",
  rate: 110,
  currency: "BRL",
  quantity: null,
  unitPrice: null,
  investedAmount: 10000,
  currentValue: 10450.5,
  maturityDate: "2027-03-15",
  positionDate: "2026-09-05",
  updatedAt: null,
  stale: false,
};

const VT: InvestmentPosition = {
  ...CDB,
  id: "pos-vt",
  source: "MANUAL",
  institution: "Avenue",
  accountId: null,
  name: "Vanguard Total World",
  code: "VT",
  type: "ETF",
  subtype: "ETF_US",
  indexer: null,
  rate: null,
  currency: "USD",
  quantity: 10,
  unitPrice: 100,
  investedAmount: 5000,
  currentValue: null,
  maturityDate: null,
  stale: true,
};

/** Servidor novo, usuário com carteira: o caminho feliz completo. */
function comDados() {
  api.getInvestmentSummary.mockResolvedValue(RESUMO);
  api.getInvestmentPositions.mockResolvedValue([CDB, VT]);
  api.getInvestmentMovements.mockResolvedValue({
    items: [
      {
        transactionId: "tx-1",
        date: "2026-08-10",
        kind: "APPLY",
        amount: 2000,
        description: "APLICACAO CDB",
        institution: "Inter",
        accountId: "acc-1",
      },
      {
        transactionId: "tx-2",
        date: "2026-08-31",
        kind: "YIELD",
        amount: 35.2,
        description: "RENDIMENTO",
        institution: "Inter",
        accountId: "acc-1",
      },
    ],
    totals: { applied: 2000, redeemed: 0, yield: 35.2 },
    netInvested: 2000,
  });
  api.getInvestmentProfile.mockResolvedValue(PERFIL);
  api.getMacroIndicators.mockResolvedValue([
    { code: "CDI", name: "CDI", value: 14.9, unit: "% a.a.", referenceDate: "2026-09-05", source: "BCB", asOf: "2026-09-05T18:00:00Z", stale: false },
    { code: "SELIC", name: "Selic", value: 15, unit: "% a.a.", referenceDate: "2026-09-05", source: "BCB", asOf: "2026-09-05T18:00:00Z", stale: false },
    { code: "USD_PTAX", name: "Dólar PTAX", value: 5.41, unit: "BRL", referenceDate: "2026-09-05", source: "BCB", asOf: "2026-09-05T18:00:00Z", stale: false },
  ]);
  api.getTreasuryBonds.mockResolvedValue([
    { name: "Tesouro Selic 2029", indexer: "SELIC", maturity: "2029-03-01", annualRateBuy: 0.1, annualRateSell: 0.12, unitPriceBuy: 15000, unitPriceSell: 14990, minInvestment: 150, asOf: "2026-09-05T15:00:00Z", source: "Tesouro Direto" },
    { name: "Tesouro IPCA+ 2035", indexer: "IPCA", maturity: "2035-05-15", annualRateBuy: 6.2, annualRateSell: 6.3, unitPriceBuy: 3000, unitPriceSell: 2990, minInvestment: 30, asOf: "2026-09-05T15:00:00Z", source: "Tesouro Direto" },
  ]);
  api.getForeignQuote.mockResolvedValue({
    symbol: "VT",
    market: "US",
    price: 118.32,
    currency: "USD",
    priceBrl: 640,
    change: 1.1,
    changePercent: 0.94,
    date: "2026-09-05",
    source: "provider",
    asOf: "2026-09-05T21:00:00Z",
    stale: false,
  });
  api.getNewsByTopics.mockResolvedValue({
    status: "ok",
    totalResults: 1,
    articles: [
      {
        source: { id: null, name: "Valor" },
        author: null,
        title: "Copom mantém a Selic em 15%",
        description: null,
        url: "https://exemplo/selic",
        urlToImage: null,
        publishedAt: "2026-09-05T12:00:00Z",
        content: null,
        topics: ["selic-cdi"],
      },
    ],
    updatedAt: null,
  });
}

/** Servidor novo, usuário sem nada: o convite para começar. */
function semInvestimentos() {
  comDados();
  api.getInvestmentSummary.mockResolvedValue({ ...EMPTY_SUMMARY, sources: [] });
  api.getInvestmentPositions.mockResolvedValue([]);
  api.getInvestmentMovements.mockResolvedValue({
    items: [],
    totals: { applied: 0, redeemed: 0, yield: 0 },
    netInvested: 0,
  });
  api.getInvestmentProfile.mockResolvedValue({
    ...PERFIL,
    indexers: [],
    watch: [{ kind: "RATE", code: "CDI" }, { kind: "RATE", code: "SELIC" }],
    topics: ["selic-cdi"],
    isDefault: true,
  });
}

/**
 * A aba Investimentos.
 *
 * <p>O que ela precisa acertar acima de tudo é a INDEPENDÊNCIA dos blocos: o
 * radar caindo não pode apagar o resumo, e o servidor uma versão atrás não
 * pode virar tela vermelha. E a personalização: o mesmo CDI é explicado pelo
 * CDB de quem tem CDB.
 */
describe("Investments", () => {
  let showToastSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    useInvestmentStore.getState().reset();
    useConnectorStore.getState().reset();
    showToastSpy = jest
      .spyOn(useToastStore.getState(), "showToast")
      .mockImplementation(() => {});
  });

  afterEach(() => showToastSpy.mockRestore());

  it("sem investimentos, convida a conectar o banco ou cadastrar à mão", async () => {
    semInvestimentos();

    const { getByText, getByLabelText } = montar();

    await waitFor(() =>
      expect(getByText("Ainda não encontramos investimentos.")).toBeTruthy(),
    );
    expect(getByText("Conecte seu banco ou cadastre à mão.")).toBeTruthy();
    expect(getByLabelText("Cadastrar à mão")).toBeTruthy();

    fireEvent.press(getByLabelText("Conectar banco"));
    // Conectar é no Extrato, a aba irmã — não uma tela nova
    expect(mockNavigate).toHaveBeenCalledWith("Extrato");

    // O perfil padrão ainda desenha os indicadores: personalizar começa antes
    // da primeira posição
    expect(getByText("Seus indicadores")).toBeTruthy();
    expect(getByText("CDI hoje")).toBeTruthy();
  });

  it("servidor antigo (404 em tudo) vira aviso honesto, sem botão e sem erro vermelho", async () => {
    Object.values(api)
      .filter((fn): fn is jest.Mock => typeof fn === "function" && "mockRejectedValue" in fn)
      .forEach((fn) => fn.mockRejectedValue(problem(404)));

    const { getByText, queryByLabelText, queryByText } = montar();

    await waitFor(() =>
      expect(getByText("Investimentos ainda não disponíveis")).toBeTruthy(),
    );
    // Cadastrar também daria 404: o convite sai junto
    expect(queryByLabelText("Cadastrar à mão")).toBeNull();
    expect(queryByLabelText("Conectar banco")).toBeNull();
    expect(queryByText("Tentar de novo")).toBeNull();
  });

  it("com dados, desenha resumo, indicadores, Tesouro relevante, posições, movimentações e radar", async () => {
    comDados();

    const { getByText, getAllByText, queryByText, getByLabelText } = montar();

    // Resumo: valor atual (por extenso para quem ouve) e as fontes
    await waitFor(() => expect(getByText(/16\.850,50/)).toBeTruthy());
    expect(getByText("Open Finance")).toBeTruthy();
    expect(getAllByText("Manual").length).toBeGreaterThan(0);

    // Seus indicadores: o perfil manda, o macro dá o número
    expect(getByText("CDI hoje")).toBeTruthy();
    expect(getByText("14,90% a.a.")).toBeTruthy();
    expect(getByText("Dólar")).toBeTruthy();
    expect(getByText("VT · Vanguard Total World")).toBeTruthy();
    await waitFor(() => expect(getByText("US$ 118,32")).toBeTruthy());

    // Tesouro: só o indexador do perfil (Selic); o IPCA+ entra com "Ver todos"
    expect(getByText("Tesouro Selic 2029")).toBeTruthy();
    expect(queryByText("Tesouro IPCA+ 2035")).toBeNull();
    fireEvent.press(getByLabelText("Ver todos os títulos"));
    expect(getByText("Tesouro IPCA+ 2035")).toBeTruthy();

    // Posições agrupadas; a manual em dólar ganha valor pela cotação
    // (10 × R$ 640) e o selo de desatualizada
    expect(getByText("Renda fixa")).toBeTruthy();
    expect(getByText("ETFs")).toBeTruthy();
    expect(getByText("CDB Inter 110% CDI")).toBeTruthy();
    await waitFor(() => expect(getByText(/6\.400,00/)).toBeTruthy());
    expect(getByText("desatualizada")).toBeTruthy();
    expect(getByLabelText("Editar Vanguard Total World")).toBeTruthy();
    expect(getByLabelText("Excluir Vanguard Total World")).toBeTruthy();

    // Movimentações e radar
    expect(getByText("Movimentações")).toBeTruthy();
    expect(getByText("Aplicação")).toBeTruthy();
    expect(getByText("Rendimento")).toBeTruthy();
    expect(getByText("Copom mantém a Selic em 15%")).toBeTruthy();
    expect(getByLabelText("Ver mais em Notícias")).toBeTruthy();
    expect(api.getNewsByTopics).toHaveBeenCalledWith(PERFIL.topics, 5);
  });

  it("tocar num indicador explica por que ele importa PARA ESTE usuário", async () => {
    comDados();

    const { getByText, findByText, getByLabelText } = montar();
    await waitFor(() => expect(getByText("CDI hoje")).toBeTruthy());

    fireEvent.press(getByLabelText(/^CDI hoje:/));

    // Quem tem CDB ouve falar do CDB, não de um glossário
    expect(
      await findByText(
        "Seu CDB rende um percentual do CDI: quando ele cai, seu rendimento cai junto.",
      ),
    ).toBeTruthy();
  });

  it("um bloco que falha mostra 'tentar de novo' no lugar dele — e o resto fica", async () => {
    comDados();
    api.getInvestmentPositions.mockRejectedValue(new Error("offline"));

    const { getByText, getByLabelText } = montar();

    await waitFor(() =>
      expect(getByText("Não foi possível carregar suas posições.")).toBeTruthy(),
    );
    // O resumo e os indicadores chegaram e continuam na tela
    expect(getByText(/16\.850,50/)).toBeTruthy();
    expect(getByText("CDI hoje")).toBeTruthy();

    api.getInvestmentPositions.mockResolvedValue([CDB]);
    fireEvent.press(getByLabelText("Tentar de novo"));
    await waitFor(() => expect(getByText("CDB Inter 110% CDI")).toBeTruthy());
  });

  it("com o conector ligado, sincronizar chama a API e conta o resultado em toast", async () => {
    comDados();
    useConnectorStore.setState({
      status: { enabled: true, configured: true, itemCount: 1 },
    });
    api.syncInvestments.mockResolvedValue({
      synced: true,
      created: 2,
      updated: 1,
      itemsRead: 3,
      skippedItems: 0,
    });

    const { getByLabelText } = montar();
    await waitFor(() => expect(getByLabelText("Sincronizar investimentos")).toBeTruthy());

    fireEvent.press(getByLabelText("Sincronizar investimentos"));

    await waitFor(() => expect(api.syncInvestments).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(showToastSpy).toHaveBeenCalledWith(
        "Investimentos sincronizados: 2 novas, 1 atualizada.",
        "success",
      ),
    );
  });

  it("com o conector desligado, o botão de sincronizar não existe", async () => {
    comDados();

    const { getByText, queryByLabelText } = montar();
    await waitFor(() => expect(getByText(/16\.850,50/)).toBeTruthy());

    // Quem não configurou o conector não deve nem saber que ele existe
    expect(queryByLabelText("Sincronizar investimentos")).toBeNull();
    expect(queryByLabelText("Cadastrar à mão")).toBeTruthy();
  });

  it("conector desligado no servidor (503) vira toast específico", async () => {
    comDados();
    useConnectorStore.setState({
      status: { enabled: true, configured: true, itemCount: 1 },
    });
    api.syncInvestments.mockRejectedValue(problem(503));

    const { getByLabelText } = montar();
    await waitFor(() => expect(getByLabelText("Sincronizar investimentos")).toBeTruthy());

    fireEvent.press(getByLabelText("Sincronizar investimentos"));

    await waitFor(() =>
      expect(showToastSpy).toHaveBeenCalledWith(
        "O conector do banco está desligado neste servidor.",
        "error",
      ),
    );
  });

  it("editar uma posição manual abre a folha de edição", async () => {
    comDados();

    const { getByLabelText, findByText } = montar();
    await waitFor(() => expect(getByLabelText("Editar Vanguard Total World")).toBeTruthy());

    fireEvent.press(getByLabelText("Editar Vanguard Total World"));

    expect(await findByText("Editar posição")).toBeTruthy();
  });
});
