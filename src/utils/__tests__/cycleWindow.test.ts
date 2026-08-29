import {
  analysisRangeForMonth,
  clampAnchorDay,
  cycleChipLabel,
  formatDayMonthShort,
  formatLongDate,
  cycleMonthKeyContaining,
  cycleMonthKeys,
  cycleWindowContaining,
  cycleWindowForMonth,
  daysInMonth,
  describeWindow,
  formatDayMonth,
  formatMonthLongLabel,
  formatWindowLabel,
  homeReferenceDate,
  isCalendarMonthAnchor,
  shiftMonthKey,
  todayIso,
} from "../cycleWindow";

describe("clampAnchorDay", () => {
  it("mantém dias válidos", () => {
    expect(clampAnchorDay(1)).toBe(1);
    expect(clampAnchorDay(12)).toBe(12);
    expect(clampAnchorDay(31)).toBe(31);
  });

  it("prende valores fora da faixa nas bordas", () => {
    expect(clampAnchorDay(0)).toBe(1);
    expect(clampAnchorDay(-5)).toBe(1);
    expect(clampAnchorDay(99)).toBe(31);
  });

  it("cai no dia 1 quando o valor guardado não é número", () => {
    expect(clampAnchorDay(undefined)).toBe(1);
    expect(clampAnchorDay(null)).toBe(1);
    expect(clampAnchorDay("abc")).toBe(1);
  });
});

describe("daysInMonth", () => {
  it("conhece fevereiro comum e bissexto", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 4)).toBe(30);
  });
});

describe("shiftMonthKey", () => {
  it("atravessa a virada do ano nos dois sentidos", () => {
    expect(shiftMonthKey("2026-12", 1)).toBe("2027-01");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2026-08", 0)).toBe("2026-08");
  });
});

describe("cycleWindowForMonth", () => {
  it("com âncora no dia 1 devolve exatamente o mês de calendário", () => {
    expect(cycleWindowForMonth(1, "2026-08")).toEqual({
      start: "2026-08-01",
      end: "2026-08-31",
    });
    expect(cycleWindowForMonth(1, "2026-02")).toEqual({
      start: "2026-02-01",
      end: "2026-02-28",
    });
  });

  it("fecha na véspera da próxima virada, sem repetir o dia da âncora", () => {
    expect(cycleWindowForMonth(12, "2026-07")).toEqual({
      start: "2026-07-12",
      end: "2026-08-11",
    });
  });

  it("ciclos consecutivos não se sobrepõem nem deixam buraco", () => {
    const primeiro = cycleWindowForMonth(12, "2026-07");
    const segundo = cycleWindowForMonth(12, "2026-08");
    expect(primeiro.end).toBe("2026-08-11");
    expect(segundo.start).toBe("2026-08-12");
  });

  it("recua a âncora para o último dia dos meses curtos", () => {
    // 31 de fevereiro não existe: o ciclo vira no dia 28
    expect(cycleWindowForMonth(31, "2026-01")).toEqual({
      start: "2026-01-31",
      end: "2026-02-27",
    });
    expect(cycleWindowForMonth(31, "2026-02")).toEqual({
      start: "2026-02-28",
      end: "2026-03-30",
    });
  });

  it("atravessa a virada do ano", () => {
    expect(cycleWindowForMonth(5, "2026-12")).toEqual({
      start: "2026-12-05",
      end: "2027-01-04",
    });
  });
});

describe("cycleMonthKeyContaining", () => {
  it("fica no próprio mês a partir do dia da âncora", () => {
    expect(cycleMonthKeyContaining(12, "2026-08-15")).toBe("2026-08");
    expect(cycleMonthKeyContaining(12, "2026-08-12")).toBe("2026-08");
  });

  it("volta para o mês anterior antes da âncora", () => {
    expect(cycleMonthKeyContaining(12, "2026-08-11")).toBe("2026-07");
    expect(cycleMonthKeyContaining(12, "2026-01-02")).toBe("2025-12");
  });

  it("respeita o recuo da âncora em mês curto", () => {
    expect(cycleMonthKeyContaining(31, "2026-02-28")).toBe("2026-02");
    expect(cycleMonthKeyContaining(31, "2026-02-27")).toBe("2026-01");
  });

  it("com âncora no dia 1, é sempre o mês da data", () => {
    expect(cycleMonthKeyContaining(1, "2026-08-01")).toBe("2026-08");
    expect(cycleMonthKeyContaining(1, "2026-08-31")).toBe("2026-08");
  });
});

