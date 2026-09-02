import type {
  ForecastMonth,
  RecurringSeries,
} from "../../services/api";
import {
  buildCreatePayload,
  buildUpdatePayload,
  cadenceDetailLabel,
  cadenceSpokenLabel,
  cadenceUsesAnchorDay,
  describeConflict,
  describeDetection,
  deriveMonthState,
  dueSummary,
  emptyFormValues,
  firstRiskMonth,
  forecastItemWhen,
  forecastPeriodKey,
  forecastPeriodLabel,
  formValuesFromSeries,
  formatDateInput,
  formatDueDate,
  isMonthAtRisk,
  monthStateLabel,
  parseAmountInput,
  parseDateInput,
  parseIsoDate,
  readProblem,
  splitForecastMonth,
  translateRecurrenceError,
  upcomingCommitment,
  validityLabel,
  type RecurrenceFormValues,
} from "../recurrence";

function makeSeries(overrides: Partial<RecurringSeries> = {}): RecurringSeries {
  return {
    id: "s-1",
    merchantKey: "spotify",
    displayName: "Spotify",
    categoryId: null,
    flow: "EXPENSE",
    cadence: "MONTHLY",
    anchorDay: 30,
    dayTolerance: 3,
    amountType: "FIXED",
    expectedAmount: 21.9,
    occurrences: 12,
    firstSeenAt: "2025-08-30T00:00:00Z",
    lastSeenAt: "2026-07-30T00:00:00Z",
    active: true,
    dismissed: false,
    source: "DETECTED",
    startsAt: null,
    endsAt: null,
    nextDueDate: "2026-08-30",
    ...overrides,
  };
}

function makeForm(
  overrides: Partial<RecurrenceFormValues> = {},
): RecurrenceFormValues {
  return {
    displayName: "Conta de luz",
    flow: "EXPENSE",
    cadence: "MONTHLY",
    anchorDay: "10",
    expectedAmount: "189,90",
    amountType: "VARIABLE",
    categoryId: null,
    startsAt: "01/09/2026",
    endsAt: "",
    ...overrides,
  };
}

describe("rótulos de cadência", () => {
  it("traduz a cadência para português com o dia âncora", () => {
    expect(cadenceDetailLabel("MONTHLY", 30)).toBe("Mensal · dia 30");
    expect(cadenceDetailLabel("QUARTERLY", 5)).toBe("Trimestral · dia 5");
  });

  it("a semanal não tem dia do mês e assume a projeção de ~4,3×/mês", () => {
    // a API projeta 4,33 ocorrências/mês — o rótulo é honesto sobre a conta
    expect(cadenceDetailLabel("WEEKLY", 12)).toBe("Semanal · ~4,3×/mês");
    expect(cadenceUsesAnchorDay("WEEKLY")).toBe(false);
    expect(cadenceUsesAnchorDay("MONTHLY")).toBe(true);
    expect(cadenceUsesAnchorDay("QUARTERLY")).toBe(true);
  });

  it("tem versão pronunciável do rótulo para o leitor de tela", () => {
    expect(cadenceSpokenLabel("WEEKLY", null)).toBe(
      "Semanal, cerca de 4,3 vezes por mês",
    );
    // nas cadências ancoradas o rótulo visual já é pronunciável
    expect(cadenceSpokenLabel("MONTHLY", 30)).toBe("Mensal · dia 30");
    expect(cadenceSpokenLabel("IRREGULAR", null)).toBe("Sem ritmo definido");
  });

  it("nomeia a cadência sem ciclo em vez de mostrar o enum", () => {
    expect(cadenceDetailLabel("IRREGULAR", null)).toBe("Sem ritmo definido");
  });

  it("separa recebido de pago no estado do mês", () => {
    expect(monthStateLabel("INCOME", true)).toBe("Já recebido");
    expect(monthStateLabel("EXPENSE", true)).toBe("Já pago");
    expect(monthStateLabel("EXPENSE", false)).toBe("Previsto este mês");
  });
});

