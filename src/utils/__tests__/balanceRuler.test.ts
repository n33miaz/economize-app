import type { ForecastItem } from "../../services/api";
import {
  contratados,
  montarRegua,
  somasContratadas,
  tresCenarios,
  valorAssinado,
} from "../balanceRuler";

const item = (over: Partial<ForecastItem>): ForecastItem =>
  ({
    seriesId: over.seriesId ?? "s1",
    displayName: "Aluguel",
    flow: "EXPENSE",
    dueDay: null,
    dueDate: null,
    amount: 100,
    source: "RECURRENCE",
    settled: false,
    ...over,
  }) as ForecastItem;

const HOJE = "2026-09-17";

describe("valorAssinado", () => {
  /**
   * Pelo `flow`, nunca pelo sinal de `amount`: os dois caminhos que alimentam
   * a previsão (recorrência cadastrada e parcela de cartão) não combinaram
   * sinal, e uma despesa com `amount` positivo somaria como receita.
   */
  it("o sinal vem do fluxo, não do valor que chegou", () => {
    expect(valorAssinado({ flow: "EXPENSE", amount: 100 })).toBe(-100);
    expect(valorAssinado({ flow: "EXPENSE", amount: -100 })).toBe(-100);
    expect(valorAssinado({ flow: "INCOME", amount: 100 })).toBe(100);
    expect(valorAssinado({ flow: "INCOME", amount: -100 })).toBe(100);
  });
});

