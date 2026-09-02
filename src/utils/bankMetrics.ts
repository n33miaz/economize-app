import type { BankTransaction } from "../services/api";

export interface BankMetrics {
  income: number;
  expense: number;
  total: number;
}

export function calculateBankMetrics(
  transactions: BankTransaction[],
): BankMetrics {
  const acc = transactions.reduce<BankMetrics>(
    (soma, curr) => {
      const val = Math.abs(curr.amount);
      if (curr.type === "CREDIT") soma.income += val;
      else soma.expense += val;
      return soma;
    },
    { income: 0, expense: 0, total: 0 },
  );
  // Derivado, e não somado com o sinal cru. Todo caminho de importação (OFX,
  // CSV, XLSX, TXT, conector) grava débito negativo, então somar o valor
  // assinado dava o mesmo resultado — mas metade desta função se defendia do
  // sinal com `Math.abs` e a outra metade confiava nele. Uma linha com sinal
  // trocado não pode fazer o "Líquido" do topo do extrato virar a SOMA das
  // duas colunas em silêncio, com Entradas e Saídas continuando certas
  acc.total = acc.income - acc.expense;
  return acc;
}

/**
 * Em que idioma os números do topo do extrato falam (EC-113).
 *
 * `calculateBankMetrics` acima soma com a semântica de CONTA: crédito é
 * entrada, débito é saída, e o líquido é o que sobrou. Essa leitura está certa
 * para conta corrente e é uma mentira num cartão de crédito, onde um `CREDIT`
 * é estorno ou PAGAMENTO DA FATURA — dinheiro que saiu da conta corrente para
 * quitar o cartão, jamais receita. Somá-lo em "Entradas" inventa dinheiro que
 * o usuário não recebeu, e é exatamente o erro que o resto do EC-113 existe
 * para impedir.
 *
 * Por isso o recorte visível decide os rótulos, e não o contrário.
 */
export type StatementScope = "BANK" | "CREDIT_CARD";

export interface StatementMetric {
  key: "income" | "expense" | "net" | "purchases" | "cardCredits";
  label: string;
  value: number;
  /**
   * `up`/`down` pintam com `chart.up`/`chart.down`; `neutral` fica no texto
   * primário. O crédito de cartão é NEUTRO de propósito: pintá-lo de verde é a
   * versão visual de chamá-lo de receita.
   */
  tone: "up" | "down" | "neutral";
  /** Entra na rosca de composição. O líquido não entra: é derivado dos outros. */
  inChart: boolean;
}

/**
 * Os números do topo do extrato, já no idioma do recorte visível.
 *
 * No escopo de cartão são DOIS números, não três:
 *
 * - **Compras**: os débitos do cartão. Num cartão, débito é compra.
 * - **Estornos e pagamentos**: os créditos, juntos e assim nomeados porque o
 *   extrato não sabe separá-los — quem separa é `/accounts/{id}/invoices`, no
 *   servidor. Reproduzir aquela heurística aqui seria inventar uma distinção
 *   que este dado não carrega, e nomear só uma das duas mentiria metade das
 *   vezes.
 * - **Nenhum terceiro número.** "Líquido" seria compras menos pagamentos:
 *   não é dívida, não é gasto, não é saldo — é a subtração de duas coisas que
 *   não se subtraem. O número que o usuário quer ("quanto devo neste ciclo") é
 *   o `total` da fatura, e ele só existe na tela de Cartões.
 */
export function statementMetrics(
  transactions: BankTransaction[],
  scope: StatementScope,
): StatementMetric[] {
  const { income, expense, total } = calculateBankMetrics(transactions);

  if (scope === "CREDIT_CARD") {
    return [
      {
        key: "purchases",
        label: "Compras",
        value: expense,
        tone: "down",
        inChart: true,
      },
      {
        key: "cardCredits",
        label: "Estornos e pagamentos",
        value: income,
        tone: "neutral",
        inChart: true,
      },
    ];
  }

  return [
    { key: "income", label: "Entradas", value: income, tone: "up", inChart: true },
    { key: "expense", label: "Saídas", value: expense, tone: "down", inChart: true },
    { key: "net", label: "Líquido", value: total, tone: "neutral", inChart: false },
  ];
}

/** A ressalva escrita que o escopo de cartão precisa carregar. */
export const CARD_SCOPE_NOTE =
  "No cartão, crédito é estorno ou pagamento da fatura — nunca receita. O " +
  "extrato não separa os dois: o que você deve em cada ciclo está em Cartões.";

export function statementScopeNote(scope: StatementScope): string | null {
  return scope === "CREDIT_CARD" ? CARD_SCOPE_NOTE : null;
}
