import type { InstallmentOverview, InstallmentSeries } from "../../services/api";
import {
  describeInstallmentProgress,
  installmentsSummary,
  isOpenInstallment,
  monthlyInstallmentLoad,
  nextInstallmentMonth,
  nextInvoiceInstallmentLoad,
  openInstallments,
} from "../installments";

function serie(partial: Partial<InstallmentSeries> = {}): InstallmentSeries {
  return {
    description: "Mercadolivre*Bwgshop",
    total: 3,
    seen: 2,
    remaining: 1,
    installmentAmount: 199.96,
    remainingAmount: 199.96,
    firstMonth: "2026-08",
    lastMonth: "2026-10",
    finished: false,
    ...partial,
  };
}

function overview(series: InstallmentSeries[]): InstallmentOverview {
  const abertas = series.filter((s) => !s.finished);
  return {
    totalSeries: series.length,
    openSeries: abertas.length,
    remainingTotal: abertas.reduce((soma, s) => soma + s.remainingAmount, 0),
    series,
  };
}

describe("parcelamentos — leitura das séries", () => {
  it("a próxima parcela é `remaining - 1` meses antes da última", () => {
    // Faltam 3, a última é em dezembro: a próxima cai em outubro
    expect(nextInstallmentMonth(serie({ remaining: 3, lastMonth: "2026-12" }))).toBe(
      "2026-10",
    );
    // Falta uma só: a próxima É a última
    expect(nextInstallmentMonth(serie({ remaining: 1, lastMonth: "2026-10" }))).toBe(
      "2026-10",
    );
  });

  it("atravessa a virada do ano sem passar por Date", () => {
    expect(nextInstallmentMonth(serie({ remaining: 4, lastMonth: "2027-02" }))).toBe(
      "2026-11",
    );
  });

  it("série zerada devolve a própria última parcela em vez de andar para trás", () => {
    expect(nextInstallmentMonth(serie({ remaining: 0, lastMonth: "2026-10" }))).toBe(
      "2026-10",
    );
  });

  it("aberta é a que não terminou E ainda tem parcela", () => {
    expect(isOpenInstallment(serie())).toBe(true);
    expect(isOpenInstallment(serie({ finished: true }))).toBe(false);
    expect(isOpenInstallment(serie({ remaining: 0 }))).toBe(false);
  });

  it("'pagas' sai de total menos restantes, não de `seen`", () => {
    // Histórico que começa no meio: o extrato só viu 1, mas 4 já foram pagas
    const [item] = openInstallments(
      overview([serie({ total: 10, seen: 1, remaining: 6 })]),
    );

    expect(item.paid).toBe(4);
    expect(describeInstallmentProgress(item)).toBe("4 de 10 pagas");
    expect(item.progress).toBeCloseTo(0.4);
  });

  it("as terminadas ficam de fora e a ordem do servidor é preservada", () => {
    const abertas = openInstallments(
      overview([
        serie({ description: "Termina antes", lastMonth: "2026-10" }),
        serie({ description: "Já acabou", finished: true, remaining: 0 }),
        serie({ description: "Termina depois", lastMonth: "2027-01", remaining: 4 }),
      ]),
    );

    expect(abertas.map((s) => s.description)).toEqual([
      "Termina antes",
      "Termina depois",
    ]);
  });

  it("a carga mensal é a soma das parcelas abertas", () => {
    const abertas = openInstallments(
      overview([
        serie({ installmentAmount: 100 }),
        serie({ description: "Outra", installmentAmount: 50.5 }),
        serie({ description: "Fechada", finished: true, installmentAmount: 999 }),
      ]),
    );

    expect(monthlyInstallmentLoad(abertas)).toBeCloseTo(150.5);
  });

  it("na próxima fatura só entra o que cai neste mês ou no seguinte", () => {
    const abertas = openInstallments(
      overview([
        // próxima em 2026-09
        serie({ description: "Agora", remaining: 2, lastMonth: "2026-10", installmentAmount: 100 }),
        // próxima em 2026-10
        serie({ description: "Mês que vem", remaining: 1, lastMonth: "2026-10", installmentAmount: 30 }),
        // próxima em 2026-12: agendada, ainda não começou
        serie({ description: "Depois", remaining: 2, lastMonth: "2027-01", installmentAmount: 500 }),
      ]),
    );

    expect(nextInvoiceInstallmentLoad(abertas, "2026-09")).toEqual({
      amount: 130,
      count: 2,
    });
  });

  it("o resumo junta contagem, carga e o que falta pagar", () => {
    const resumo = installmentsSummary(
      overview([
        serie({ installmentAmount: 100, remainingAmount: 200, remaining: 2, lastMonth: "2026-11" }),
        serie({ description: "Outra", installmentAmount: 50, remainingAmount: 50 }),
      ]),
    );

    expect(resumo.count).toBe(2);
    expect(resumo.monthlyLoad).toBe(150);
    expect(resumo.remainingTotal).toBe(250);
  });

  it("sem resposta do servidor, tudo zerado — e sem quebrar", () => {
    expect(openInstallments(null)).toEqual([]);
    expect(installmentsSummary(undefined)).toEqual({
      open: [],
      count: 0,
      monthlyLoad: 0,
      remainingTotal: 0,
    });
  });
});
