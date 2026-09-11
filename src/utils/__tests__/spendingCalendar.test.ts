import {
  WEEKDAY_LABELS,
  buildSpendingCalendar as gradeDe,
  dailyTotalsFrom,
  intensityOf,
} from "../spendingCalendar";

import type { BankTransaction } from "../../services/api";

/** O caminho completo: linhas -> totais por dia -> grade. */
const buildSpendingCalendar = (mes: string, linhas: BankTransaction[]) =>
  gradeDe(mes, dailyTotalsFrom(linhas));

const linha = (
  data: string,
  valor: number,
  patch: Partial<BankTransaction> = {},
): BankTransaction =>
  ({
    id: `${data}-${valor}`,
    transactionId: "x",
    type: valor < 0 ? "DEBIT" : "CREDIT",
    amount: valor,
    description: "lançamento",
    originalDescription: "lançamento",
    displayAlias: null,
    date: `${data}T12:00:00Z`,
    categoryId: null,
    reviewStatus: "CONFIRMED",
    categorizedBy: null,
    confidence: null,
    normalizedDescription: null,
    uploadId: null,
    accountId: null,
    internalTransfer: false,
    ignored: false,
    familyTransfer: false,
    refunded: false,
    refundOfId: null,
    ...patch,
  }) as BankTransaction;

/**
 * EC-235 — o mês em grade.
 *
 * Os dias usados aqui são os do extrato REAL do dono (Inter, 10/08 a
 * 10/09/2026): 04/09 com R$ 157,80 de saída e R$ 2.813,94 de entrada, 05/09
 * com R$ 3.971,83 de saída, 08/09 com R$ 188,54.
 */
describe("Calendário de gastos", () => {
  const SETEMBRO = [
    linha("2026-09-04", -157.8),
    linha("2026-09-04", 2813.94),
    linha("2026-09-05", -3971.83),
    linha("2026-09-05", 957.13),
    linha("2026-09-08", -188.54),
  ];

  it("os dias reais do dono caem nos dias certos", () => {
    const grade = buildSpendingCalendar("2026-09", SETEMBRO);
    const dias = grade.weeks.flat();

    expect(dias.find((d) => d.date === "2026-09-04")?.spent).toBeCloseTo(157.8);
    expect(dias.find((d) => d.date === "2026-09-04")?.earned).toBeCloseTo(2813.94);
    expect(dias.find((d) => d.date === "2026-09-05")?.spent).toBeCloseTo(3971.83);
    expect(dias.find((d) => d.date === "2026-09-08")?.spent).toBeCloseTo(188.54);
  });

  it("os totais do mês somam os dias", () => {
    const grade = buildSpendingCalendar("2026-09", SETEMBRO);

    expect(grade.totalSpent).toBeCloseTo(157.8 + 3971.83 + 188.54);
    expect(grade.totalEarned).toBeCloseTo(2813.94 + 957.13);
    expect(grade.daysWithSpending).toBe(3);
    expect(grade.busiestDaySpent).toBeCloseTo(3971.83);
  });

  it("a grade fecha em semanas de sete, começando no domingo", () => {
    const grade = buildSpendingCalendar("2026-09", SETEMBRO);

    expect(WEEKDAY_LABELS).toHaveLength(7);
    grade.weeks.forEach((semana) => expect(semana).toHaveLength(7));
    // 01/09/2026 é uma terça: as duas primeiras casas são de preenchimento
    expect(grade.weeks[0][0].inMonth).toBe(false);
    expect(grade.weeks[0][1].inMonth).toBe(false);
    expect(grade.weeks[0][2].date).toBe("2026-09-01");
  });

  it("todos os dias do mês estão na grade, nenhum a mais", () => {
    const grade = buildSpendingCalendar("2026-09", SETEMBRO);
    const doMes = grade.weeks.flat().filter((d) => d.inMonth);

    expect(doMes).toHaveLength(30);
    expect(doMes[0].dayOfMonth).toBe(1);
    expect(doMes[29].dayOfMonth).toBe(30);
  });

  it("fevereiro bissexto tem 29 dias", () => {
    const grade = buildSpendingCalendar("2028-02", []);

    expect(grade.weeks.flat().filter((d) => d.inMonth)).toHaveLength(29);
  });

  it("as MESMAS exclusões das outras somas — um dia de aplicação não é dia caro", () => {
    // Se o calendário usasse outra regra, viraria mais um número que discorda
    // dos demais, que é o defeito que o EC-200 acabou de fechar
    const grade = buildSpendingCalendar("2026-09", [
      linha("2026-09-05", -411.35, { internalTransfer: true }),
      linha("2026-09-05", -50, { ignored: true }),
      linha("2026-09-05", -30, { refunded: true }),
      linha("2026-09-05", -20),
    ]);
    const dia = grade.weeks.flat().find((d) => d.date === "2026-09-05");

    expect(dia?.spent).toBe(20);
    expect(dia?.count).toBe(1);
    expect(grade.totalSpent).toBe(20);
  });

  it("lançamento de outro mês não entra na grade", () => {
    const grade = buildSpendingCalendar("2026-09", [
      linha("2026-08-19", -20.4),
      linha("2026-09-08", -188.54),
    ]);

    expect(grade.totalSpent).toBeCloseTo(188.54);
  });

  it("compra das 22h do último dia NÃO vaza para o mês seguinte", () => {
    // O servidor grava UTC e o app desenha em fuso local; converter com Date
    // jogaria 31/08 22h para 1º de setembro conforme o fuso, e dia errado num
    // calendário é o único erro que ele não pode cometer
    const grade = buildSpendingCalendar("2026-09", [linha("2026-08-31", -99)]);

    expect(grade.totalSpent).toBe(0);
  });

  it("mês sem movimento vira grade vazia, não quebra", () => {
    const grade = buildSpendingCalendar("2026-09", []);

    expect(grade.totalSpent).toBe(0);
    expect(grade.busiestDaySpent).toBe(0);
    expect(grade.daysWithSpending).toBe(0);
    expect(grade.weeks.flat().filter((d) => d.inMonth)).toHaveLength(30);
  });
});

describe("Intensidade da cor", () => {
  const grade = buildSpendingCalendar("2026-09", [
    linha("2026-09-04", -157.8),
    linha("2026-09-05", -3971.83),
    linha("2026-09-08", -188.54),
  ]);
  const dia = (data: string) => grade.weeks.flat().find((d) => d.date === data)!;

  it("o dia mais caro do mês é o teto da escala", () => {
    expect(intensityOf(dia("2026-09-05"), grade.busiestDaySpent)).toBe(1);
  });

  it("dia sem gasto não pinta", () => {
    expect(intensityOf(dia("2026-09-01"), grade.busiestDaySpent)).toBe(0);
  });

  it("dia de preenchimento não pinta", () => {
    expect(intensityOf(grade.weeks[0][0], grade.busiestDaySpent)).toBe(0);
  });

  it("a raiz impede que o pico achate o resto do mês", () => {
    // 157,80 é 4% de 3.971,83 — linear daria 0,04 e o dia sumiria. O que se
    // quer ver é o padrão da semana, não só o pico
    const linear = 157.8 / 3971.83;
    const desenhado = intensityOf(dia("2026-09-04"), grade.busiestDaySpent);

    expect(desenhado).toBeGreaterThan(linear * 4);
    expect(desenhado).toBeLessThan(0.5);
  });

  it("mês sem gasto nenhum não divide por zero", () => {
    const vazio = buildSpendingCalendar("2026-09", []);

    expect(intensityOf(vazio.weeks[1][0], vazio.busiestDaySpent)).toBe(0);
  });
});
