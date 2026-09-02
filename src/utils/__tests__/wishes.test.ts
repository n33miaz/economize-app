import {
  describeCommitted,
  describeHourlyRate,
  describePace,
  describeWhatIf,
  describeSalaryTiming,
  formatDueDate,
  formatHours,
  formatWorkTime,
  gapPrompt,
  incomeKindLabel,
  statusLabel,
  translateWishError,
  wishProgress,
} from "../wishes";

import type { Wish, WishBaseline, WishProjection } from "../../services/api";

const projecao = (over: Partial<WishProjection> = {}): WishProjection => ({
  remaining: 18000,
  hoursOfWork: null,
  workDays: null,
  workMonths: null,
  workYears: null,
  monthsToAfford: null,
  estimatedDate: null,
  installments: null,
  maxInstallment: null,
  achieved: false,
  whatIfs: [],
  ...over,
});

const desejo = (over: Partial<Wish> = {}): Wish => ({
  id: "w1",
  name: "Moto",
  targetAmount: 18000,
  savedAmount: 0,
  categoryId: null,
  status: "WISH",
  targetDate: null,
  note: null,
  purchasedAt: null,
  purchaseTransactionId: null,
  projection: projecao(),
  ...over,
});

const baseline = (over: Partial<WishBaseline> = {}): WishBaseline => ({
  workIncome: 4400,
  hourlyRate: 25.39,
  hoursPerMonth: 173.33,
  monthlyLeftover: 900,
  monthlyExpense: 3500,
  cyclesConsidered: 3,
  gaps: [],
  ...over,
});

describe("formatHours", () => {
  it("acima de cem horas some com a casa decimal", () => {
    // "709,1 h" e "709 h" informam o mesmo; o redondo se guarda de cabeça
    expect(formatHours(709.1)).toBe("709 h");
  });

  it("abaixo de cem mantém a precisão que ainda importa", () => {
    expect(formatHours(12.5)).toBe("12,5 h");
  });

  it("nulo continua nulo — não vira zero hora", () => {
    expect(formatHours(null)).toBeNull();
  });
});

describe("formatWorkTime", () => {
  const tempo = (
    workDays: number | null,
    workMonths: number | null,
    workYears: number | null,
  ) => formatWorkTime({ workDays, workMonths, workYears });

  it("sobe a escada até onde a unidade ainda diz algo", () => {
    // A moto de R$ 18.000 de quem ganha R$ 4.400
    expect(tempo(88.6, 4.1, 0.3)).toBe("88,6 dias · 4,1 meses de trabalho");
  });

  it("um desejo que atravessa anos passa a contá-los", () => {
    // A casa de R$ 320.000 de quem ganha R$ 4.400, conforme o servidor
    // responde: aqui o ano é a única unidade que ainda comunica
    expect(tempo(1575.7, 72.7, 6.1)).toBe(
      "1.576 dias · 72,7 meses · 6,1 anos de trabalho",
    );
  });

  it("desejo pequeno fica só nos dias", () => {
    // "0,1 meses" ao lado de "1,5 dias" não informa, atrapalha
    expect(tempo(1.5, 0.1, 0)).toBe("1,5 dias de trabalho");
  });

  it("concorda o singular em cada unidade", () => {
    expect(tempo(1, 1, 1)).toBe("1 dia · 1 mês · 1 ano de trabalho");
  });

  it("sem jornada declarada não inventa tempo nenhum", () => {
    expect(tempo(null, null, null)).toBeNull();
  });
});

describe("wishProgress", () => {
  it("mede o quanto já foi guardado", () => {
    expect(wishProgress(desejo({ savedAmount: 4500 }))).toBeCloseTo(0.25);
  });

  it("nunca passa de um nem cai abaixo de zero", () => {
    expect(wishProgress(desejo({ savedAmount: 90000 }))).toBe(1);
    expect(wishProgress(desejo({ targetAmount: 0 }))).toBe(0);
  });
});

describe("describePace", () => {
  it("diz o prazo e a parcela que a sobra aguenta", () => {
    const texto = describePace(
      projecao({ monthsToAfford: 20, maxInstallment: 900 }),
    );
    expect(texto).toContain("20 meses");
    expect(texto).toContain("900");
  });

  it("um mês não vira 1 meses", () => {
    expect(
      describePace(projecao({ monthsToAfford: 1, maxInstallment: 900 })),
    ).toContain("Fecha neste mês");
  });

  it("sem prazo devolve nulo para a tela mostrar a lacuna no lugar", () => {
    expect(describePace(projecao())).toBeNull();
  });

  it("já alcançado tem frase própria", () => {
    expect(describePace(projecao({ achieved: true }))).toContain("já tem");
  });
});

describe("describeWhatIf", () => {
  it("fala em reais, não em porcentagem", () => {
    const texto = describeWhatIf({
      monthlyCut: 400,
      months: 9,
      monthsEarlier: 3,
    });
    // ninguém corta 12% do mês; todo mundo entende cortar R$ 400
    expect(texto).toContain("400");
    expect(texto).toContain("3 meses antes");
  });

  it("concorda o singular do mês", () => {
    expect(
      describeWhatIf({ monthlyCut: 100, months: 11, monthsEarlier: 1 }),
    ).toContain("1 mês antes");
  });

  it("sem prazo de referência mostra o prazo que o corte cria", () => {
    // é o caso de quem não tem sobra nenhuma: não há "antes" para comparar
    expect(
      describeWhatIf({ monthlyCut: 320, months: 17, monthsEarlier: null }),
    ).toContain("chega em 17 meses");
  });
});