describe("datas", () => {
  it("interpreta a data ISO no fuso local (e não em UTC)", () => {
    const parsed = parseIsoDate("2026-09-12");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(8);
    expect(parsed?.getDate()).toBe(12);
  });

  it("recusa data que não existe no calendário", () => {
    expect(parseIsoDate("2026-02-31")).toBeNull();
    expect(parseDateInput("31/02/2026")).toBeNull();
  });

  it("aceita as duas grafias no campo de texto", () => {
    expect(parseDateInput("01/09/2026")).toBe("2026-09-01");
    expect(parseDateInput("1/9/2026")).toBe("2026-09-01");
    expect(parseDateInput("2026-09-01")).toBe("2026-09-01");
    expect(parseDateInput("  ")).toBeNull();
  });

  it("formata o vencimento e a vigência para leitura", () => {
    expect(formatDueDate("2026-09-12")).toBe("12 de set");
    expect(formatDateInput("2026-09-12")).toBe("12/09/2026");
    expect(validityLabel("2026-09-01", "2027-09-01")).toBe(
      "De 01/09/2026 até 01/09/2027",
    );
    expect(validityLabel("2026-09-01", null)).toBe("A partir de 01/09/2026");
    expect(validityLabel(null, null)).toBeNull();
  });

  it("descreve o vencimento em relação a hoje", () => {
    const today = new Date(2026, 7, 15);
    expect(dueSummary("2026-08-15", today)).toBe("Vence hoje, 15 de ago");
    expect(dueSummary("2026-08-16", today)).toBe("Vence amanhã, 16 de ago");
    expect(dueSummary("2026-08-20", today)).toBe("Vence em 5 dias, 20 de ago");
    expect(dueSummary("2026-08-12", today)).toBe(
      "Era esperada em 12 de ago — 3 dias atrás",
    );
    expect(dueSummary(null, today)).toBe("Sem próximo vencimento previsto");
  });
});

describe("leitura de valor", () => {
  it("entende o formato pt-BR digitado ou colado", () => {
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("R$ 1.234,56")).toBe(1234.56);
    expect(parseAmountInput("21,90")).toBe(21.9);
    expect(parseAmountInput("1234.56")).toBe(1234.56);
  });

  it("devolve null no campo vazio em vez de virar zero", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("R$ ")).toBeNull();
  });

  it("lê ponto em grupos de 3 sem vírgula como milhar, não como decimal", () => {
    // "2.500" é dois mil e quinhentos em pt-BR — ler 2,5 gravava 1000× menos
    expect(parseAmountInput("2.500")).toBe(2500);
    expect(parseAmountInput("R$ 12.345")).toBe(12345);
    expect(parseAmountInput("1.234.567")).toBe(1234567);
    // ponto que não forma grupo de milhar segue sendo decimal de quem cola
    expect(parseAmountInput("2.5")).toBe(2.5);
    expect(parseAmountInput("1234.56")).toBe(1234.56);
  });
});