describe("cycleWindowContaining", () => {
  it("devolve o ciclo em curso para a data informada", () => {
    expect(cycleWindowContaining(12, "2026-08-15")).toEqual({
      start: "2026-08-12",
      end: "2026-09-11",
    });
    expect(cycleWindowContaining(12, "2026-08-05")).toEqual({
      start: "2026-07-12",
      end: "2026-08-11",
    });
  });
});

describe("analysisRangeForMonth", () => {
  it("manda mês quando a âncora é o dia 1 — o comparável do dia a dia não muda", () => {
    expect(analysisRangeForMonth(1, "2026-08")).toEqual({
      kind: "month",
      month: "2026-08",
    });
  });

  it("manda janela fora do dia 1", () => {
    expect(analysisRangeForMonth(12, "2026-07")).toEqual({
      kind: "window",
      start: "2026-07-12",
      end: "2026-08-11",
    });
  });

  it("nunca produz mês e janela ao mesmo tempo (400 na API)", () => {
    const mês = analysisRangeForMonth(1, "2026-08");
    const janela = analysisRangeForMonth(9, "2026-08");
    expect(Object.keys(mês).sort()).toEqual(["kind", "month"]);
    expect(Object.keys(janela).sort()).toEqual(["end", "kind", "start"]);
  });
});

describe("isCalendarMonthAnchor", () => {
  it("só o dia 1 é o mês de calendário", () => {
    expect(isCalendarMonthAnchor(1)).toBe(true);
    expect(isCalendarMonthAnchor(2)).toBe(false);
    expect(isCalendarMonthAnchor(31)).toBe(false);
  });
});

describe("homeReferenceDate", () => {
  it("usa hoje quando o mês corrente tem movimento", () => {
    expect(homeReferenceDate(["2026-08", "2026-07"], "2026-08-15")).toBe(
      "2026-08-15",
    );
  });

  it("usa hoje quando não há histórico nenhum", () => {
    expect(homeReferenceDate([], "2026-08-15")).toBe("2026-08-15");
  });

  it("ancora no último mês com movimento quando os dados são antigos", () => {
    expect(homeReferenceDate(["2026-05", "2026-04"], "2026-08-15")).toBe(
      "2026-05-31",
    );
  });
});

describe("cycleMonthKeys", () => {
  it("em modo mês, devolve a lista do servidor sem tocar", () => {
    const months = ["2026-08", "2026-07"];
    expect(cycleMonthKeys(1, months)).toBe(months);
  });

  it("em modo janela, acrescenta o ciclo que cobre o começo do histórico", () => {
    expect(cycleMonthKeys(12, ["2026-08", "2026-07"])).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
    ]);
  });

  it("lista vazia continua vazia", () => {
    expect(cycleMonthKeys(12, [])).toEqual([]);
  });

  it("cada mês com movimento oferece os DOIS ciclos que podem contê-lo", () => {
    // Histórico com lacuna: o movimento de agosto pode estar no ciclo que abriu
    // em 12/07 ou em 12/08, e o de março em 12/02 ou 12/03. Oferecendo só um
    // deles, o ciclo corrente ficava sem chip quando o mês anterior estava vazio
    expect(cycleMonthKeys(12, ["2026-08", "2026-03"])).toEqual([
      "2026-08",
      "2026-07",
      "2026-03",
      "2026-02",
    ]);
  });

  it("não repete chip quando os meses são consecutivos", () => {
    expect(cycleMonthKeys(12, ["2026-08", "2026-07", "2026-06"])).toEqual([
      "2026-08",
      "2026-07",
      "2026-06",
      "2026-05",
    ]);
  });

  it("atravessa a virada do ano na ordem certa", () => {
    expect(cycleMonthKeys(12, ["2027-01"])).toEqual(["2027-01", "2026-12"]);
  });
});

