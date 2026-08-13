import { calculateBankMetrics } from "../bankMetrics";
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
  date: "2026-05-01T00:00:00Z",
  categoryId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: null,
  confidence: null,
  normalizedDescription: null,
  uploadId: null,
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
