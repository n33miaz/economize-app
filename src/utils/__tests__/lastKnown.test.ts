import type { ConnectorAccount, MonthlyAnalytics } from "../../services/api";
import { formatMonthLabel, formatWindowLabel } from "../cycleWindow";
import { lastKnownSnapshot } from "../lastKnown";

// Dois instantes, com as contas lidas ANTES do mês: é a ordem que testa a
// regra "a legenda carimba o pior caso"
const CONTAS_EM = "2026-09-15T21:32:00.000Z";
const MES_EM = "2026-09-16T08:10:00.000Z";

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
    reportedBalanceAt: CONTAS_EM,
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

const NADA = {
  accounts: [] as ConnectorAccount[],
  accountsAt: null,
  homeData: null,
  homeDataAt: null,
};

const SETEMBRO = formatMonthLabel("2026-09");

/**
 * O que a cortina do servidor pode afirmar do que ficou guardado.
 *
 * A regra que se prova aqui é a de nunca mostrar um zero no lugar de "não
 * sei": dado sem data não entra, ciclo parado não entra, e sem nada que entre
 * o resultado é `null` — a tela não desenha o bloco.
 */
describe("O último saldo conhecido", () => {
  it("sem nada guardado, não há bloco", () => {
    expect(lastKnownSnapshot(NADA)).toBeNull();
  });

  it("conta sem data não entra: velho só aparece com data ao lado", () => {
    expect(
      lastKnownSnapshot({ ...NADA, accounts: [conta()], accountsAt: null }),
    ).toBeNull();
  });

  it("consolidação sem data também não entra", () => {
    expect(
      lastKnownSnapshot({ ...NADA, homeData: mes(), homeDataAt: null }),
    ).toBeNull();
  });

  it("ciclo parado não é 'o que eu sabia'", () => {
    // Consolidação zerada é ausência de movimento; desenhá-la seria mostrar
    // R$ 0,00 como informação
    const parado = mes({ totalIncome: 0, totalExpense: 0, net: 0 });

    expect(
      lastKnownSnapshot({ ...NADA, homeData: parado, homeDataAt: MES_EM }),
    ).toBeNull();
  });

  it("a manchete é o saldo informado quando existe, e os gastos vêm junto", () => {
    const resultado = lastKnownSnapshot({
      accounts: [conta()],
      accountsAt: CONTAS_EM,
      homeData: mes(),
      homeDataAt: MES_EM,
    });

    expect(resultado?.headline).toEqual({ label: "Em conta", amount: 1234.56 });
    expect(resultado?.expenses).toEqual({
      label: `Gastos em ${SETEMBRO}`,
      amount: 3200,
    });
  });

  it("duas contas de banco somam; o cartão fica de fora da soma", () => {
    // A mesma regra da Home (`utils/cashPosition`): crédito nunca é dinheiro
    const resultado = lastKnownSnapshot({
      ...NADA,
      accounts: [
        conta(),
        conta({ id: "acc-outro", reportedBalance: 100 }),
        conta({ id: "acc-cartao", type: "CREDIT_CARD", reportedBalance: -900 }),
      ],
      accountsAt: CONTAS_EM,
    });

    expect(resultado?.headline.amount).toBeCloseTo(1334.56);
    expect(resultado?.expenses).toBeNull();
  });

  it("sem saldo informado, a manchete é o resultado do mês", () => {
    const resultado = lastKnownSnapshot({
      ...NADA,
      homeData: mes(),
      homeDataAt: MES_EM,
    });

    expect(resultado?.headline).toEqual({
      label: `Sobrou em ${SETEMBRO}`,
      amount: 1800,
    });
  });

  it("'Sobrou' em cima de número negativo é frase errada", () => {
    const resultado = lastKnownSnapshot({
      ...NADA,
      homeData: mes({ totalIncome: 2800, net: -400 }),
      homeDataAt: MES_EM,
    });

    expect(resultado?.headline).toEqual({
      label: `Faltou em ${SETEMBRO}`,
      amount: -400,
    });
  });

  it("só cartão, ou banco sem saldo informado, cai no mês", () => {
    const soCartao = lastKnownSnapshot({
      accounts: [conta({ type: "CREDIT_CARD", reportedBalance: -900 })],
      accountsAt: CONTAS_EM,
      homeData: mes(),
      homeDataAt: MES_EM,
    });
    const bancoMudo = lastKnownSnapshot({
      accounts: [conta({ reportedBalance: null, reportedBalanceAt: null })],
      accountsAt: CONTAS_EM,
      homeData: mes(),
      homeDataAt: MES_EM,
    });

    expect(soCartao?.headline.label).toBe(`Sobrou em ${SETEMBRO}`);
    expect(bancoMudo?.headline.label).toBe(`Sobrou em ${SETEMBRO}`);
    // Sem conta que entre, a data das contas não pode puxar a legenda
    expect(soCartao?.at).toBe(MES_EM);
    expect(bancoMudo?.at).toBe(MES_EM);
  });

  it("no modo janela, o complemento é o ciclo — o mesmo rótulo da Home", () => {
    const janela = mes({ month: null, start: "2026-08-12", end: "2026-09-11" });

    const resultado = lastKnownSnapshot({
      ...NADA,
      homeData: janela,
      homeDataAt: MES_EM,
    });

    const ciclo = formatWindowLabel("2026-08-12", "2026-09-11");
    expect(resultado?.headline.label).toBe(`Sobrou no ciclo ${ciclo}`);
    expect(resultado?.expenses?.label).toBe(`Gastos no ciclo ${ciclo}`);
  });

  it("a legenda carimba o instante mais VELHO entre os que entraram", () => {
    // Saldo de ontem e mês de hoje: o bloco é de ontem. Carimbar o mais novo
    // faria um número velho passar por novo
    const resultado = lastKnownSnapshot({
      accounts: [conta()],
      accountsAt: CONTAS_EM,
      homeData: mes(),
      homeDataAt: MES_EM,
    });

    expect(resultado?.at).toBe(CONTAS_EM);

    const invertido = lastKnownSnapshot({
      accounts: [conta()],
      accountsAt: MES_EM,
      homeData: mes(),
      homeDataAt: CONTAS_EM,
    });

    expect(invertido?.at).toBe(CONTAS_EM);
  });

  it("só contas: manchete sem linha de gastos, data das contas", () => {
    const resultado = lastKnownSnapshot({
      ...NADA,
      accounts: [conta()],
      accountsAt: CONTAS_EM,
    });

    expect(resultado?.headline.label).toBe("Em conta");
    expect(resultado?.expenses).toBeNull();
    expect(resultado?.at).toBe(CONTAS_EM);
  });
});
