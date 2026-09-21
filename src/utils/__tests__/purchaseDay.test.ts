import type {
  IncomePattern,
  IncomeSourcePattern,
  PurchaseAdvice,
} from "../../services/api";
import type { LastPurchaseAdvice } from "../../store/preferencesStore";
import {
  adviceChanged,
  basisFooter,
  cadenceLabel,
  confidenceLabel,
  describeChange,
  formatRange,
  fundingNoun,
  fundingSourceOf,
  homeLine,
  insufficientHistoryText,
  patternOriginLabel,
  paymentLabel,
  preferenceSummary,
} from "../purchaseDay";

/**
 * As frases do melhor dia de compra (EC-237) — sem tela, direto nas funções
 * puras. É onde a maior parte da lógica do card, da linha da Home e da folha
 * de preferência vive de verdade; testar aqui é testar sem montar componente.
 */

function advice(over: Partial<PurchaseAdvice> = {}): PurchaseAdvice {
  return {
    cadence: "MONTHLY",
    cadenceOrigin: "MEASURED",
    paymentMode: "CASH",
    bestDay: "2026-10-03",
    bestDayWeekday: "SATURDAY",
    fundingSource: "MEAL_VOUCHER",
    fundingDate: "2026-09-29",
    mustLastUntil: "2026-11-09",
    daysToCover: 37,
    card: null,
    weeklyDay: null,
    nextDates: [],
    confidence: "MEDIUM",
    explanation: {
      headline: "Melhor dia para as compras: sáb 03/10",
      lines: [],
    },
    basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" },
    ...over,
  };
}

function source(over: Partial<IncomeSourcePattern> = {}): IncomeSourcePattern {
  return {
    incomeSourceId: "src-1",
    seriesId: "ser-1",
    kind: "MEAL_VOUCHER",
    name: "Flash — Vale refeição",
    confirmed: true,
    origin: "MEASURED",
    pattern: {
      rule: "BUSINESS_DAY_FROM_END",
      median: 2,
      min: 1,
      max: 3,
      monthsObserved: 3,
      firstOccurrence: "2026-06-25",
      lastOccurrence: "2026-08-28",
      expectedAmount: 735,
      confidence: "MEDIUM",
      label: "nos últimos dias úteis do mês",
    },
    occurrences: [],
    relation: null,
    upcoming: [
      {
        month: "2026-09",
        expected: "2026-09-29",
        earliest: "2026-09-25",
        latest: "2026-09-30",
        adjusted: false,
      },
    ],
    ...over,
  };
}

function pattern(over: Partial<IncomePattern> = {}): IncomePattern {
  return {
    status: "READY",
    message: null,
    today: "2026-09-15",
    sources: [source()],
    preference: null,
    inferred: null,
    advice: advice(),
    ...over,
  };
}

describe("patternOriginLabel", () => {
  it("MEASURED veste o selo 'medido'", () => {
    const rotulo = patternOriginLabel("MEASURED");
    expect(rotulo.kind).toBe("measured");
    expect(rotulo.badge).toBe("medido");
    expect(rotulo.spoken).toBe("medido no seu extrato");
  });

  it("INFORMED veste o selo 'informado' (mesmo vocabulário do EC-206)", () => {
    const rotulo = patternOriginLabel("INFORMED");
    expect(rotulo.kind).toBe("declared");
    expect(rotulo.badge).toBe("informado");
    expect(rotulo.spoken).toBe("informado por você");
  });
});

describe("confidenceLabel", () => {
  it.each([
    ["HIGH", "confiança alta"],
    ["MEDIUM", "confiança média"],
    ["LOW", "confiança baixa"],
  ] as const)("%s -> %s", (confianca, esperado) => {
    expect(confidenceLabel(confianca)).toBe(esperado);
  });

  it("null e undefined não têm frase", () => {
    expect(confidenceLabel(null)).toBeNull();
    expect(confidenceLabel(undefined)).toBeNull();
  });
});

describe("basisFooter", () => {
  it("junta meses e confiança", () => {
    expect(basisFooter(3, "MEDIUM")).toBe("3 meses observados · confiança média");
  });

  it("1 mês fica no singular", () => {
    expect(basisFooter(1, null)).toBe("1 mês observado");
  });

  it("sem meses e sem confiança não tem rodapé", () => {
    expect(basisFooter(0, null)).toBeNull();
    expect(basisFooter(null, undefined)).toBeNull();
  });

  it("só a confiança, sem meses observados", () => {
    expect(basisFooter(null, "LOW")).toBe("confiança baixa");
  });
});

