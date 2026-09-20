import {
  agruparPorDia,
  podeMostrarSaldoCorrido,
  rotuloDoDia,
} from "../statementDays";

type Linha = {
  date: string;
  amount: number;
  type: "CREDIT" | "DEBIT";
  id: string;
};

let sequencia = 0;
const debito = (date: string, valor: number): Linha => ({
  date,
  amount: -Math.abs(valor),
  type: "DEBIT",
  id: `d${++sequencia}`,
});
const credito = (date: string, valor: number): Linha => ({
  date,
  amount: Math.abs(valor),
  type: "CREDIT",
  id: `c${++sequencia}`,
});

describe("agruparPorDia", () => {
  it("sem linhas, sem dias", () => {
    expect(agruparPorDia([])).toEqual([]);
  });

  it("junta as linhas do mesmo dia e soma o que o dia moveu", () => {
    const dias = agruparPorDia([
      debito("2026-09-16T10:00:00Z", 64.9),
      debito("2026-09-16T18:30:00Z", 21.9),
      credito("2026-09-16T08:00:00Z", 100),
    ]);

    expect(dias).toHaveLength(1);
    expect(dias[0].dia).toBe("2026-09-16");
    expect(dias[0].transacoes).toHaveLength(3);
    expect(dias[0].total).toBeCloseTo(13.2, 2);
  });

  /**
   * A ordem de saída não pode depender da ordem de entrada: o saldo corrido só
   * fecha com os dias em ordem, e confiar na ordenação de quem chama seria
   * depender de um detalhe que muda longe daqui — hoje o servidor devolve
   * `order by t.date desc`, e basta alguém trocar isso.
   */
  it("devolve do mais recente para o mais antigo, venha como vier", () => {
    const dias = agruparPorDia([
      debito("2026-09-10T12:00:00Z", 10),
      debito("2026-09-16T12:00:00Z", 10),
      debito("2026-09-12T12:00:00Z", 10),
    ]);

    expect(dias.map((d) => d.dia)).toEqual([
      "2026-09-16",
      "2026-09-12",
      "2026-09-10",
    ]);
  });

  it("o total do dia é entradas menos saídas, e não a soma do sinal cru", () => {
    // Uma linha de débito gravada com sinal POSITIVO (o caso que o comentário
    // de bankMetrics descreve). Somar o sinal cru daria +50; o certo é -50
    const torta: Linha = {
      date: "2026-09-16",
      amount: 50,
      type: "DEBIT",
      id: "torta",
    };

    expect(agruparPorDia([torta])[0].total).toBe(-50);
  });

  describe("saldo corrido", () => {
    /**
     * O saldo informado pela conta reflete tudo que já foi lançado, então ele
     * é o saldo ao fim do dia mais recente. Dali para trás, cada dia vale o
     * saldo do dia seguinte menos o total do dia seguinte.
     */
    it("caminha de trás para frente a partir do saldo informado", () => {
      const dias = agruparPorDia(
        [
          debito("2026-09-16", 100), // dia mais recente: moveu -100
          credito("2026-09-15", 500), // moveu +500
          debito("2026-09-14", 50), // moveu -50
        ],
        { saldoAtual: 250 },
      );

      // Hoje fecha com o saldo informado
      expect(dias[0].saldoNoFim).toBe(250);
      // 15/09 fechou com 250 menos o que o dia 16 moveu (-100) = 350
      expect(dias[1].saldoNoFim).toBe(350);
      // 14/09 fechou com 350 menos o que o dia 15 moveu (+500) = -150
      expect(dias[2].saldoNoFim).toBe(-150);
    });

    it("o saldo de um dia mais o que o dia seguinte moveu reconstrói o próximo", () => {
      const dias = agruparPorDia(
        [
          debito("2026-09-16", 64.9),
          debito("2026-09-16", 21.9),
          credito("2026-09-12", 4820),
          debito("2026-09-10", 187.4),
        ],
        { saldoAtual: 1000 },
      );

      dias.forEach((dia, i) => {
        const anterior = dias[i + 1];
        if (!anterior) return;
        expect(anterior.saldoNoFim! + dia.total).toBeCloseTo(
          dia.saldoNoFim!,
          2,
        );
      });
    });

    /**
     * Sem saldo de partida, `null` — e não a soma do extrato. Somar o extrato
     * inteiro como se fosse saldo é exatamente o defeito que o dono apontou na
     * Previsão em 15/09, quando a tela mostrou -19 mil.
     */
    it("sem saldo informado, não inventa saldo nenhum", () => {
      const dias = agruparPorDia([debito("2026-09-16", 100)]);
      expect(dias[0].saldoNoFim).toBeNull();

      const comNulo = agruparPorDia([debito("2026-09-16", 100)], {
        saldoAtual: null,
      });
      expect(comNulo[0].saldoNoFim).toBeNull();
    });

    it("saldo zero é um saldo, não a ausência de um", () => {
      // O caso que um `if (!saldoAtual)` quebraria em silêncio
      const dias = agruparPorDia([debito("2026-09-16", 100)], {
        saldoAtual: 0,
      });
      expect(dias[0].saldoNoFim).toBe(0);
    });
  });

  it("data ilegível não derruba o agrupamento", () => {
    const dias = agruparPorDia([
      { date: "sem data", amount: -10, type: "DEBIT", id: "x" },
    ]);
    expect(dias).toHaveLength(1);
    expect(dias[0].transacoes).toHaveLength(1);
  });

  /**
   * `2026-09-16T23:30:00Z` é ainda dia 16 em UTC e já é dia 17 em fuso
   * positivo. Passar por `Date` aqui faria o mesmo lançamento cair em dias
   * diferentes conforme o aparelho — a classe de bug que a API já pagou uma
   * vez ("bomba-relógio de data", 15/09).
   */
  it("o dia sai do texto ISO, não de um Date com fuso", () => {
    const dias = agruparPorDia([
      debito("2026-09-16T23:30:00Z", 10),
      debito("2026-09-16T00:30:00Z", 10),
    ]);

    expect(dias).toHaveLength(1);
    expect(dias[0].dia).toBe("2026-09-16");
  });
});

