import type { ConnectorAccount } from "../../services/api";
import { cashPositionFrom, creditPositionFrom } from "../cashPosition";

/**
 * A separação entre saber e chutar.
 *
 * <p>Estes testes existem por causa de dois números que o dono viu na tela em
 * 15/09/2026 e recusou, com razão: R$ 3.021,06 "sobrando" numa conta onde não
 * havia nada, e uma projeção de fechar o mês devendo dezenove mil. Os dois
 * saíam da mesma conta errada — somar todo o movimento importado e chamar o
 * resultado de saldo, com a fatura do cartão entrando na mesma soma.
 */
const AGORA = Date.parse("2026-09-15T12:00:00Z");

const conta = (over: Partial<ConnectorAccount> = {}): ConnectorAccount => ({
  id: over.id ?? `acc-${Math.random()}`,
  name: "Conta",
  type: "BANK",
  institution: "Inter",
  statementClosingDay: null,
  statementDueDay: null,
  linked: false,
  reportedBalance: null,
  reportedBalanceAt: null,
  creditLimit: null,
  creditLimitSharedWith: null,
  ...over,
});

describe("cashPositionFrom", () => {
  it("soma o saldo informado das contas de banco", () => {
    const posicao = cashPositionFrom(
      [
        conta({
          reportedBalance: 4213.83,
          reportedBalanceAt: "2026-09-15T09:00:00Z",
        }),
        conta({
          reportedBalance: 120.5,
          reportedBalanceAt: "2026-09-15T09:00:00Z",
        }),
      ],
      AGORA,
    );

    expect(posicao.amount).toBeCloseTo(4334.33);
    expect(posicao.source).toBe("REPORTED");
    expect(posicao.caveat).toBeNull();
  });

  /**
   * A regra central. Sem saldo informado a resposta é NÃO SEI — nunca zero,
   * nunca a soma do extrato. Zero é um saldo, e um saldo falso vira decisão de
   * compra errada.
   */
  it("sem saldo informado, o valor é nulo e a tela é avisada", () => {
    const posicao = cashPositionFrom([conta(), conta()], AGORA);

    expect(posicao.amount).toBeNull();
    expect(posicao.source).toBe("UNKNOWN");
    expect(posicao.caveat).toContain("Nenhuma das suas contas informou saldo");
  });

  /**
   * O erro que produziu os vinte mil negativos: a fatura do cartão entrava na
   * mesma soma que o dinheiro. Compra derruba o total, e o pagamento da fatura
   * pela conta corrente derruba de novo — o mesmo dinheiro contado duas vezes.
   */
  it("cartão NÃO entra na conta do dinheiro", () => {
    const posicao = cashPositionFrom(
      [
        conta({
          reportedBalance: 1000,
          reportedBalanceAt: "2026-09-15T09:00:00Z",
        }),
        conta({ type: "CREDIT_CARD", reportedBalance: -20515.63 }),
      ],
      AGORA,
    );

    expect(posicao.amount).toBe(1000);
    expect(posicao.bankAccounts).toBe(1);
  });

  it("conta de banco sem saldo vira ressalva, e não silêncio", () => {
    const posicao = cashPositionFrom(
      [
        conta({
          reportedBalance: 300,
          reportedBalanceAt: "2026-09-15T09:00:00Z",
        }),
        conta(),
      ],
      AGORA,
    );

    expect(posicao.amount).toBe(300);
    expect(posicao.caveat).toBe("1 conta não informou saldo e ficou de fora.");
  });

  it("leitura de mais de dois dias é declarada", () => {
    const posicao = cashPositionFrom(
      [
        conta({
          reportedBalance: 300,
          reportedBalanceAt: "2026-09-10T09:00:00Z",
        }),
      ],
      AGORA,
    );

    expect(posicao.caveat).toBe("A última leitura tem mais de dois dias.");
  });

  it("sem conta nenhuma, diz isso — e não que faltou saldo", () => {
    expect(cashPositionFrom([], AGORA).caveat).toBe(
      "Nenhuma conta cadastrada ainda.",
    );
  });
});

describe("creditPositionFrom", () => {
  it("limite menos dívida é o que ainda dá para gastar", () => {
    const posicao = creditPositionFrom([
      conta({
        type: "CREDIT_CARD",
        creditLimit: 5000,
        reportedBalance: -1432.17,
      }),
    ]);

    expect(posicao.limit).toBe(5000);
    expect(posicao.owed).toBeCloseTo(1432.17);
    expect(posicao.available).toBeCloseTo(3567.83);
  });

  /**
   * "Normalmente um crédito vale para vários cartões" — o dono, no mesmo
   * pedido. Cartão virtual e adicional consomem a MESMA bolsa: somar os dois
   * limites mostraria o dobro do crédito que existe.
   */
  it("limite compartilhado é contado UMA vez", () => {
    const fisico = conta({
      id: "fisico",
      type: "CREDIT_CARD",
      creditLimit: 5000,
    });
    const virtual = conta({
      id: "virtual",
      type: "CREDIT_CARD",
      creditLimit: null,
      creditLimitSharedWith: "fisico",
      reportedBalance: -200,
    });

    const posicao = creditPositionFrom([fisico, virtual]);

    expect(posicao.limit).toBe(5000);
    expect(posicao.cardsWithLimit).toBe(1);
    // A dívida do virtual continua sendo dívida: o que se divide é a bolsa
    expect(posicao.owed).toBe(200);
  });

  it("sem limite informado não há crédito disponível para anunciar", () => {
    const posicao = creditPositionFrom([
      conta({ type: "CREDIT_CARD", reportedBalance: -100 }),
    ]);

    expect(posicao.limit).toBeNull();
    expect(posicao.available).toBeNull();
    expect(posicao.cards).toBe(1);
  });
});