describe("montagem do payload de criação", () => {
  it("monta o agendamento mensal com dia âncora e vigência", () => {
    const result = buildCreatePayload(
      makeForm({ categoryId: "cat-1", endsAt: "01/09/2027" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({
      displayName: "Conta de luz",
      flow: "EXPENSE",
      cadence: "MONTHLY",
      anchorDay: 10,
      expectedAmount: 189.9,
      amountType: "VARIABLE",
      categoryId: "cat-1",
      startsAt: "2026-09-01",
      endsAt: "2027-09-01",
    });
  });

  it("não manda dia âncora em cadência semanal — o servidor recusaria", () => {
    const result = buildCreatePayload(
      makeForm({ cadence: "WEEKLY", anchorDay: "" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.anchorDay).toBeUndefined();
    expect(result.payload.cadence).toBe("WEEKLY");
  });

  it("cobra o dia âncora nas cadências ancoradas antes de chamar a API", () => {
    const result = buildCreatePayload(makeForm({ anchorDay: "" }));
    expect(result).toEqual({
      ok: false,
      message: "Informe o dia do mês em que a cobrança cai.",
    });
  });

  it("recusa dia âncora fora de 1 a 31", () => {
    const result = buildCreatePayload(makeForm({ anchorDay: "42" }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("entre 1 e 31");
  });

  it("recusa fim anterior ao início", () => {
    const result = buildCreatePayload(
      makeForm({ startsAt: "01/09/2026", endsAt: "31/08/2026" }),
    );
    expect(result).toEqual({
      ok: false,
      message: "A data de fim não pode ser anterior à data de início.",
    });
  });

  it("exige nome e valor positivo", () => {
    expect(buildCreatePayload(makeForm({ displayName: "   " }))).toEqual({
      ok: false,
      message: "Dê um nome à recorrência.",
    });
    expect(buildCreatePayload(makeForm({ expectedAmount: "" }))).toEqual({
      ok: false,
      message: "Informe o valor esperado.",
    });
    expect(buildCreatePayload(makeForm({ expectedAmount: "0" }))).toEqual({
      ok: false,
      message: "O valor esperado precisa ser maior que zero.",
    });
  });

  it("omite campos vazios em vez de mandar string vazia", () => {
    const result = buildCreatePayload(
      makeForm({ startsAt: "", endsAt: "", categoryId: null }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.startsAt).toBeUndefined();
    expect(result.payload.endsAt).toBeUndefined();
    expect(result.payload.categoryId).toBeUndefined();
  });
});

describe("montagem do payload de edição", () => {
  const original = makeSeries({
    displayName: "Spotify",
    expectedAmount: 21.9,
    anchorDay: 30,
    cadence: "MONTHLY",
    amountType: "FIXED",
    startsAt: "2026-01-01",
    endsAt: null,
    categoryId: "cat-1",
  });

  it("manda só o que mudou", () => {
    const values = formValuesFromSeries(original);
    const result = buildUpdatePayload(
      { ...values, expectedAmount: "25,90" },
      original,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ expectedAmount: 25.9 });
  });

  it("leva a âncora junto ao sair de semanal, como o servidor exige", () => {
    const weekly = makeSeries({ cadence: "WEEKLY", anchorDay: null });
    const values = formValuesFromSeries(weekly);
    const result = buildUpdatePayload(
      { ...values, cadence: "MONTHLY", anchorDay: "5" },
      weekly,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ cadence: "MONTHLY", anchorDay: 5 });
  });

  it("ao virar semanal manda só a cadência — a âncora é zerada no servidor", () => {
    const values = formValuesFromSeries(original);
    const result = buildUpdatePayload(
      { ...values, cadence: "WEEKLY", anchorDay: "" },
      original,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ cadence: "WEEKLY" });
  });

  it("avisa que a data de fim não pode ser removida pela API", () => {
    const withEnd = makeSeries({ ...original, endsAt: "2026-12-31" });
    const values = formValuesFromSeries(withEnd);
    const result = buildUpdatePayload(
      { ...values, endsAt: "", displayName: "Spotify Família" },
      withEnd,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ displayName: "Spotify Família" });
    expect(result.notices).toEqual([
      "A data de fim não pode ser removida por aqui.",
    ]);
  });

  it("não chama a API quando nada mudou", () => {
    const values = formValuesFromSeries(original);
    expect(buildUpdatePayload(values, original)).toEqual({
      ok: false,
      message: "Nada mudou nesta recorrência.",
    });
  });

  it("série sem nome de exibição: salvar sem mudar nada não vira PATCH fantasma", () => {
    // o preenchimento cai no merchantKey — a comparação tem que cair no mesmo
    // lugar, senão todo save promovia a série detectada sem mudança alguma
    const anonymous = makeSeries({ displayName: null });
    const values = formValuesFromSeries(anonymous);
    expect(buildUpdatePayload(values, anonymous)).toEqual({
      ok: false,
      message: "Nada mudou nesta recorrência.",
    });
  });

  it("avisa que a data de início não pode ser removida pela API", () => {
    const values = formValuesFromSeries(original);
    const result = buildUpdatePayload(
      { ...values, startsAt: "", displayName: "Spotify Duo" },
      original,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ displayName: "Spotify Duo" });
    expect(result.notices).toEqual([
      "A data de início não pode ser removida por aqui.",
    ]);
  });

  it("edição de série sem valor estimado não obriga a inventar um", () => {
    // o PATCH é parcial: trocar o nome de uma detectada sem estimativa não
    // pode exigir um valor que o usuário não tem
    const noAmount = makeSeries({ displayName: "Uber", expectedAmount: null });
    const values = formValuesFromSeries(noAmount);
    const result = buildUpdatePayload(
      { ...values, displayName: "Uber viagens" },
      noAmount,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ displayName: "Uber viagens" });
    expect(result.notices).toEqual([]);
  });

  it("avisa que o valor não pode ser removido quando a série já tinha um", () => {
    const values = formValuesFromSeries(original);
    const result = buildUpdatePayload(
      { ...values, expectedAmount: "", displayName: "Spotify HiFi" },
      original,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual({ displayName: "Spotify HiFi" });
    expect(result.notices).toEqual([
      "O valor esperado não pode ser removido por aqui.",
    ]);
  });

  it("preenche o formulário a partir da série, com vírgula decimal", () => {
    const values = formValuesFromSeries(original);
    expect(values.expectedAmount).toBe("21,9");
    expect(values.anchorDay).toBe("30");
    expect(values.startsAt).toBe("01/01/2026");
    expect(values.endsAt).toBe("");
  });

  it("cai em mensal ao editar série sem ritmo definido", () => {
    const irregular = makeSeries({ cadence: "IRREGULAR", anchorDay: null });
    expect(formValuesFromSeries(irregular).cadence).toBe("MONTHLY");
  });

  it("o formulário novo nasce com hoje como início e âncora", () => {
    const values = emptyFormValues(new Date(2026, 7, 15));
    expect(values.startsAt).toBe("15/08/2026");
    expect(values.anchorDay).toBe("15");
    expect(values.cadence).toBe("MONTHLY");
  });
});

describe("tradução dos erros do servidor", () => {
  const problem = (status: number, detail: string, seriesId?: string) => ({
    response: { status, data: { detail, ...(seriesId ? { seriesId } : {}) } },
  });

  it("lê status, detalhe e a propriedade extra do ProblemDetail", () => {
    expect(readProblem(problem(409, "Já existe", "abc"))).toEqual({
      status: 409,
      detail: "Já existe",
      seriesId: "abc",
    });
    expect(readProblem(new Error("boom"))).toEqual({
      status: null,
      detail: null,
      seriesId: null,
    });
  });

  it("troca a mensagem técnica do 400 por uma frase acionável", () => {
    expect(
      translateRecurrenceError(
        problem(400, "endsAt não pode ser anterior a startsAt"),
        "fallback",
      ),
    ).toBe("A data de fim não pode ser anterior à data de início.");

    expect(
      translateRecurrenceError(
        problem(400, "Dia âncora não se aplica à cadência WEEKLY"),
        "fallback",
      ),
    ).toBe(
      "Cobrança semanal não tem dia do mês — deixe o dia de cobrança em branco.",
    );

    expect(
      translateRecurrenceError(
        problem(400, "Dia âncora é obrigatório para cadência MONTHLY/QUARTERLY"),
        "fallback",
      ),
    ).toBe("Informe o dia do mês em que a cobrança cai.");

    expect(
      translateRecurrenceError(
        problem(400, "anchorDay: Dia âncora deve estar entre 1 e 31"),
        "fallback",
      ),
    ).toBe("O dia da cobrança precisa estar entre 1 e 31.");

    expect(
      translateRecurrenceError(
        problem(400, "Cadência inválida: use MONTHLY, WEEKLY ou QUARTERLY"),
        "fallback",
      ),
    ).toBe("Escolha a frequência: mensal, semanal ou trimestral.");

    expect(
      translateRecurrenceError(problem(400, "Categoria não encontrada"), "x"),
    ).toBe("A categoria escolhida não existe mais. Escolha outra.");
  });

  it("mantém a mensagem do servidor quando não há tradução para o 400", () => {
    expect(translateRecurrenceError(problem(400, "Outra regra"), "fallback")).toBe(
      "Outra regra",
    );
  });

  it("usa o texto genérico quando a falha não é de negócio", () => {
    expect(translateRecurrenceError(problem(500, "stack trace"), "fallback")).toBe(
      "fallback",
    );
    expect(translateRecurrenceError(new Error("timeout"), "fallback")).toBe(
      "fallback",
    );
  });

  it("transforma o 409 em convite a editar a série existente", () => {
    const conflict = describeConflict(problem(409, "Já existe...", "series-9"));
    expect(conflict?.seriesId).toBe("series-9");
    expect(conflict?.message).toContain("edite a que existe");
  });

  it("no 409 sem seriesId (corrida com a varredura) repassa o texto do servidor", () => {
    const conflict = describeConflict(
      problem(409, "Ela acabou de ser criada pela varredura automática."),
    );
    expect(conflict?.seriesId).toBeNull();
    expect(conflict?.message).toContain("varredura automática");
  });

  it("não confunde 400 com conflito", () => {
    expect(describeConflict(problem(400, "qualquer"))).toBeNull();
  });
});

describe("resultado da varredura", () => {
  it("conta séries novas e atualizadas", () => {
    expect(
      describeDetection({ seriesCreated: 3, seriesUpdated: 2, linksCreated: 40 }),
    ).toBe("Varredura concluída: 3 novas séries e 2 atualizadas.");
    expect(
      describeDetection({ seriesCreated: 1, seriesUpdated: 0, linksCreated: 4 }),
    ).toBe("Varredura concluída: 1 nova série.");
  });

  it("é honesta quando não achou nada novo", () => {
    expect(
      describeDetection({ seriesCreated: 0, seriesUpdated: 0, linksCreated: 0 }),
    ).toBe("Nada novo: suas recorrências já estavam em dia.");
    expect(
      describeDetection({ seriesCreated: 0, seriesUpdated: 0, linksCreated: 1 }),
    ).toContain("1 lançamento vinculado");
  });
});

describe("previsto × liquidado", () => {
  const month: ForecastMonth = {
    month: "2026-08",
    start: "2026-08-01",
    end: "2026-08-31",
    expectedIncome: 1000,
    expectedExpense: 250,
    expectedNet: 750,
    cumulativeNet: 1750,
    items: [
      {
        seriesId: "a",
        displayName: "Salário",
        flow: "INCOME",
        dueDay: 5,
        dueDate: "2026-08-05",
        amount: 1000,
        source: "DETECTED",
        settled: false,
      },
      {
        seriesId: "b",
        displayName: "Spotify",
        flow: "EXPENSE",
        dueDay: 2,
        dueDate: "2026-08-02",
        amount: 21.9,
        source: "DETECTED",
        settled: true,
      },
      {
        seriesId: "c",
        displayName: "Conta de luz",
        flow: "EXPENSE",
        dueDay: 10,
        dueDate: "2026-08-10",
        amount: 250,
        source: "USER",
        settled: false,
      },
    ],
  };

  it("separa o que já caiu do que ainda falta", () => {
    const split = splitForecastMonth(month);
    expect(split.pendingItems.map((i) => i.seriesId)).toEqual(["a", "c"]);
    expect(split.settledItems.map((i) => i.seriesId)).toEqual(["b"]);
    expect(split.settledTotal).toBe(21.9);
    expect(split.pendingIncome).toBe(1000);
    expect(split.pendingExpense).toBe(250);
  });

  it("as somas do previsto batem com as do servidor (liquidado fora)", () => {
    const split = splitForecastMonth(month);
    expect(split.pendingIncome).toBe(month.expectedIncome);
    expect(split.pendingExpense).toBe(month.expectedExpense);
  });

  it("indexa o estado do mês por série para a lista", () => {
    const state = deriveMonthState(month);
    expect(state.b).toEqual({ settled: true, dueDay: 2, amount: 21.9 });
    expect(state.c.settled).toBe(false);
    expect(deriveMonthState(null)).toEqual({});
  });

  it("acusa o mês que fecha no vermelho pelo acumulado", () => {
    expect(isMonthAtRisk(month)).toBe(false);
    expect(isMonthAtRisk({ ...month, cumulativeNet: -0.01 })).toBe(true);

    const months = [
      month,
      { ...month, month: "2026-09", cumulativeNet: -300 },
      { ...month, month: "2026-10", cumulativeNet: -900 },
    ];
    expect(firstRiskMonth(months)?.month).toBe("2026-09");
    expect(firstRiskMonth([month])).toBeNull();
    expect(firstRiskMonth(null)).toBeNull();
  });

  it("devolve o período inteiro em risco — é do recorte que sai o rótulo do alerta", () => {
    // Em ciclo ancorado o `month` do período no vermelho não descreve nada
    // ("2026-09" é o ciclo 12/09→11/10); a Home precisa de `start`/`end`
    const cycle = {
      ...month,
      month: "2026-09",
      start: "2026-09-12",
      end: "2026-10-11",
      cumulativeNet: -300,
    };
    const risk = firstRiskMonth([month, cycle]);
    expect(risk).toEqual(cycle);
    expect(forecastPeriodLabel(risk as ForecastMonth).short).toBe("12/09 → 11/10");
  });
});

describe("nome do período da previsão", () => {
  it("recorte que é mês de calendário se escreve como mês", () => {
    const label = forecastPeriodLabel({
      month: "2026-09",
      start: "2026-09-01",
      end: "2026-09-30",
    });
    expect(label.short).toBe("set 2026");
    expect(label.spoken).toBe("setembro de 2026");
    expect(label.isCalendarMonth).toBe(true);
  });

  it("ciclo ancorado se escreve com as duas datas, e não pelo mês em que começa", () => {
    // "ago 2026" para o ciclo 12/08→11/09 era a ambiguidade que obrigava a
    // Home a escrever "(mês do calendário)" ao lado
    const label = forecastPeriodLabel({
      month: "2026-08",
      start: "2026-08-12",
      end: "2026-09-11",
    });
    expect(label.short).toBe("12/08 → 11/09");
    expect(label.spoken).toBe("o ciclo de 12 de agosto a 11 de setembro de 2026");
    expect(label.isCalendarMonth).toBe(false);
  });

  it("fevereiro inteiro e ano bissexto continuam sendo mês de calendário", () => {
    expect(
      forecastPeriodLabel({ month: "2028-02", start: "2028-02-01", end: "2028-02-29" })
        .isCalendarMonth,
    ).toBe(true);
    // dia 1 até o penúltimo dia NÃO é o mês inteiro — é uma janela
    expect(
      forecastPeriodLabel({ month: "2026-08", start: "2026-08-01", end: "2026-08-30" })
        .short,
    ).toBe("01/08 → 30/08");
  });

  it("sem start/end (API uma versão atrás) cai para o month, que aí é o mês do calendário", () => {
    const label = forecastPeriodLabel({ month: "2026-08" });
    expect(label.short).toBe("ago 2026");
    expect(label.spoken).toBe("agosto de 2026");
    expect(label.isCalendarMonth).toBe(true);
  });

  it("a identidade do card é o start, único por período", () => {
    const periods = [
      { month: "2026-08", start: "2026-08-12", end: "2026-09-11" },
      { month: "2026-09", start: "2026-09-12", end: "2026-10-11" },
      { month: "2026-10", start: "2026-10-12", end: "2026-11-11" },
    ];
    const keys = periods.map(forecastPeriodKey);
    expect(new Set(keys).size).toBe(periods.length);
    expect(keys[0]).toBe("2026-08-12");
    // sem start (API antiga) o month ainda identifica o período
    expect(forecastPeriodKey({ month: "2026-08" })).toBe("2026-08");
  });
});

describe("quando a cobrança cai na linha da previsão", () => {
  it("escreve dia/mês a partir da data completa", () => {
    // no ciclo 12/08→11/09 o "dia 20" é de agosto e o "dia 5" é de setembro:
    // só a data localiza cada um
    expect(forecastItemWhen({ dueDay: 20, dueDate: "2026-08-20" })).toEqual({
      label: "20/08",
      spoken: "dia 20 de agosto",
    });
    expect(forecastItemWhen({ dueDay: 5, dueDate: "2026-09-05" })).toEqual({
      label: "05/09",
      spoken: "dia 5 de setembro",
    });
  });

  it("WEEKLY segue com o selo semanal — não tem dia nem data", () => {
    const when = forecastItemWhen({ dueDay: null, dueDate: null });
    expect(when.label).toBe("~4,3×/mês");
    expect(when.spoken).toBe("cerca de 4,3 vezes por mês");
    // resposta antiga sem o campo: nada de "null/undefined" no selo
    expect(forecastItemWhen({ dueDay: null })).toEqual(when);
  });

  it("dueDay sem dueDate (API antiga) fica no 'dia N' de antes", () => {
    expect(forecastItemWhen({ dueDay: 30 })).toEqual({
      label: "dia 30",
      spoken: "dia 30",
    });
    expect(forecastItemWhen({ dueDay: 30, dueDate: null })).toEqual({
      label: "dia 30",
      spoken: "dia 30",
    });
  });
});

describe("compromisso dos próximos dias", () => {
  const today = new Date(2026, 7, 15);

  it("soma só saídas ativas que vencem dentro da janela", () => {
    const series = [
      makeSeries({ id: "1", nextDueDate: "2026-08-20", expectedAmount: 100 }),
      makeSeries({ id: "2", nextDueDate: "2026-09-01", expectedAmount: 50 }),
      // fora da janela de 30 dias
      makeSeries({ id: "3", nextDueDate: "2026-10-20", expectedAmount: 999 }),
      // entrada não é compromisso
      makeSeries({ id: "4", nextDueDate: "2026-08-18", flow: "INCOME", expectedAmount: 5000 }),
      // vencida: já não é o que está por vir
      makeSeries({ id: "5", nextDueDate: "2026-08-01", expectedAmount: 77 }),
      // sem data prevista
      makeSeries({ id: "6", nextDueDate: null, expectedAmount: 33 }),
    ];
    const result = upcomingCommitment(series, 30, today);
    expect(result.total).toBe(150);
    expect(result.count).toBe(2);
    expect(result.nextDueDate).toBe("2026-08-20");
  });

  it("aponta a próxima cobrança pelo nome", () => {
    const series = [
      makeSeries({ id: "1", displayName: "Aluguel", nextDueDate: "2026-08-25" }),
      makeSeries({ id: "2", displayName: "Internet", nextDueDate: "2026-08-18" }),
    ];
    expect(upcomingCommitment(series, 30, today).nextName).toBe("Internet");
  });

  it("devolve zero quando não há nada a vencer", () => {
    expect(upcomingCommitment([], 30, today)).toEqual({
      total: 0,
      count: 0,
      nextName: null,
      nextDueDate: null,
    });
  });
});
