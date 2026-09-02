import { reportWindows, toInstantRange } from "../reportPeriods";

describe("reportWindows — mensal", () => {
  it("com âncora no dia 1, a janela é o mês de calendário", () => {
    const janelas = reportWindows("MONTHLY", 1, "2026-08-20", 3);

    expect(janelas[0].startIso).toBe("2026-08-01");
    expect(janelas[1].startIso).toBe("2026-07-01");
    expect(janelas[1].endIso).toBe("2026-07-31");
    expect(janelas[2].startIso).toBe("2026-06-01");
  });

  it("com âncora no dia 5, julho começa em 05/07", () => {
    // A mesma âncora da Home e da Análise: quem recebe dia 5 vive o mês assim
    const janelas = reportWindows("MONTHLY", 5, "2026-08-20", 2);

    expect(janelas[0].startIso).toBe("2026-08-05");
    expect(janelas[1].startIso).toBe("2026-07-05");
    expect(janelas[1].endIso).toBe("2026-08-04");
  });

  it("a janela corrente termina HOJE, não na data futura de fechamento", () => {
    const janelas = reportWindows("MONTHLY", 1, "2026-08-20", 1);

    // Relatório terminando no futuro venderia como fechado um mês que ainda
    // está acontecendo
    expect(janelas[0].emAndamento).toBe(true);
    expect(janelas[0].endIso).toBe("2026-08-20");
  });

  it("a janela já fechada não é marcada como em andamento", () => {
    const janelas = reportWindows("MONTHLY", 1, "2026-08-20", 2);

    expect(janelas[1].emAndamento).toBe(false);
    expect(janelas[1].endIso).toBe("2026-07-31");
  });

  it("no dia exato da âncora o ciclo novo já é o corrente", () => {
    const janelas = reportWindows("MONTHLY", 5, "2026-08-05", 1);

    expect(janelas[0].startIso).toBe("2026-08-05");
  });

  it("atravessa a virada do ano", () => {
    const janelas = reportWindows("MONTHLY", 1, "2026-01-10", 2);

    expect(janelas[1].startIso).toBe("2025-12-01");
    expect(janelas[1].endIso).toBe("2025-12-31");
  });
});

describe("reportWindows — semanal", () => {
  it("são blocos de sete dias contados de hoje para trás", () => {
    const janelas = reportWindows("WEEKLY", 1, "2026-08-20", 2);

    expect(janelas[0].startIso).toBe("2026-08-14");
    expect(janelas[0].endIso).toBe("2026-08-20");
    // Sem buraco nem sobreposição entre uma janela e a seguinte
    expect(janelas[1].endIso).toBe("2026-08-13");
    expect(janelas[1].startIso).toBe("2026-08-07");
  });

  it("a semana que termina hoje não é 'em andamento': ela vai até agora", () => {
    const janelas = reportWindows("WEEKLY", 1, "2026-08-20", 1);

    expect(janelas[0].emAndamento).toBe(false);
  });
});

describe("reportWindows — anual", () => {
  it("são blocos de doze meses, também contados de hoje", () => {
    const janelas = reportWindows("YEARLY", 1, "2026-08-20", 2);

    expect(janelas[0].startIso).toBe("2025-08-21");
    expect(janelas[0].endIso).toBe("2026-08-20");
    expect(janelas[1].endIso).toBe("2025-08-20");
    expect(janelas[1].startIso).toBe("2024-08-21");
  });

  it("29 de fevereiro não estoura o deslocamento de meses", () => {
    // 2024 é bissexto; doze meses antes de 29/02/2024 não existe em 2023
    const janelas = reportWindows("YEARLY", 1, "2024-02-29", 1);

    expect(janelas[0].endIso).toBe("2024-02-29");
    expect(janelas[0].startIso).toBe("2023-03-01");
  });
});

describe("toInstantRange", () => {
  it("o fim vai até o último instante do dia", () => {
    const range = toInstantRange({
      label: "irrelevante",
      startIso: "2026-07-01",
      endIso: "2026-07-31",
      emAndamento: false,
    });

    expect(range.startDate).toBe("2026-07-01T00:00:00.000Z");
    // Com T00:00 no fim, o dia do fechamento ficaria de fora do relatório
    expect(range.endDate).toBe("2026-07-31T23:59:59.999Z");
  });
});