describe("montarRegua", () => {
  it("sem compromisso datado, não há régua", () => {
    // Trinta dias planos dariam a impressão de que nada vai acontecer — o que
    // é diferente de "eu não sei o que vai acontecer"
    const regua = montarRegua({ saldoInicial: 500, itens: [], hoje: HOJE });

    expect(regua.dias).toEqual([]);
    expect(regua.ultimoDiaConhecido).toBeNull();
    expect(regua.saldoNoFimDoConhecido).toBe(500);
  });

  it("o saldo caminha dia a dia e para no último dia conhecido", () => {
    const regua = montarRegua({
      saldoInicial: 1000,
      itens: [
        item({
          seriesId: "sal",
          flow: "INCOME",
          amount: 4820,
          dueDate: "2026-09-20",
        }),
        item({ seriesId: "alu", amount: 1500, dueDate: "2026-09-25" }),
      ],
      hoje: HOJE,
    });

    // De 17 a 25 são nove dias, e a régua NÃO vai até o dia 30
    expect(regua.dias).toHaveLength(9);
    expect(regua.ultimoDiaConhecido).toBe("2026-09-25");
    expect(regua.dias[0].dia).toBe("2026-09-17");
    expect(regua.dias[0].saldoNoFim).toBe(1000);
    // dia 20: entra o salário
    expect(regua.dias[3].dia).toBe("2026-09-20");
    expect(regua.dias[3].saldoNoFim).toBe(5820);
    // dia 25: sai o aluguel
    expect(regua.dias[8].saldoNoFim).toBe(4320);
    expect(regua.saldoNoFimDoConhecido).toBe(4320);
  });

  it("dois eventos no mesmo dia somam no mesmo passo", () => {
    const regua = montarRegua({
      saldoInicial: 0,
      itens: [
        item({ seriesId: "a", amount: 30, dueDate: "2026-09-18" }),
        item({ seriesId: "b", amount: 70, dueDate: "2026-09-18" }),
      ],
      hoje: HOJE,
    });

    const dia = regua.dias.find((d) => d.dia === "2026-09-18")!;
    expect(dia.eventos).toHaveLength(2);
    expect(dia.movimento).toBe(-100);
    expect(dia.saldoNoFim).toBe(-100);
  });

  it("acha o pior dia da janela — é para isso que a régua existe", () => {
    const regua = montarRegua({
      saldoInicial: 300,
      itens: [
        item({ seriesId: "fat", amount: 900, dueDate: "2026-09-18" }),
        item({
          seriesId: "sal",
          flow: "INCOME",
          amount: 4820,
          dueDate: "2026-09-22",
        }),
      ],
      hoje: HOJE,
    });

    // O saldo vira negativo no dia 18 e só se recupera no 22: é exatamente o
    // buraco que um número único de fim de mês esconderia
    expect(regua.piorDia).toEqual({ dia: "2026-09-18", saldo: -600 });
    expect(regua.saldoNoFimDoConhecido).toBe(4220);
  });

  /**
   * Cadência semanal chega com `dueDate` nulo (o comentário de `ForecastItem`
   * explica por quê). Pôr esses itens "no primeiro dia" moveria o saldo num
   * dia em que nada acontece — pior que omitir, porque a régua existe para
   * dizer QUANDO.
   */
  it("item sem data fica de fora", () => {
    const regua = montarRegua({
      saldoInicial: 100,
      itens: [
        item({ seriesId: "sem", amount: 50, dueDate: null }),
        item({ seriesId: "com", amount: 10, dueDate: "2026-09-19" }),
      ],
      hoje: HOJE,
    });

    expect(regua.saldoNoFimDoConhecido).toBe(90);
    expect(contratados(regua).map((c) => c.seriesId)).toEqual(["com"]);
  });

  /**
   * Item conciliado já está dentro do saldo de partida. Contá-lo de novo é o
   * mesmo erro da parcela cobrada duas vezes em "a pagar", corrigido em 16/09.
   */
  it("item já conciliado não conta de novo", () => {
    const regua = montarRegua({
      saldoInicial: 100,
      itens: [
        item({
          seriesId: "pago",
          amount: 50,
          dueDate: "2026-09-18",
          settled: true,
        }),
        item({ seriesId: "aberto", amount: 10, dueDate: "2026-09-19" }),
      ],
      hoje: HOJE,
    });

    expect(regua.saldoNoFimDoConhecido).toBe(90);
  });

  it("compromisso vencido não mexe no saldo de hoje", () => {
    const regua = montarRegua({
      saldoInicial: 100,
      itens: [
        item({ seriesId: "atrasado", amount: 80, dueDate: "2026-09-10" }),
        item({ seriesId: "futuro", amount: 10, dueDate: "2026-09-19" }),
      ],
      hoje: HOJE,
    });

    expect(regua.saldoNoFimDoConhecido).toBe(90);
  });

  it("nada além da janela de 30 dias entra", () => {
    const regua = montarRegua({
      saldoInicial: 0,
      itens: [
        item({ seriesId: "dentro", amount: 10, dueDate: "2026-10-17" }),
        item({ seriesId: "fora", amount: 999, dueDate: "2026-10-18" }),
      ],
      hoje: HOJE,
    });

    expect(regua.ultimoDiaConhecido).toBe("2026-10-17");
    expect(regua.saldoNoFimDoConhecido).toBe(-10);
  });

  it("atravessa a virada de mês sem pular dia", () => {
    const regua = montarRegua({
      saldoInicial: 0,
      itens: [item({ seriesId: "x", amount: 10, dueDate: "2026-10-02" })],
      hoje: "2026-09-28",
    });

    expect(regua.dias.map((d) => d.dia)).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("data de hoje ilegível não estoura", () => {
    const regua = montarRegua({
      saldoInicial: 42,
      itens: [item({ dueDate: "2026-09-20" })],
      hoje: "nem data",
    });

    expect(regua.dias).toEqual([]);
    expect(regua.saldoNoFimDoConhecido).toBe(42);
  });
});

describe("contratados", () => {
  it("cada compromisso com o saldo que sobra depois dele", () => {
    const regua = montarRegua({
      saldoInicial: 1000,
      itens: [
        item({
          seriesId: "sal",
          flow: "INCOME",
          amount: 4820,
          dueDate: "2026-09-20",
        }),
        item({ seriesId: "alu", amount: 1500, dueDate: "2026-09-25" }),
        item({ seriesId: "luz", amount: 187.4, dueDate: "2026-09-25" }),
      ],
      hoje: HOJE,
    });

    expect(contratados(regua)).toEqual([
      {
        seriesId: "sal",
        dia: "2026-09-20",
        nome: "Aluguel",
        valor: 4820,
        saldoDepois: 5820,
      },
      {
        seriesId: "alu",
        dia: "2026-09-25",
        nome: "Aluguel",
        valor: -1500,
        saldoDepois: 4320,
      },
      {
        seriesId: "luz",
        dia: "2026-09-25",
        nome: "Aluguel",
        valor: -187.4,
        saldoDepois: 4132.6,
      },
    ]);
  });

  it("o último saldo da lista é o mesmo da régua", () => {
    // Duas somas independentes sobre o mesmo dado é como a lista e o gráfico
    // começam a discordar em silêncio
    const regua = montarRegua({
      saldoInicial: 77,
      itens: [
        item({ seriesId: "a", amount: 13, dueDate: "2026-09-18" }),
        item({
          seriesId: "b",
          flow: "INCOME",
          amount: 5,
          dueDate: "2026-09-21",
        }),
      ],
      hoje: HOJE,
    });
    const lista = contratados(regua);

    expect(lista[lista.length - 1].saldoDepois).toBeCloseTo(
      regua.saldoNoFimDoConhecido,
      2,
    );
  });
});

describe("somasContratadas", () => {
  it("separa receita de despesa, as duas positivas", () => {
    const regua = montarRegua({
      saldoInicial: 0,
      itens: [
        item({
          seriesId: "sal",
          flow: "INCOME",
          amount: 4820,
          dueDate: "2026-09-20",
        }),
        item({ seriesId: "alu", amount: 1500, dueDate: "2026-09-25" }),
      ],
      hoje: HOJE,
    });

    expect(somasContratadas(regua)).toEqual({ receita: 4820, despesa: 1500 });
  });
});

describe("tresCenarios", () => {
  const base = {
    saldoInicial: 1000,
    receitaContratada: 4820,
    despesaContratada: 3000,
    despesaMedia: 4200,
    despesaPiorMes: 5100,
  };

  it("folgado é o único que não é estimativa", () => {
    const [folgado] = tresCenarios(base);

    expect(folgado).toEqual({
      chave: "folgado",
      rotulo: "Folgado",
      saldo: 1000 + 4820 - 3000,
      base: "só o que está contratado",
      estimativa: false,
    });
  });

  it("os três saem em ordem, do mais folgado ao mais apertado", () => {
    const saldos = tresCenarios(base).map((c) => c.saldo);

    expect(saldos).toEqual([2820, 1620, 720]);
    expect(saldos[0]).toBeGreaterThan(saldos[1]);
    expect(saldos[1]).toBeGreaterThan(saldos[2]);
  });

  /**
   * A guarda que impede a tela de se contradizer: com histórico curto, a média
   * pode ser MENOR que a despesa já contratada, e o "esperado" apareceria mais
   * folgado que o "folgado". O que está assinado não deixa de ser devido só
   * porque o histórico é curto.
   */
  it("média menor que o contratado não deixa o esperado passar o folgado", () => {
    const cenarios = tresCenarios({
      ...base,
      despesaMedia: 500,
      despesaPiorMes: 900,
    });

    const [folgado, esperado, apertado] = cenarios.map((c) => c.saldo);
    expect(esperado).toBeLessThanOrEqual(folgado);
    expect(apertado).toBeLessThanOrEqual(folgado);
    // As três despesas caem no piso do contratado, então os três empatam —
    // o que é a verdade: sem histórico que sustente outra coisa, o contratado
    // é tudo que se sabe
    expect(esperado).toBe(folgado);
  });

  it("a receita NÃO muda entre cenários", () => {
    // Inventar receita otimista é a forma mais rápida de um app de finanças
    // mentir para quem confia nele
    const comMaisDespesa = tresCenarios({ ...base, despesaPiorMes: 9000 });
    const apertado = comMaisDespesa.find((c) => c.chave === "apertado")!;

    expect(apertado.saldo).toBe(1000 + 4820 - 9000);
  });

  it("sem histórico, só o folgado existe", () => {
    const cenarios = tresCenarios({
      ...base,
      despesaMedia: null,
      despesaPiorMes: null,
    });

    expect(cenarios).toHaveLength(1);
    expect(cenarios[0].chave).toBe("folgado");
  });

  it("com um mês só de histórico, aparecem dois", () => {
    const cenarios = tresCenarios({ ...base, despesaPiorMes: null });

    expect(cenarios.map((c) => c.chave)).toEqual(["folgado", "esperado"]);
  });

  it("cada cenário diz de onde saiu", () => {
    tresCenarios(base).forEach((cenario) => {
      expect(cenario.base.length).toBeGreaterThan(0);
    });
  });
});
