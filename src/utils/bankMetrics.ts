import type { BankTransaction } from "../services/api";

export interface BankMetrics {
  income: number;
  expense: number;
  total: number;
}

export function calculateBankMetrics(
  transactions: BankTransaction[],
): BankMetrics {
  return transactions.reduce<BankMetrics>(
    (acc, curr) => {
      const val = curr.amount;
      if (curr.type === "CREDIT") acc.income += val;
      else acc.expense += Math.abs(val);
      acc.total += val;
      return acc;
    },
    { income: 0, expense: 0, total: 0 },
  );
}