describe("formatRange", () => {
  it("extremos no mesmo mês: 'entre DD e DD/MM'", () => {
    expect(formatRange("2026-10-06", "2026-10-08")).toBe("entre 06 e 08/10");
  });

  it("extremos atravessando a virada do mês", () => {
    expect(formatRange("2026-09-29", "2026-10-02")).toBe(
      "entre 29/09 e 02/10",
    );
  });

  it("sem faixa (um dia só): 'em DD/MM'", () => {
    expect(formatRange("2026-10-07", "2026-10-07")).toBe("em 07/10");
  });

  it("sem earliest ou latest não há faixa", () => {
    expect(formatRange(null, "2026-10-08")).toBeNull();
    expect(formatRange("2026-10-06", undefined)).toBeNull();
  });
});

describe("fundingNoun", () => {
  it("nomeia cada tipo de fonte", () => {
    expect(fundingNoun("SALARY")).toBe("salário");
    expect(fundingNoun("MEAL_VOUCHER")).toBe("vale");
    expect(fundingNoun("FOOD_VOUCHER")).toBe("vale");
    expect(fundingNoun("ADVANCE")).toBe("adiantamento");
  });

  it("sem tipo reconhecido, cai em 'dinheiro'", () => {
    expect(fundingNoun("OTHER")).toBe("dinheiro");
    expect(fundingNoun(null)).toBe("dinheiro");
    expect(fundingNoun(undefined)).toBe("dinheiro");
  });
});

describe("fundingSourceOf", () => {
  it("acha a fonte pelo fundingSource da recomendação", () => {
    const p = pattern({
      sources: [
        source({ kind: "SALARY", incomeSourceId: "sal" }),
        source({ kind: "MEAL_VOUCHER", incomeSourceId: "vr" }),
      ],
      advice: advice({ fundingSource: "MEAL_VOUCHER" }),
    });

    expect(fundingSourceOf(p)?.incomeSourceId).toBe("vr");
  });

  it("sem fundingSource reconhecível, cai na primeira fonte com queda futura", () => {
    const p = pattern({
      sources: [
        source({ kind: "SALARY", incomeSourceId: "sal" }),
      ],
      advice: advice({ fundingSource: null }),
    });

    expect(fundingSourceOf(p)?.incomeSourceId).toBe("sal");
  });

  it("nenhuma fonte com queda futura: null, nunca inventa uma", () => {
    const p = pattern({
      sources: [source({ upcoming: [] })],
      advice: advice({ fundingSource: null }),
    });

    expect(fundingSourceOf(p)).toBeNull();
  });
});

describe("homeLine", () => {
  it("sem padrão nenhum, não há linha", () => {
    expect(homeLine(null)).toBeNull();
  });

  it("status diferente de READY não tem linha (a Home não explica ausência)", () => {
    expect(homeLine(pattern({ status: "INSUFFICIENT_HISTORY", advice: null }))).toBeNull();
    expect(homeLine(pattern({ status: "NO_INCOME", advice: null }))).toBeNull();
  });

  it("READY com fonte: dia e o motivo dele", () => {
    const linha = homeLine(pattern());
    expect(linha).not.toBeNull();
    expect(linha?.day).toBe("sáb 03/10");
    expect(linha?.spokenDay).toBe("2026-10-03");
    expect(linha?.detail).toBe("o vale cai por volta de 29/09");
  });

  it("sem fonte casando, usa o fundingDate da própria recomendação", () => {
    const linha = homeLine(
      pattern({
        sources: [],
        advice: advice({ fundingSource: "SALARY", fundingDate: "2026-10-07" }),
      }),
    );
    expect(linha?.detail).toBe("o salário cai por volta de 07/10");
  });
});

describe("adviceChanged", () => {
  const anterior: LastPurchaseAdvice = {
    bestDay: "2026-09-27",
    basisLastOccurrence: "2026-07-29",
    seenAt: "2026-09-01T00:00:00.000Z",
  };

  it("sem recomendação anterior ou atual, nada mudou", () => {
    expect(adviceChanged(null, advice())).toBeNull();
    expect(adviceChanged(anterior, undefined)).toBeNull();
  });

  it("mesmo dia sugerido: nada para avisar", () => {
    expect(
      adviceChanged(
        { ...anterior, bestDay: "2026-10-03" },
        advice({ bestDay: "2026-10-03" }),
      ),
    ).toBeNull();
  });

  it("dia mudou mas sem queda nova sustentando: não afirma o gatilho", () => {
    expect(
      adviceChanged(anterior, advice({ bestDay: "2026-10-03", basis: { monthsObserved: 3, lastOccurrence: "2026-07-29" } })),
    ).toBeNull();
  });

  it("dia mudou E uma queda nova entrou: aí sim é o aviso de recálculo", () => {
    const mudanca = adviceChanged(
      anterior,
      advice({ bestDay: "2026-10-03", basis: { monthsObserved: 3, lastOccurrence: "2026-08-28" } }),
    );
    expect(mudanca).toEqual({
      from: "2026-09-27",
      to: "2026-10-03",
      trigger: "2026-08-28",
    });
  });
});

