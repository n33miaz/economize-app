import { cyclePerformance, describePotReason } from "../pot";
import { potStateFor } from "../../components/PotIcon";

import type { CategorySlice, MonthlyAnalytics } from "../../services/api";

const slice = (systemKey: string, expenseTotal: number): CategorySlice => ({
  categoryId: systemKey,
  name: systemKey,
  groupName: null,
  color: null,
  icon: null,
  systemKey,
  parentSystemKey: null,
  system: true,
  expenseTotal,
  incomeTotal: 0,
  txCount: 1,
  previousExpenseTotal: 0,
  expenseDeltaPct: null,
  children: [],
});

const ciclo = (over: Partial<MonthlyAnalytics> = {}): MonthlyAnalytics => ({
  month: "2026-08",
  start: "2026-08-01",
  end: "2026-08-31",
  totalIncome: 5000,
  totalExpense: 4500,
  net: 500,
  previous: {
    month: "2026-07",
    start: "2026-07-01",
    end: "2026-07-31",
    totalIncome: 0,
    totalExpense: 0,
    net: 0,
  },
  categories: [],
  pendingReviewCount: 0,
  ...over,
});

describe("cyclePerformance", () => {
  it("sem ciclo carregado devolve nulo em vez de zero", () => {
    // zero levaria o pote ao vermelho, acusando o usuário de um resultado que
    // ninguém mediu
    expect(cyclePerformance(null)).toBeNull();
    expect(cyclePerformance(undefined)).toBeNull();
  });

  it("o que foi para investimento conta como guardado, não como gasto", () => {
    const perf = cyclePerformance(
      ciclo({
        totalIncome: 5000,
        totalExpense: 4500,
        net: 500,
        categories: [slice("INVESTMENT", 1500), slice("FOOD", 3000)],
      }),
    );

    // 500 de sobra + 1.500 investidos = 2.000 realmente guardados
    expect(perf!.kept).toBe(2000);
    expect(perf!.invested).toBe(1500);
    expect(perf!.income).toBe(5000);
  });

  it("sem investimento no ciclo o guardado é a própria sobra", () => {
    const perf = cyclePerformance(ciclo({ categories: [slice("FOOD", 4500)] }));
    expect(perf!.kept).toBe(500);
    expect(perf!.invested).toBe(0);
  });

  it("ciclo sem categorias não quebra", () => {
    expect(cyclePerformance(ciclo({ categories: [] }))!.kept).toBe(500);
  });

  it("quem investiu metade do salário vê o pote cheio, não vazio", () => {
    // é o teste que justifica a regra inteira: sem o ajuste, o mês de maior
    // esforço mostraria o pote no vermelho
    const perf = cyclePerformance(
      ciclo({
        totalIncome: 5000,
        totalExpense: 5000,
        net: 0,
        categories: [slice("INVESTMENT", 2500), slice("FOOD", 2500)],
      }),
    )!;

    const semAjuste = potStateFor(0, 5000);
    const comAjuste = potStateFor(perf.kept, perf.income);

    expect(semAjuste.level).toBe(0.25);
    expect(comAjuste.tone).toBe("success");
    expect(comAjuste.level).toBe(1);
  });
});

describe("describePotReason", () => {
  it("avisa que o investimento entrou na conta", () => {
    const perf = cyclePerformance(
      ciclo({ categories: [slice("INVESTMENT", 1500)] }),
    );
    // sem esta frase, quem investiu acharia que o app ignorou a aplicação
    expect(describePotReason(perf)).toContain("investiu");
  });

  it("explica o pote vazio quando o ciclo fecha no vermelho", () => {
    const perf = cyclePerformance(
      ciclo({ totalIncome: 3000, totalExpense: 3400, net: -400 }),
    );
    expect(describePotReason(perf)).toContain("Saiu mais");
  });

  it("cala quando não há o que explicar", () => {
    expect(describePotReason(cyclePerformance(ciclo()))).toBeNull();
    expect(describePotReason(null)).toBeNull();
  });

  it("cala sem entradas no ciclo", () => {
    expect(
      describePotReason(cyclePerformance(ciclo({ totalIncome: 0, net: 0 }))),
    ).toBeNull();
  });
});
