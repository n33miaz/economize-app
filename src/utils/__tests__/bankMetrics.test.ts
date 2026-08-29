import {
  CARD_SCOPE_NOTE,
  calculateBankMetrics,
  statementMetrics,
  statementScopeNote,
} from "../bankMetrics";
import type { BankTransaction } from "../../services/api";

const tx = (
  amount: number,
  type: "CREDIT" | "DEBIT",
  description = "",
): BankTransaction => ({
  id: Math.random().toString(),
  transactionId: Math.random().toString(),
  amount,
  type,
  description,
  originalDescription: description,
  displayAlias: null,
  date: "2026-05-01T00:00:00Z",
  categoryId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: null,
  confidence: null,
  normalizedDescription: null,
  uploadId: null,
  // Origem nula é o caso comum do histórico: a métrica não olha para ela
  accountId: null,
});

describe("calculateBankMetrics", () => {
  it("returns zeros for empty array", () => {
    expect(calculateBankMetrics([])).toEqual({ income: 0, expense: 0, total: 0 });
  });

  it("sums credits as income", () => {
    const result = calculateBankMetrics([
      tx(1000, "CREDIT"),
      tx(500, "CREDIT"),
    ]);
    expect(result.income).toBe(1500);
    expect(result.expense).toBe(0);
    expect(result.total).toBe(1500);
  });

  it("sums absolute debits as expense", () => {
    const result = calculateBankMetrics([
      tx(-200, "DEBIT"),
      tx(-50, "DEBIT"),
    ]);
    expect(result.income).toBe(0);
    expect(result.expense).toBe(250);
    expect(result.total).toBe(-250);
  });

  it("computes total as net", () => {
    const result = calculateBankMetrics([
      tx(1000, "CREDIT"),
      tx(-300, "DEBIT"),
      tx(200, "CREDIT"),
    ]);
    expect(result.income).toBe(1200);
    expect(result.expense).toBe(300);
    expect(result.total).toBe(900);
  });
});

describe("statementMetrics — os números falam o idioma da conta", () => {
  // Um ciclo de cartão como ele chega no extrato: duas compras, um estorno e
  // o pagamento da fatura anterior. O pagamento é o número perigoso
  const cartao = [
    tx(-500, "DEBIT", "MERCADO"),
    tx(-300, "DEBIT", "POSTO"),
    tx(80, "CREDIT", "ESTORNO MERCADO"),
    tx(3200, "CREDIT", "PAGAMENTO FATURA"),
  ];

  it("no escopo de conta nada muda — entradas, saídas e líquido", () => {
    // Contrato explícito da correção: conta bancária continua exatamente como
    // era, senão o conserto do cartão vira regressão do extrato inteiro
    const linhas = statementMetrics(
      [tx(1000, "CREDIT"), tx(-300, "DEBIT")],
      "BANK",
    );
    expect(linhas.map((l) => [l.label, l.value])).toEqual([
      ["Entradas", 1000],
      ["Saídas", 300],
      ["Líquido", 700],
    ]);
  });

  it("no cartão NENHUM crédito aparece como receita", () => {
    // O pagamento de R$ 3.200 é dinheiro que SAIU da conta corrente para
    // quitar o cartão. Ele aparecia como "Entradas R$ 3.280" em verde
    const linhas = statementMetrics(cartao, "CREDIT_CARD");
    expect(linhas.some((l) => l.label === "Entradas")).toBe(false);
    expect(linhas.every((l) => l.tone !== "up")).toBe(true);
  });

  it("no cartão os números são compras e créditos, nomeados pelo que são", () => {
    const linhas = statementMetrics(cartao, "CREDIT_CARD");
    expect(linhas.map((l) => [l.label, l.value])).toEqual([
      ["Compras", 800],
      ["Estornos e pagamentos", 3280],
    ]);
  });

  it("no cartão não existe terceiro número: 'líquido' ali não significa nada", () => {
    // compras − pagamentos não é dívida, não é gasto e não é saldo. O número
    // que o usuário quer ("quanto devo") é o total da fatura, em Cartões
    const linhas = statementMetrics(cartao, "CREDIT_CARD");
    expect(linhas).toHaveLength(2);
    expect(linhas.some((l) => l.key === "net")).toBe(false);
    // -800 + 3280 = 2480, o número sem significado que aparecia como "Líquido"
    expect(linhas.some((l) => l.value === 2480)).toBe(false);
  });

  it("o crédito de cartão é neutro, e o líquido da conta também", () => {
    // Verde no crédito de cartão é a versão visual de chamá-lo de receita
    const cartaoRows = statementMetrics(cartao, "CREDIT_CARD");
    expect(cartaoRows.find((l) => l.key === "cardCredits")?.tone).toBe("neutral");
    const bankRows = statementMetrics([tx(10, "CREDIT")], "BANK");
    expect(bankRows.find((l) => l.key === "income")?.tone).toBe("up");
    expect(bankRows.find((l) => l.key === "net")?.tone).toBe("neutral");
  });

  it("o líquido fica fora da rosca; o resto compõe", () => {
    // A rosca é composição: somar o líquido nela contaria as parcelas duas vezes
    expect(
      statementMetrics([tx(10, "CREDIT")], "BANK")
        .filter((l) => l.inChart)
        .map((l) => l.key),
    ).toEqual(["income", "expense"]);
    expect(
      statementMetrics(cartao, "CREDIT_CARD").every((l) => l.inChart),
    ).toBe(true);
  });

  it("só o escopo de cartão carrega a ressalva escrita", () => {
    expect(statementScopeNote("CREDIT_CARD")).toBe(CARD_SCOPE_NOTE);
    expect(CARD_SCOPE_NOTE).toContain("nunca receita");
    expect(statementScopeNote("BANK")).toBeNull();
  });

  it("lista vazia devolve zeros nos dois escopos, sem inventar linha", () => {
    expect(statementMetrics([], "BANK").map((l) => l.value)).toEqual([0, 0, 0]);
    expect(statementMetrics([], "CREDIT_CARD").map((l) => l.value)).toEqual([0, 0]);
  });
});