describe("describeChange", () => {
  it("com gatilho, nomeia a fonte e as duas datas", () => {
    const frase = describeChange(
      { from: "2026-09-27", to: "2026-10-03", trigger: "2026-08-28" },
      "MEAL_VOUCHER",
    );
    expect(frase).toBe(
      "Recalculado depois que o vale de 28/08 entrou: o dia sugerido passou de dom 27/09 para sáb 03/10.",
    );
  });

  it("sem gatilho (servidor antigo), fala em 'extrato novo'", () => {
    const frase = describeChange(
      { from: "2026-09-27", to: "2026-10-03", trigger: null },
      "SALARY",
    );
    expect(frase).toContain("com o extrato novo");
  });
});

describe("insufficientHistoryText", () => {
  it("a mensagem do servidor vence, quando existe", () => {
    expect(
      insufficientHistoryText(pattern({ message: "Vi só 1 pagamento; a partir de 3 meses eu digo o padrão." })),
    ).toBe("Vi só 1 pagamento; a partir de 3 meses eu digo o padrão.");
  });

  it("sem mensagem e nenhum pagamento visto", () => {
    expect(
      insufficientHistoryText(
        pattern({ message: null, sources: [source({ pattern: null })] }),
      ),
    ).toBe(
      "Ainda não vi nenhum pagamento no seu extrato. A partir de 3 meses eu digo o padrão.",
    );
  });

  it("sem mensagem e alguns meses vistos, no singular e no plural", () => {
    expect(
      insufficientHistoryText(
        pattern({
          message: null,
          sources: [source({ pattern: { ...source().pattern!, monthsObserved: 1 } })],
        }),
      ),
    ).toBe("Vi só 1 pagamento; a partir de 3 meses eu digo o padrão.");

    expect(
      insufficientHistoryText(
        pattern({
          message: null,
          sources: [source({ pattern: { ...source().pattern!, monthsObserved: 2 } })],
        }),
      ),
    ).toBe("Vi só 2 pagamentos; a partir de 3 meses eu digo o padrão.");
  });
});

describe("cadenceLabel", () => {
  it("traduz a cadência", () => {
    expect(cadenceLabel("MONTHLY")).toBe("Mensal");
    expect(cadenceLabel("WEEKLY")).toBe("Semanal");
  });
});

describe("paymentLabel", () => {
  it("cartão com nome", () => {
    expect(paymentLabel("CARD", "Nubank")).toBe("no Nubank");
  });

  it("cartão sem nome (conta ainda não resolvida)", () => {
    expect(paymentLabel("CARD", null)).toBe("no cartão");
  });

  it("dinheiro da conta é o padrão", () => {
    expect(paymentLabel("CASH")).toBe("no dinheiro da conta");
    expect(paymentLabel(null)).toBe("no dinheiro da conta");
    expect(paymentLabel(undefined)).toBe("no dinheiro da conta");
  });
});

describe("preferenceSummary", () => {
  it("preferência declarada: mensal, fim de semana, dinheiro da conta", () => {
    expect(
      preferenceSummary(
        {
          cadence: "MONTHLY",
          weekendPreferred: true,
          paymentMode: "CASH",
          cardAccountId: null,
          updatedAt: "2026-09-01T00:00:00Z",
        },
        null,
      ),
    ).toBe("Mensal · fim de semana · no dinheiro da conta");
  });

  it("preferência declarada com cartão e sem fim de semana", () => {
    expect(
      preferenceSummary(
        {
          cadence: "WEEKLY",
          weekendPreferred: false,
          paymentMode: "CARD",
          cardAccountId: "acc-1",
          updatedAt: "2026-09-01T00:00:00Z",
        },
        null,
        "Nubank",
      ),
    ).toBe("Semanal · no Nubank");
  });

  it("sem preferência salva, mostra a dedução do extrato com os meses", () => {
    expect(
      preferenceSummary(null, {
        cadence: "MONTHLY",
        purchasesPerMonth: 1.2,
        weekendShare: 0.83,
        daysAfterLanding: 2,
        monthsObserved: 3,
        confidence: "MEDIUM",
        origin: "MEASURED",
      }),
    ).toBe("Deduzido do extrato: mensal · fim de semana (3 meses de extrato)");
  });

  it("dedução com 1 mês de extrato, no singular", () => {
    expect(
      preferenceSummary(null, {
        cadence: "WEEKLY",
        purchasesPerMonth: 4,
        weekendShare: 0.1,
        daysAfterLanding: 1,
        monthsObserved: 1,
        confidence: "LOW",
        origin: "MEASURED",
      }),
    ).toBe("Deduzido do extrato: semanal (1 mês de extrato)");
  });

  it("nem preferência nem dedução: convite a declarar", () => {
    expect(preferenceSummary(null, null)).toBe(
      "Diga se compra por mês ou por semana, e com o quê",
    );
  });
});