describe("rótulos", () => {
  it("formata dia/mês e a janela", () => {
    expect(formatDayMonth("2026-08-05")).toBe("05/08");
    expect(formatWindowLabel("2026-07-12", "2026-08-11")).toBe(
      "12/07 → 11/08",
    );
  });

  it("devolve null sem janela — servidor antigo não pode virar 'undefined' na tela", () => {
    expect(formatWindowLabel(undefined, undefined)).toBeNull();
    expect(formatWindowLabel("2026-07-12", null)).toBeNull();
    expect(describeWindow(null, "2026-08-11")).toBeNull();
  });

  it("descreve a janela por extenso para leitor de tela", () => {
    expect(describeWindow("2026-07-12", "2026-08-11")).toContain("12 de julho");
    expect(describeWindow("2026-07-12", "2026-08-11")).toContain(
      "11 de agosto de 2026",
    );
  });

  it("escreve o mês por extenso para o título da fatura", () => {
    // O chip abrevia; o cabeçalho que responde "de qual mês é esta conta" não
    expect(formatMonthLongLabel("2026-08")).toBe("agosto de 2026");
    expect(formatMonthLongLabel("2027-01")).toBe("janeiro de 2027");
  });

  it("mês que não é mês volta inteiro, sem virar 'Invalid Date'", () => {
    expect(formatMonthLongLabel("sem-mes")).toBe("sem-mes");
    expect(formatMonthLongLabel("2026-13")).toBe("2026-13");
  });

  it("o chip identifica o mês em modo mês e o dia da virada em modo janela", () => {
    expect(cycleChipLabel(1, "2026-08")).toBe("ago 2026");
    expect(cycleChipLabel(12, "2026-08")).toBe("12 ago");
    // mês curto: o chip mostra o dia real da virada, não o número escolhido
    expect(cycleChipLabel(31, "2026-02")).toBe("28 fev");
  });
});

describe("datas de lançamento (UTC, nunca o fuso do aparelho)", () => {
  // A data de lançamento é date-only gravada como meia-noite UTC. Passá-la por
  // `new Date(iso).toLocaleDateString()` sem fuso entrega a véspera em todo o
  // Brasil — foi assim que a mesma transação apareceu como "31 jul" na lista e
  // "01 de agosto" na folha de detalhes
  const lancamento = "2026-08-01T00:00:00Z";

  // Fuso de Brasília só aqui, e devolvido no fim: o worker do Jest é reusado
  // entre arquivos, e deixar o fuso trocado contaminaria as outras suítes
  const fusoOriginal = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Sao_Paulo";
  });
  afterAll(() => {
    if (fusoOriginal === undefined) delete process.env.TZ;
    else process.env.TZ = fusoOriginal;
  });

  it("o aparelho do teste está mesmo em UTC-3", () => {
    // Guarda do próprio cenário: se o fuso não pegar, os casos abaixo passariam
    // por acidente e parariam de proteger contra a regressão
    expect(new Date(lancamento).getTimezoneOffset()).toBe(180);
    expect(new Date(lancamento).getDate()).toBe(31);
  });

  it("exibe o dia em UTC nos três formatos, com o aparelho em UTC-3", () => {
    expect(formatDayMonthShort(lancamento)).toBe("01 ago");
    expect(formatDayMonth(lancamento)).toBe("01/08");
    expect(formatLongDate(lancamento)).toBe("01 de agosto de 2026");
  });

  it("o formatador antigo (sem timeZone) entregaria a véspera", () => {
    // Documenta o que exatamente foi corrigido: mesmo instante, leitura no fuso
    // do aparelho, e o dia anda para trás
    expect(
      new Date(lancamento).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
      }),
    ).toBe("31/07");
  });

  it("aceita tanto o ISO completo da API quanto `yyyy-MM-dd`", () => {
    expect(formatDayMonthShort("2026-08-01")).toBe("01 ago");
    expect(formatLongDate("2026-12-31T23:59:59Z")).toBe(
      "31 de dezembro de 2026",
    );
  });

  it("texto que não é data volta inteiro, sem virar 'Invalid Date'", () => {
    expect(formatDayMonthShort("")).toBe("");
    expect(formatLongDate("sem data")).toBe("sem data");
  });
});

describe("todayIso", () => {
  it("usa os componentes UTC, e não o fuso do aparelho", () => {
    // 23h de 31/12 em UTC-3 já é 1º de janeiro em UTC
    expect(todayIso(new Date("2027-01-01T02:00:00Z"))).toBe("2027-01-01");
  });
});
