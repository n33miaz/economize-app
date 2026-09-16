import type {
  ConnectorAccount,
  InstallmentOverview,
  RecurringSeries,
} from "../../services/api";
import {
  buildUpcoming,
  describeDue,
  duePillLabel,
  estimateNextInvoice,
  looksLikeInvoicePayment,
} from "../upcoming";

// Uma quarta-feira no meio do mês, meio-dia local: nenhum teste aqui depende
// de fuso, e o relógio fixo é o que faz "em 5 dias" ser sempre o mesmo dia
const HOJE = new Date(2026, 8, 16, 12);

function serie(partial: Partial<RecurringSeries> = {}): RecurringSeries {
  return {
    id: "s1",
    merchantKey: "netflix",
    displayName: "Netflix",
    categoryId: null,
    flow: "EXPENSE",
    cadence: "MONTHLY",
    anchorDay: 20,
    dayTolerance: 2,
    amountType: "FIXED",
    expectedAmount: 55.9,
    occurrences: 6,
    firstSeenAt: "2026-03-20",
    lastSeenAt: "2026-08-20",
    active: true,
    dismissed: false,
    source: "DETECTED",
    startsAt: null,
    endsAt: null,
    nextDueDate: "2026-09-20",
    ...partial,
  };
}

function cartao(partial: Partial<ConnectorAccount> = {}): ConnectorAccount {
  return {
    id: "c1",
    name: "Ultravioleta ····1234",
    type: "CREDIT_CARD",
    institution: "Nubank",
    statementClosingDay: 22,
    statementDueDay: 1,
    linked: true,
    reportedBalance: -1830.4,
    reportedBalanceAt: "2026-09-16T09:00:00Z",
    creditLimit: 5000,
    creditLimitSharedWith: null,
    ...partial,
  } as ConnectorAccount;
}

const PARCELAS: InstallmentOverview = {
  totalSeries: 1,
  openSeries: 1,
  remainingTotal: 399.92,
  series: [
    {
      description: "Mercadolivre*Bwgshop",
      total: 3,
      seen: 1,
      remaining: 2,
      installmentAmount: 199.96,
      remainingAmount: 399.92,
      firstMonth: "2026-08",
      lastMonth: "2026-10",
      finished: false,
    },
  ],
};

describe("a vencer — recorrências", () => {
  it("separa esta semana do resto e ordena por data", () => {
    const { soon, later, count } = buildUpcoming({
      today: HOJE,
      accounts: [],
      installments: null,
      series: [
        serie({ id: "a", displayName: "Aluguel", nextDueDate: "2026-10-05", expectedAmount: 2450 }),
        serie({ id: "b", displayName: "Netflix", nextDueDate: "2026-09-20" }),
        serie({ id: "c", displayName: "Academia", nextDueDate: "2026-09-17", expectedAmount: 120 }),
      ],
    });

    expect(soon.map((i) => i.name)).toEqual(["Academia", "Netflix"]);
    expect(later.map((i) => i.name)).toEqual(["Aluguel"]);
    expect(count).toBe(3);
  });

  it("o total soma só o que tem valor; conta sem estimativa aparece 'a confirmar'", () => {
    const resultado = buildUpcoming({
      today: HOJE,
      accounts: [],
      installments: null,
      series: [
        serie({ id: "a", expectedAmount: 100 }),
        serie({ id: "b", displayName: "Luz", amountType: "VARIABLE", expectedAmount: null, nextDueDate: "2026-09-25" }),
      ],
    });

    expect(resultado.total).toBe(100);
    expect(resultado.unpricedCount).toBe(1);
    const luz = resultado.later.find((i) => i.name === "Luz");
    expect(luz?.amount).toBeNull();
    expect(luz?.countsInTotal).toBe(false);
  });

  it("ignora entrada, série inativa, descartada e o que está fora da janela", () => {
    const { count } = buildUpcoming({
      today: HOJE,
      accounts: [],
      installments: null,
      series: [
        serie({ id: "salario", flow: "INCOME", nextDueDate: "2026-09-25" }),
        serie({ id: "inativa", active: false }),
        serie({ id: "descartada", dismissed: true }),
        serie({ id: "longe", nextDueDate: "2026-10-30" }),
        serie({ id: "passado", nextDueDate: "2026-09-10" }),
        serie({ id: "sem-data", nextDueDate: null }),
      ],
    });

    expect(count).toBe(0);
  });

  it("os limites da janela são inclusivos: hoje e o 30º dia entram", () => {
    const { soon, later } = buildUpcoming({
      today: HOJE,
      accounts: [],
      installments: null,
      series: [
        serie({ id: "hoje", nextDueDate: "2026-09-16" }),
        serie({ id: "dia30", nextDueDate: "2026-10-16" }),
        serie({ id: "dia31", nextDueDate: "2026-10-17" }),
      ],
    });

    expect(soon.map((i) => i.key)).toEqual(["REC:hoje"]);
    expect(later.map((i) => i.key)).toEqual(["REC:dia30"]);
    expect(soon[0].daysUntil).toBe(0);
  });

  it("conta de consumo entra como estimada", () => {
    const { soon } = buildUpcoming({
      today: HOJE,
      accounts: [],
      installments: null,
      series: [serie({ amountType: "VARIABLE", expectedAmount: 180, nextDueDate: "2026-09-18" })],
    });

    expect(soon[0].estimated).toBe(true);
    expect(soon[0].target).toEqual({ route: "Recorrências", seriesId: "s1" });
  });
});