describe("gapPrompt", () => {
  it("toda lacuna vira convite com motivo e ação", () => {
    for (const gap of [
      "WORK_PROFILE",
      "CONFIRMED_INCOME",
      "HISTORY",
      "NO_LEFTOVER",
    ] as const) {
      const prompt = gapPrompt(gap);
      expect(prompt.title.length).toBeGreaterThan(0);
      expect(prompt.reason.length).toBeGreaterThan(0);
      expect(prompt.action.length).toBeGreaterThan(0);
    }
  });

  it("explica por que a renda precisa ser confirmada", () => {
    // sem o motivo, o pedido lê como burocracia e a pessoa ignora
    expect(gapPrompt("CONFIRMED_INCOME").reason).toContain("palpite");
  });
});

describe("rótulos", () => {
  it("cobre todos os estados de um desejo", () => {
    expect(statusLabel("WISH")).toBe("Quero");
    expect(statusLabel("GOAL")).toBe("Guardando");
    expect(statusLabel("PURCHASED")).toBe("Comprado");
    expect(statusLabel("ARCHIVED")).toBe("Arquivado");
  });

  it("cobre todos os tipos de renda", () => {
    expect(incomeKindLabel("SALARY")).toBe("Salário");
    expect(incomeKindLabel("MEAL_VOUCHER")).toBe("Vale-refeição");
    expect(incomeKindLabel("FOOD_VOUCHER")).toBe("Vale-alimentação");
    expect(incomeKindLabel("ADVANCE")).toBe("Adiantamento");
    expect(incomeKindLabel("OTHER")).toBe("Outra renda");
  });
});

describe("describeHourlyRate", () => {
  it("mostra quanto vale a hora", () => {
    expect(describeHourlyRate(baseline())).toContain("25,39");
  });

  it("cala enquanto não souber — quem fala é a lacuna", () => {
    expect(describeHourlyRate(baseline({ hourlyRate: null }))).toBeNull();
  });
});

describe("translateWishError", () => {
  const erro = (status: number, detail: string) => ({
    response: { status, data: { detail } },
  });

  it("troca a mensagem da API pela frase de quem usa", () => {
    expect(
      translateWishError(
        erro(400, "Valor já guardado não pode ser maior que o valor do desejo"),
        "x",
      ),
    ).toContain("não pode passar do valor");
  });

  it("400 sem tradução aproveita a mensagem do servidor, que já é em português", () => {
    expect(translateWishError(erro(400, "Alguma regra nova"), "genérico")).toBe(
      "Alguma regra nova",
    );
  });

  it("500 nunca vaza para a tela", () => {
    // erro cru de servidor não diz nada ao usuário e assusta
    expect(
      translateWishError(erro(500, "NullPointerException at line 42"), "Falhou"),
    ).toBe("Falhou");
  });

  it("erro de rede sem corpo cai no texto de reserva", () => {
    expect(translateWishError(new Error("Network Error"), "Falhou")).toBe(
      "Falhou",
    );
  });
});

describe("formatDueDate", () => {
  it("mostra dia e mês, que é o que cabe na lista", () => {
    expect(formatDueDate("2026-09-10")).toBe("10/09");
  });
});

describe("describeSalaryTiming", () => {
  it("no dia do pagamento diz que cai hoje", () => {
    // dizer "faltam 30 dias" (a próxima ocorrência) seria o oposto da verdade
    expect(describeSalaryTiming(0, "2026-09-05")).toBe("Cai hoje (05/09)");
  });

  it("concorda o singular de amanhã", () => {
    expect(describeSalaryTiming(1, "2026-09-05")).toBe("Cai amanhã (05/09)");
  });

  it("conta os dias que faltam", () => {
    expect(describeSalaryTiming(5, "2026-09-05")).toBe("Cai em 5 dias (05/09)");
  });

  it("sem salário conhecido não inventa data", () => {
    expect(describeSalaryTiming(null, null)).toBeNull();
  });
});

describe("describeCommitted", () => {
  it("resume o fim do mês numa linha", () => {
    const texto = describeCommitted({
      salaryKnown: true,
      expectedSalary: 4400,
      committedAfterSalary: 2010,
      free: 2390,
    });
    expect(texto).toContain("2.010,00");
    expect(texto).toContain("2.390,00");
  });

  it("sem valor de salário fala só do comprometido", () => {
    // "sobram X" exigiria saber quanto entra; sem isso não há resposta honesta
    const texto = describeCommitted({
      salaryKnown: true,
      expectedSalary: null,
      committedAfterSalary: 1800,
      free: null,
    });
    expect(texto).toContain("1.800,00");
    expect(texto).not.toContain("sobram");
  });

  it("sem salário cadastrado vira convite", () => {
    expect(
      describeCommitted({
        salaryKnown: false,
        expectedSalary: null,
        committedAfterSalary: 0,
        free: null,
      }),
    ).toContain("Cadastre seu salário");
  });
});