describe("podeMostrarSaldoCorrido", () => {
  const base = {
    saldoAtual: 250,
    tipoDaConta: "BANK",
    contaUnica: true,
    listaEstreitada: false,
  };

  it("com uma conta de banco, saldo conhecido e lista inteira, pode", () => {
    expect(podeMostrarSaldoCorrido(base)).toBe(true);
  });

  it("sem saldo conhecido, não", () => {
    expect(podeMostrarSaldoCorrido({ ...base, saldoAtual: null })).toBe(false);
    expect(podeMostrarSaldoCorrido({ ...base, saldoAtual: undefined })).toBe(
      false,
    );
  });

  it("com saldo zero, pode — zero é um saldo", () => {
    expect(podeMostrarSaldoCorrido({ ...base, saldoAtual: 0 })).toBe(true);
  });

  it("misturando contas, não: seria um saldo que não existe em conta nenhuma", () => {
    expect(podeMostrarSaldoCorrido({ ...base, contaUnica: false })).toBe(false);
  });

  /**
   * Num cartão, `CREDIT` é estorno ou pagamento da fatura, e a compra não move
   * o saldo da conta corrente até a fatura ser paga. "Saldo do dia" ali é uma
   * frase sem referente — a mesma regra que `statementMetrics` aplica aos
   * números do topo da tela.
   */
  it("num cartão, não", () => {
    expect(
      podeMostrarSaldoCorrido({ ...base, tipoDaConta: "CREDIT_CARD" }),
    ).toBe(false);
  });

  it("com busca ou período estreitando a lista, não", () => {
    expect(podeMostrarSaldoCorrido({ ...base, listaEstreitada: true })).toBe(
      false,
    );
  });
});

describe("rotuloDoDia", () => {
  const hoje = "2026-09-17";

  it("hoje e ontem têm nome", () => {
    expect(rotuloDoDia("2026-09-17", hoje)).toBe("Hoje");
    expect(rotuloDoDia("2026-09-16", hoje)).toBe("Ontem");
  });

  it("de anteontem para trás vale a data", () => {
    // "há 2 dias" obrigaria a pessoa a fazer a conta de cabeça.
    // O formato é o de `formatDayMonthShort`, que o resto do app já usa em
    // toda linha de extrato — não o "15 de set." do Intl de pt-BR
    expect(rotuloDoDia("2026-09-15", hoje)).toBe("15 set");
  });

  it("virada de mês e de ano continuam legíveis", () => {
    expect(rotuloDoDia("2026-08-31", hoje)).toBe("31 ago");
    // De outro ano o ano aparece: é o que distingue dois "12 mar"
    expect(rotuloDoDia("2025-03-12", hoje)).toBe("12 mar 2025");
  });

  it("no dia 1º, ontem é o último dia do mês anterior", () => {
    expect(rotuloDoDia("2026-08-31", "2026-09-01")).toBe("Ontem");
  });

  it("data ilegível volta como veio", () => {
    expect(rotuloDoDia("qualquer coisa", hoje)).toBe("qualquer coisa");
  });
});