describe("a vencer — faturas estimadas pelo ciclo do cartão", () => {
  it("fecha dia 22 e vence dia 1: em 16/09 a próxima é a fatura ainda aberta, vencendo 01/10", () => {
    expect(estimateNextInvoice({ statementClosingDay: 22, statementDueDay: 1 }, HOJE)).toEqual({
      dueDate: "2026-10-01",
      closingDate: "2026-09-22",
      closed: false,
    });
  });

  it("fecha dia 5 e vence dia 15: em 10/09 a fatura já fechou e vence em 5 dias", () => {
    expect(
      estimateNextInvoice({ statementClosingDay: 5, statementDueDay: 15 }, new Date(2026, 8, 10, 12)),
    ).toEqual({ dueDate: "2026-09-15", closingDate: "2026-09-05", closed: true });
  });

  it("vencimento no dia do fechamento já pago: pula para o ciclo seguinte", () => {
    // Fechou 05/09, venceu 15/09; hoje é 16/09 → próxima fecha 05/10, vence 15/10
    expect(estimateNextInvoice({ statementClosingDay: 5, statementDueDay: 15 }, HOJE)).toEqual({
      dueDate: "2026-10-15",
      closingDate: "2026-10-05",
      closed: false,
    });
  });

  it("dia 31 num mês de 30 encosta no último dia", () => {
    expect(
      estimateNextInvoice({ statementClosingDay: 20, statementDueDay: 31 }, new Date(2026, 8, 21, 12)),
    ).toEqual({ dueDate: "2026-09-30", closingDate: "2026-09-20", closed: true });
  });

  it("só o vencimento informado: próxima ocorrência do dia", () => {
    expect(estimateNextInvoice({ statementClosingDay: null, statementDueDay: 10 }, HOJE)).toEqual({
      dueDate: "2026-10-10",
      closingDate: null,
      closed: false,
    });
  });

  it("sem dia de vencimento não há nada a estimar", () => {
    expect(estimateNextInvoice({ statementClosingDay: 22, statementDueDay: null }, HOJE)).toBeNull();
  });

  it("a fatura entra na lista com o devido de hoje, como estimativa, e leva ao cartão", () => {
    const { later, total } = buildUpcoming({
      today: HOJE,
      accounts: [cartao()],
      installments: null,
      series: [],
    });

    expect(later).toHaveLength(1);
    expect(later[0]).toMatchObject({
      kind: "INVOICE",
      amount: 1830.4,
      estimated: true,
      countsInTotal: true,
      dueDate: "2026-10-01",
      detail: "Fecha 22/09 · vence 01/10",
      target: { route: "Cartões", accountId: "c1" },
    });
    expect(total).toBeCloseTo(1830.4);
  });

  it("conta de banco não vira fatura, e cartão sem saldo informado entra 'a confirmar'", () => {
    const { later, total } = buildUpcoming({
      today: HOJE,
      accounts: [
        cartao({ id: "banco", type: "BANK", name: "Corrente" }),
        cartao({ id: "sem-saldo", reportedBalance: null }),
      ],
      installments: null,
      series: [],
    });

    expect(later.map((i) => i.key)).toEqual(["INV:sem-saldo"]);
    expect(later[0].amount).toBeNull();
    expect(total).toBe(0);
  });

  it("com recorrência de 'pagamento de fatura', a linha do cartão fica FORA do total", () => {
    // Mesmo dinheiro em duas linhas: a recorrência é a versão que a pessoa
    // reconhece, então é ela que soma
    const { total, count, later } = buildUpcoming({
      today: HOJE,
      accounts: [cartao()],
      installments: null,
      series: [
        serie({ id: "fat", displayName: "Pagamento fatura Nubank", nextDueDate: "2026-10-01", expectedAmount: 1800 }),
      ],
    });

    expect(count).toBe(2);
    expect(total).toBe(1800);
    const fatura = later.find((i) => i.kind === "INVOICE");
    expect(fatura?.countsInTotal).toBe(false);
  });

  it("reconhece pagamento de fatura pelo nome, e só por ele", () => {
    expect(looksLikeInvoicePayment("Pagamento fatura Nubank")).toBe(true);
    expect(looksLikeInvoicePayment("Cartão Itaú")).toBe(true);
    expect(looksLikeInvoicePayment("Cartao Itau")).toBe(true);
    expect(looksLikeInvoicePayment("Netflix")).toBe(false);
    expect(looksLikeInvoicePayment("Faturamento consultoria")).toBe(false);
  });
});

