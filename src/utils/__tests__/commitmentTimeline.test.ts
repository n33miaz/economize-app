import { addMonths, buildCommitmentTimeline } from "../commitmentTimeline";
import type {
  ForecastItem,
  ForecastMonth,
  InstallmentOverview,
  InstallmentSeries,
} from "../../services/api";

const item = (
  amount: number,
  flow: "EXPENSE" | "INCOME" = "EXPENSE",
  settled = false,
): ForecastItem =>
  ({
    seriesId: `s${amount}`,
    displayName: "algo",
    flow,
    dueDay: 10,
    dueDate: null,
    amount,
    source: "DETECTED",
    settled,
  }) as ForecastItem;

const mes = (month: string, items: ForecastItem[] = []): ForecastMonth =>
  ({
    month,
    start: `${month}-01`,
    end: `${month}-28`,
    expectedIncome: 0,
    expectedExpense: 0,
    expectedNet: 0,
    cumulativeNet: 0,
    items,
  }) as ForecastMonth;

const serie = (patch: Partial<InstallmentSeries>): InstallmentSeries => ({
  description: "Mercadolivre*Bwgshop",
  total: 3,
  seen: 1,
  remaining: 2,
  installmentAmount: 199.96,
  remainingAmount: 399.92,
  firstMonth: "2026-08",
  lastMonth: "2026-10",
  finished: false,
  ...patch,
});

const overview = (series: InstallmentSeries[]): InstallmentOverview => ({
  totalSeries: series.length,
  openSeries: series.filter((s) => !s.finished).length,
  remainingTotal: series.reduce((soma, s) => soma + s.remainingAmount, 0),
  series,
});

describe("Linha do tempo de compromisso", () => {
  it("espalha as parcelas restantes até o último mês da série", () => {
    // 2 restantes com última em out/2026: uma em setembro e uma em outubro
    const linha = buildCommitmentTimeline(
      [mes("2026-09"), mes("2026-10"), mes("2026-11")],
      overview([serie({ remaining: 2, lastMonth: "2026-10" })]),
    );

    expect(linha[0].installments).toBeCloseTo(199.96);
    expect(linha[1].installments).toBeCloseTo(199.96);
    expect(linha[2].installments).toBe(0);
  });

  it("série terminada não cobra nada", () => {
    const linha = buildCommitmentTimeline(
      [mes("2026-09")],
      overview([serie({ finished: true, remaining: 0 })]),
    );

    expect(linha[0].installments).toBe(0);
  });

  it("recorrência soma só DESPESA, e a receita não encolhe o compromisso", () => {
    // Somar receita faria a barra de "o que já tem dono" encolher quando
    // entra dinheiro — o contrário do que ela mede
    const linha = buildCommitmentTimeline(
      [mes("2026-09", [item(-120), item(5000, "INCOME")])],
      null,
    );

    expect(linha[0].recurring).toBeCloseTo(120);
  });

  it("ocorrência já conciliada fica de fora — contá-la cobraria duas vezes", () => {
    const linha = buildCommitmentTimeline(
      [mes("2026-09", [item(-120), item(-80, "EXPENSE", true)])],
      null,
    );

    expect(linha[0].recurring).toBeCloseTo(120);
  });

  it("corta na janela de seis meses", () => {
    const meses = Array.from({ length: 12 }, (_, i) =>
      mes(`2026-${String(i + 1).padStart(2, "0")}`),
    );

    expect(buildCommitmentTimeline(meses, null)).toHaveLength(6);
  });

  it("sem previsão nenhuma, a linha é vazia", () => {
    expect(buildCommitmentTimeline([], overview([serie({})]))).toEqual([]);
  });

  it("sem parcelamento, a linha ainda existe com as recorrências", () => {
    const linha = buildCommitmentTimeline([mes("2026-09", [item(-120)])], null);

    expect(linha).toHaveLength(1);
    expect(linha[0].recurring).toBeCloseTo(120);
  });
});

describe("Aritmética de mês", () => {
  it("anda para frente e para trás", () => {
    expect(addMonths("2026-09", 1)).toBe("2026-10");
    expect(addMonths("2026-09", -1)).toBe("2026-08");
  });

  it("vira o ano nas duas direções", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-01", -13)).toBe("2024-12");
  });

  it("delta zero devolve o mesmo", () => {
    expect(addMonths("2026-09", 0)).toBe("2026-09");
  });

  it("entrada inválida devolve a entrada em vez de NaN", () => {
    expect(addMonths("não é mês", 1)).toBe("não é mês");
  });
});
