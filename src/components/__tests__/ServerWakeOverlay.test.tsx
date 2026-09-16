import React from "react";
import { render } from "@testing-library/react-native";
import type { ReactTestInstance } from "react-test-renderer";

import ServerWakeOverlay from "../ServerWakeOverlay";
import type { ConnectorAccount, MonthlyAnalytics } from "../../services/api";
import { useAccountsStore } from "../../store/accountsStore";
import { useAnalyticsStore } from "../../store/analyticsStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useServerStore } from "../../store/serverStore";
import { darkTheme } from "../../theme/colors";
import { formatMonthLabel } from "../../utils/cycleWindow";
import { formatBRL } from "../../utils/money";

// A cortina lê dos stores, nunca da API — e a API não pode nem ser tocada
// neste teste: é justamente ela que não responde no cenário
jest.mock("../../services/api", () => ({
  getAccounts: jest.fn(),
  getAccountInvoices: jest.fn(),
  getApiErrorStatus: jest.fn(),
  getAnalyticsMonths: jest.fn(),
  getMonthlyAnalytics: jest.fn(),
  getDebtOverview: jest.fn(),
}));

// Instantes construídos no fuso LOCAL, porque a legenda escreve hora local
const AGORA = new Date(2026, 8, 16, 9, 0).getTime();
const HORA = 60 * 60_000;
const DIA = 24 * HORA;
const ONTEM_A_NOITE = new Date(2026, 8, 15, 18, 32).toISOString();
const HOJE_CEDO = new Date(2026, 8, 16, 8, 10).toISOString();
const SETEMBRO = formatMonthLabel("2026-09");
const HIDDEN = "R$ •••••";

function conta(overrides: Partial<ConnectorAccount> = {}): ConnectorAccount {
  return {
    id: "acc-banco",
    name: "Inter ····2750",
    type: "BANK",
    institution: "Inter",
    statementClosingDay: null,
    statementDueDay: null,
    linked: true,
    reportedBalance: 1234.56,
    reportedBalanceAt: ONTEM_A_NOITE,
    creditLimit: null,
    creditLimitSharedWith: null,
    ...overrides,
  };
}

function mes(overrides: Partial<MonthlyAnalytics> = {}): MonthlyAnalytics {
  return {
    month: "2026-09",
    start: "2026-09-01",
    end: "2026-09-30",
    totalIncome: 5000,
    totalExpense: 3200,
    net: 1800,
    previous: {
      month: "2026-08",
      start: "2026-08-01",
      end: "2026-08-31",
      totalIncome: 0,
      totalExpense: 0,
      net: 0,
    },
    categories: [],
    pendingReviewCount: 0,
    ...overrides,
  };
}

const corDe = (elemento: ReactTestInstance): string | undefined => {
  const estilos = [elemento.props.style].flat(2) as ({ color?: string } | null)[];
  return estilos.find((estilo) => estilo?.color)?.color;
};

const acordando = () =>
  useServerStore.setState({ isWaking: true, waitedSeconds: 0 });

const comContas = (accounts: ConnectorAccount[], accountsAt: string) =>
  useAccountsStore.setState({ accounts, accountsAt });

const comMes = (homeData: MonthlyAnalytics, homeDataAt: string) =>
  useAnalyticsStore.setState({ homeData, homeDataAt });

/**
 * A cortina "Acordando o servidor" com o último saldo conhecido embaixo.
 *
 * Pedido do dono em 15/09/2026: a API hibernada leva minutos para responder e
 * até aqui esses minutos eram um relógio. O que se prova é que os números da
 * última visita aparecem com a data ao lado, que sem instantâneo não aparece
 * nada (nunca um zero), e que o "olhinho" da Home vale aqui também.
 */