describe("a vencer — parcelas", () => {
  it("as parcelas viram UMA linha agregada e nunca entram no total", () => {
    const resultado = buildUpcoming({
      today: HOJE,
      accounts: [],
      installments: PARCELAS,
      series: [serie({ expectedAmount: 100 })],
    });

    expect(resultado.installments).toEqual({ amount: 199.96, count: 1 });
    expect(resultado.total).toBe(100);
  });

  it("sem parcelamento aberto a linha some", () => {
    expect(
      buildUpcoming({ today: HOJE, accounts: [], installments: null, series: [] }).installments,
    ).toBeNull();
  });
});

describe("a vencer — frases", () => {
  it("fala em hoje, amanhã e dias", () => {
    expect(describeDue(0, "2026-09-16")).toBe("Vence hoje, 16 de set");
    expect(describeDue(1, "2026-09-17")).toBe("Vence amanhã, 17 de set");
    expect(describeDue(5, "2026-09-21")).toBe("Vence em 5 dias, 21 de set");
  });

  it("a pílula é curta: hoje, amanhã ou dd/mm", () => {
    expect(duePillLabel({ daysUntil: 0, dueDate: "2026-09-16" })).toBe("hoje");
    expect(duePillLabel({ daysUntil: 1, dueDate: "2026-09-17" })).toBe("amanhã");
    expect(duePillLabel({ daysUntil: 9, dueDate: "2026-09-25" })).toBe("25/09");
  });

  /**
   * O defeito visto na tela em 16/09/2026: com o cartão cadastrado, a linha da
   * fatura já cobra a parcela inteira. A recorrência "MAGAZINE LUIZA - Parcela
   * 3/6" ao lado dela somava a MESMA parcela outra vez — R$ 3.414,57 onde o
   * certo eram R$ 3.002,07.
   */
  it("parcela de cartão não aparece ao lado da fatura que já a cobra", () => {
    const resultado = buildUpcoming({
      series: [
        serie({ id: "r1", displayName: "Aluguel", expectedAmount: 1450, nextDueDate: "2026-09-25" }),
        serie({
          id: "r2",
          displayName: "MAGAZINE LUIZA - Parcela 3/6",
          expectedAmount: 412.5,
          nextDueDate: "2026-09-20",
        }),
      ],
      accounts: [cartao({ reportedBalance: -1432.17 })],
      installments: null,
      today: new Date("2026-09-16T12:00:00Z"),
    });

    const nomes = [...resultado.soon, ...resultado.later].map((i) => i.name);
    expect(nomes).not.toContain("MAGAZINE LUIZA - Parcela 3/6");
    expect(nomes).toContain("Aluguel");
  });

  /** Sem cartão cadastrado não há fatura para engolir a parcela: ela fica. */
  it("sem fatura para contê-la, a parcela continua na lista", () => {
    const resultado = buildUpcoming({
      series: [
        serie({
          id: "r2",
          displayName: "MAGAZINE LUIZA - Parcela 3/6",
          expectedAmount: 412.5,
          nextDueDate: "2026-09-20",
        }),
      ],
      accounts: [],
      installments: null,
      today: new Date("2026-09-16T12:00:00Z"),
    });

    expect([...resultado.soon, ...resultado.later].map((i) => i.name)).toContain(
      "MAGAZINE LUIZA - Parcela 3/6",
    );
  });
});