describe("ServerWakeOverlay — o que eu sabia", () => {
  beforeEach(() => {
    jest.useFakeTimers({ now: AGORA });
    useServerStore.setState({ isWaking: false, waitedSeconds: 0 });
    useAccountsStore.setState({ accounts: [], accountsAt: null });
    useAnalyticsStore.setState({ homeData: null, homeDataAt: null });
    usePreferencesStore.setState({ hideBalance: false, theme: "dark" });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("com o servidor acordado, não existe", () => {
    comContas([conta()], ONTEM_A_NOITE);

    expect(render(<ServerWakeOverlay />).toJSON()).toBeNull();
  });

  it("acordando sem instantâneo: só a espera, nunca um zero", () => {
    acordando();

    const { getByText, queryByText } = render(<ServerWakeOverlay />);

    expect(getByText("Acordando o servidor")).toBeTruthy();
    expect(queryByText("Enquanto isso, o que eu sabia")).toBeNull();
    expect(queryByText(/R\$/)).toBeNull();
  });

  it("com saldo informado, mostra o que sabia — e de quando", () => {
    acordando();
    comContas([conta()], ONTEM_A_NOITE);
    comMes(mes(), HOJE_CEDO);

    const { getByText } = render(<ServerWakeOverlay />);

    expect(getByText("Enquanto isso, o que eu sabia")).toBeTruthy();
    expect(getByText("Em conta")).toBeTruthy();
    expect(getByText(formatBRL(1234.56))).toBeTruthy();
    expect(getByText(`Gastos em ${SETEMBRO}`)).toBeTruthy();
    expect(getByText(formatBRL(3200))).toBeTruthy();
    // Data e hora, não "há 14 h": o que saiu do disco pode ser de ontem à
    // noite, e ontem à noite é uma hora. E é a data do dado mais VELHO
    expect(
      getByText("de 15/09/2026 às 18:32, pode estar desatualizado"),
    ).toBeTruthy();
  });

  it("sem saldo informado, a manchete é o mês — com a frase certa para o sinal", () => {
    acordando();
    comMes(mes(), HOJE_CEDO);

    const sobrou = render(<ServerWakeOverlay />);
    expect(sobrou.getByText(`Sobrou em ${SETEMBRO}`)).toBeTruthy();
    expect(sobrou.getByText(formatBRL(1800))).toBeTruthy();
    expect(corDe(sobrou.getByText(formatBRL(1800)))).toBe(darkTheme.text.primary);
    sobrou.unmount();

    comMes(mes({ totalIncome: 2800, net: -400 }), HOJE_CEDO);

    const faltou = render(<ServerWakeOverlay />);
    expect(faltou.getByText(`Faltou em ${SETEMBRO}`)).toBeTruthy();
    // O vermelho da manchete da Home: o número não muda de cara entre a
    // cortina e a tela de trás
    expect(corDe(faltou.getByText(formatBRL(-400)))).toBe(darkTheme.chart.down);
  });

  it("o 'olhinho' da Home vale aqui: valores escondidos ficam escondidos", () => {
    acordando();
    comContas([conta()], ONTEM_A_NOITE);
    comMes(mes(), HOJE_CEDO);
    usePreferencesStore.setState({ hideBalance: true });

    const { getAllByText, queryByText, getByLabelText } = render(
      <ServerWakeOverlay />,
    );

    expect(getAllByText(HIDDEN)).toHaveLength(2);
    expect(queryByText(formatBRL(1234.56))).toBeNull();
    expect(queryByText(formatBRL(3200))).toBeNull();
    // O que a tela esconde, o leitor de tela também não fala
    expect(getByLabelText("Em conta: valor oculto")).toBeTruthy();
    expect(getByLabelText(`Gastos em ${SETEMBRO}: valor oculto`)).toBeTruthy();
  });

  it("quem ouve recebe rótulo e valor por extenso", () => {
    acordando();
    comContas([conta()], ONTEM_A_NOITE);

    const { getByLabelText } = render(<ServerWakeOverlay />);

    expect(getByLabelText(`Em conta: ${formatBRL(1234.56)}`)).toBeTruthy();
  });

  it("legenda recente sai discreta; passado um dia, ganha cor de aviso", () => {
    acordando();
    comContas([conta()], ONTEM_A_NOITE);

    const recente = render(<ServerWakeOverlay />);
    expect(corDe(recente.getByText(/pode estar desatualizado/))).toBe(
      darkTheme.text.tertiary,
    );
    recente.unmount();

    // Quem bate o olho no número não lê a linha de baixo: um saldo de
    // anteontem com cara de hoje é pior do que saldo nenhum
    const anteontem = new Date(AGORA - 2 * DIA).toISOString();
    comContas([conta()], anteontem);

    const velho = render(<ServerWakeOverlay />);
    expect(corDe(velho.getByText(/pode estar desatualizado/))).toBe(
      darkTheme.semantic.warning,
    );
  });

  it("ciclo parado guardado não vira bloco: zero não é 'o que eu sabia'", () => {
    acordando();
    comMes(mes({ totalIncome: 0, totalExpense: 0, net: 0 }), HOJE_CEDO);

    const { queryByText } = render(<ServerWakeOverlay />);

    expect(queryByText("Enquanto isso, o que eu sabia")).toBeNull();
  });
});
