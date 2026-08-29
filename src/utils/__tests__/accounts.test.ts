import type {
  AccountInvoice,
  BankTransaction,
  ConnectorAccount,
} from "../../services/api";
import {
  ORIGIN_ALL,
  ORIGIN_NONE,
  UNKNOWN_ORIGIN_LABEL,
  UNLISTED_ORIGIN_LABEL,
  accountDisplayName,
  accountKindLabel,
  accountSubtitle,
  applyOriginFilter,
  buildInvoiceTimeline,
  creditCardAccounts,
  describeInvoice,
  describeInvoiceFailure,
  describeInvoiceGap,
  describeInvoiceWindow,
  describeOriginFilter,
  indexAccounts,
  invoiceAmountLabel,
  invoiceBreakdown,
  invoiceCycleIsApproximate,
  invoiceDueLabel,
  invoiceGapBetween,
  invoiceIsCredit,
  invoicePeriodLabel,
  invoiceStatusLabel,
  invoiceTitle,
  isCreditCard,
  originFilterOptions,
  originLabel,
  originShortLabel,
  resolveOriginFilter,
} from "../accounts";

function card(overrides: Partial<ConnectorAccount> = {}): ConnectorAccount {
  return {
    id: "acc-cartao",
    name: "Ultravioleta ····1234",
    type: "CREDIT_CARD",
    institution: "Nubank",
    statementClosingDay: 10,
    statementDueDay: 17,
    linked: true,
    ...overrides,
  };
}

function bank(overrides: Partial<ConnectorAccount> = {}): ConnectorAccount {
  return {
    id: "acc-conta",
    name: "Conta ····9911",
    type: "BANK",
    institution: "Inter",
    statementClosingDay: null,
    statementDueDay: null,
    linked: true,
    ...overrides,
  };
}

function tx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: "t1",
    transactionId: "bank-1",
    type: "DEBIT",
    amount: -50,
    description: "IFOOD",
    originalDescription: "IFOOD *REST",
    displayAlias: null,
    date: "2026-08-03T00:00:00Z",
    categoryId: null,
    reviewStatus: "CONFIRMED",
    categorizedBy: null,
    confidence: null,
    normalizedDescription: "ifood rest",
    uploadId: null,
    accountId: null,
    ...overrides,
  };
}

function invoice(overrides: Partial<AccountInvoice> = {}): AccountInvoice {
  return {
    reference: "2026-08",
    periodStart: "2026-07-11",
    periodEnd: "2026-08-10",
    closingDate: "2026-08-10",
    dueDate: "2026-08-17",
    total: 1234.56,
    purchasesTotal: 1500,
    refundsTotal: 265.44,
    paymentsTotal: 900,
    transactionCount: 12,
    open: false,
    transactions: [],
    ...overrides,
  };
}

describe("identificação da conta", () => {
  it("chama o vazio de 'origem não informada' em vez de deixar em branco", () => {
    // Nulo é o estado permanente do histórico antigo e de todo upload manual:
    // ele precisa de uma frase, não de um espaço vazio que pareça defeito
    expect(accountDisplayName(null)).toBe(UNKNOWN_ORIGIN_LABEL);
    expect(accountDisplayName(undefined)).toBe(UNKNOWN_ORIGIN_LABEL);
  });

  it("usa o rótulo do provedor quando ele existe", () => {
    expect(accountDisplayName(card())).toBe("Ultravioleta ····1234");
  });

  it("cai no tipo quando o provedor mandou a conta sem nome", () => {
    // Aqui a conta EXISTE — dizer "origem não informada" seria mentira; o
    // honesto é dizer o que se sabe dela
    expect(accountDisplayName(card({ name: "   " }))).toBe("Cartão de crédito");
    expect(accountDisplayName(bank({ name: "" }))).toBe("Conta");
  });

  it("não chama BANK de conta corrente — poupança chega igual", () => {
    expect(accountKindLabel("BANK")).toBe("Conta");
    expect(accountKindLabel("CREDIT_CARD")).toBe("Cartão de crédito");
  });

  it("descreve o cartão com instituição e ciclo", () => {
    expect(accountSubtitle(card())).toBe(
      "Nubank · cartão de crédito · fecha dia 10 · vence dia 17",
    );
  });

  it("não promete ciclo quando o provedor não informou o fechamento", () => {
    const semCiclo = card({ statementClosingDay: null, statementDueDay: null });
    expect(accountSubtitle(semCiclo)).toBe("Nubank · cartão de crédito");
  });

  it("avisa que a conexão foi removida sem sumir com a conta", () => {
    // Desvincular a instituição não apaga a origem (a API usa SET NULL): o
    // histórico continua identificado, o que acabou foi a sincronização
    expect(accountSubtitle(card({ linked: false }))).toContain(
      "conexão removida",
    );
  });

  it("separa cartão de conta", () => {
    expect(isCreditCard(card())).toBe(true);
    expect(isCreditCard(bank())).toBe(false);
    expect(isCreditCard(null)).toBe(false);
    expect(creditCardAccounts([bank(), card()])).toEqual([card()]);
  });

  it("indexa por id para o extrato casar o accountId em memória", () => {
    const mapa = indexAccounts([card(), bank()]);
    expect(mapa.get("acc-cartao")?.name).toBe("Ultravioleta ····1234");
    expect(mapa.get("inexistente")).toBeUndefined();
  });

  it("separa 'sem origem' de 'origem que não achamos'", () => {
    // Os dois casos parecem iguais na tela e não são: no primeiro o dado não
    // existe; no segundo ele existe e o mapa é que não chegou (falha do
    // /accounts, ou conta apagada no provedor). Uma frase só mentiria em um
    expect(originLabel(null, undefined)).toBe(UNKNOWN_ORIGIN_LABEL);
    expect(originLabel("acc-sumiu", undefined)).toBe(UNLISTED_ORIGIN_LABEL);
    expect(originLabel("acc-cartao", card())).toBe("Ultravioleta ····1234");

    expect(originShortLabel(null, undefined)).toBe("Não informada");
    expect(originShortLabel("acc-sumiu", undefined)).toBe("Não reconhecida");
    expect(originShortLabel("acc-cartao", card())).toBe("Ultravioleta ····1234");
  });
});

describe("opções do filtro de origem", () => {
  it("não existe enquanto nenhum lançamento tem origem", () => {
    // Sem conta sincronizada, "Tudo" e "Sem origem" filtrariam a MESMA lista:
    // a fileira inteira seria decoração na tela de quem só importa OFX
    expect(originFilterOptions([], [tx(), tx({ id: "t2" })])).toEqual([]);
    expect(originFilterOptions([card()], [tx(), tx({ id: "t2" })])).toEqual([]);
  });

  it("conta sem lançamento não vira chip", () => {
    // Chip que filtra para o vazio é um beco: o usuário toca, a lista some e
    // ele culpa o app. A conta continua existindo na tela de faturas.
    const opcoes = originFilterOptions(
      [card(), bank()],
      [tx({ accountId: "acc-cartao" })],
    );
    expect(opcoes.map((o) => o.key)).toEqual([ORIGIN_ALL, "acc-cartao"]);
  });

  it("conta as linhas de cada origem e põe cartão antes de conta", () => {
    const opcoes = originFilterOptions(
      [bank(), card()],
      [
        tx({ id: "a", accountId: "acc-conta" }),
        tx({ id: "b", accountId: "acc-cartao" }),
        tx({ id: "c", accountId: "acc-cartao" }),
        tx({ id: "d" }),
      ],
    );
    expect(opcoes.map((o) => [o.key, o.count])).toEqual([
      [ORIGIN_ALL, 4],
      ["acc-cartao", 2],
      ["acc-conta", 1],
      [ORIGIN_NONE, 1],
    ]);
  });

  it("só oferece 'Sem origem' quando existe linha sem origem", () => {
    const opcoes = originFilterOptions(
      [card()],
      [tx({ accountId: "acc-cartao" })],
    );
    expect(opcoes.some((o) => o.key === ORIGIN_NONE)).toBe(false);
  });

  it("origem desconhecida do /accounts não some da lista, só perde o chip", () => {
    // Conta apagada no provedor entre uma chamada e outra: o lançamento não
    // pode desaparecer só porque o mapa não o reconhece
    const opcoes = originFilterOptions(
      [card()],
      [tx({ accountId: "acc-cartao" }), tx({ id: "orfa", accountId: "sumiu" })],
    );
    expect(opcoes.map((o) => o.key)).toEqual([ORIGIN_ALL, "acc-cartao"]);
    expect(opcoes[0].count).toBe(2);
  });
});

describe("aplicação do filtro", () => {
  const lista = [
    tx({ id: "cartao", accountId: "acc-cartao" }),
    tx({ id: "conta", accountId: "acc-conta" }),
    tx({ id: "orfa" }),
  ];

  it("'Tudo' devolve a mesma lista, sem cópia perdida", () => {
    expect(applyOriginFilter(lista, ORIGIN_ALL)).toBe(lista);
  });

  it("filtra pela conta escolhida", () => {
    expect(applyOriginFilter(lista, "acc-cartao").map((t) => t.id)).toEqual([
      "cartao",
    ]);
  });

  it("'Sem origem' traz exatamente as linhas sem accountId", () => {
    expect(applyOriginFilter(lista, ORIGIN_NONE).map((t) => t.id)).toEqual([
      "orfa",
    ]);
  });
});

describe("filtro selecionado sobrevive à recarga", () => {
  const opcoes = originFilterOptions(
    [card()],
    [tx({ accountId: "acc-cartao" }), tx({ id: "orfa" })],
  );

  it("mantém a escolha que ainda existe", () => {
    expect(resolveOriginFilter("acc-cartao", opcoes)).toBe("acc-cartao");
  });

  it("volta para 'Tudo' quando o chip escolhido sumiu", () => {
    // Sem isto a tela ficaria presa num filtro invisível, mostrando lista
    // vazia e nenhum jeito de sair
    expect(resolveOriginFilter("acc-que-sumiu", opcoes)).toBe(ORIGIN_ALL);
    expect(resolveOriginFilter("acc-cartao", [])).toBe(ORIGIN_ALL);
  });

  it("descreve o recorte por extenso para o resumo da lista", () => {
    expect(describeOriginFilter(ORIGIN_ALL, opcoes)).toBe("Todas as origens");
    expect(describeOriginFilter("acc-cartao", opcoes)).toBe(
      "Ultravioleta ····1234",
    );
    expect(describeOriginFilter(ORIGIN_NONE, opcoes)).toBe(UNKNOWN_ORIGIN_LABEL);
  });
});

describe("leitura da fatura", () => {
  it("marca como aproximado só o ciclo derivado pela API", () => {
    expect(invoiceCycleIsApproximate("CALENDAR_MONTH")).toBe(true);
    expect(invoiceCycleIsApproximate("PROVIDER_CLOSING_DAY")).toBe(false);
  });

  it("separa aberta de fechada", () => {
    expect(invoiceStatusLabel(invoice({ open: true }))).toBe("Em aberto");
    expect(invoiceStatusLabel(invoice())).toBe("Fechada");
  });

  it("explica o total com compras, estornos e pagamentos", () => {
    const linhas = invoiceBreakdown(invoice());
    expect(linhas.map((l) => [l.key, l.value])).toEqual([
      ["purchases", 1500],
      ["refunds", 265.44],
      ["payments", 900],
    ]);
  });

  it("diz por escrito que pagamento NÃO entra no total", () => {
    // O erro de leitura que a separação existe para evitar: pagar a fatura é
    // dinheiro saindo da conta corrente, nunca receita nem abatimento
    const pagamento = invoiceBreakdown(invoice()).find(
      (l) => l.key === "payments",
    );
    expect(pagamento?.hint).toBe("não entra no total");
  });

  it("esconde estorno e pagamento zerados — linha zerada é ruído", () => {
    const linhas = invoiceBreakdown(
      invoice({ refundsTotal: 0, paymentsTotal: 0 }),
    );
    expect(linhas.map((l) => l.key)).toEqual(["purchases"]);
  });

  it("nunca recalcula o total: o número conferível é o do servidor", () => {
    // Fatura em que compras − estornos NÃO bate com o total (arredondamento,
    // versão da API): a tela mostra o que o servidor disse, não a conta refeita
    const divergente = invoice({
      total: 999,
      purchasesTotal: 1500,
      refundsTotal: 0,
    });
    // `\s?` porque o Intl separa "R$" do número com espaço não separável
    expect(describeInvoice(divergente, false)).toMatch(/R\$\s?999,00/);
    expect(describeInvoice(divergente, false)).not.toContain("1.500");
  });

  it("estorno maior que compras é crédito a favor, não dívida", () => {
    // Total negativo é caso legítimo do contrato. Chamá-lo de "TOTAL" em cor
    // neutra faria um saldo A FAVOR do usuário ser lido como o que ele deve
    const favor = invoice({ total: -200, purchasesTotal: 100, refundsTotal: 300 });
    expect(invoiceIsCredit(favor)).toBe(true);
    expect(invoiceAmountLabel(favor)).toBe("CRÉDITO");
    // Falado em módulo: "menos duzentos reais" deixa o ouvinte montando o
    // sinal sozinho, que é onde dívida e crédito se invertem
    expect(describeInvoice(favor, false)).toMatch(
      /crédito de R\$\s?200,00 a seu favor/,
    );
    expect(describeInvoice(favor, false)).not.toContain("-R$");
  });

  it("fatura comum e fatura aberta mantêm o rótulo de sempre", () => {
    expect(invoiceAmountLabel(invoice())).toBe("TOTAL");
    expect(invoiceAmountLabel(invoice({ open: true }))).toBe("PARCIAL");
    expect(invoiceIsCredit(invoice())).toBe(false);
    // Zerada não é crédito: o usuário não tem nada a receber
    expect(invoiceIsCredit(invoice({ total: 0 }))).toBe(false);
  });

  it("fatura só de pagamento não vira receita nem some", () => {
    // Ciclo em que o usuário só quitou a fatura anterior: nada comprado, nada
    // estornado. O total é zero — e o pagamento aparece FORA dele
    const soPagamento = invoice({
      total: 0,
      purchasesTotal: 0,
      refundsTotal: 0,
      paymentsTotal: 900,
    });
    const linhas = invoiceBreakdown(soPagamento);
    expect(linhas.map((l) => [l.key, l.value])).toEqual([
      ["purchases", 0],
      ["payments", 900],
    ]);
    expect(linhas.find((l) => l.key === "payments")?.hint).toBe(
      "não entra no total",
    );
    expect(describeInvoice(soPagamento, false)).toMatch(/R\$\s?0,00/);
    // O 900 não pode encostar no número que o usuário deve
    expect(describeInvoice(soPagamento, false)).not.toContain("900");
  });

  it("monta título, período e vencimento em pt-BR", () => {
    expect(invoiceTitle(invoice())).toBe("Fatura de agosto de 2026");
    expect(invoicePeriodLabel(invoice())).toBe("11/07 → 10/08");
    expect(invoiceDueLabel(invoice())).toBe("Vence em 17/08");
  });

  it("sem vencimento informado a linha não inventa um traço", () => {
    expect(invoiceDueLabel(invoice({ dueDate: null }))).toBeNull();
  });

  it("fala o valor por extenso e avisa que a aberta é parcial", () => {
    const falado = describeInvoice(invoice({ open: true }), false);
    expect(falado).toContain("em aberto, parcial de");
    expect(falado).toContain("R$");
    expect(falado).toContain("1.234,56");
  });

  it("carrega o 'aproximado' para o rótulo falado", () => {
    expect(describeInvoice(invoice(), true)).toContain("(aproximado)");
    expect(describeInvoice(invoice(), false)).not.toContain("aproximado");
  });

  it("traduz cada falha do contrato sem falar em código", () => {
    expect(describeInvoiceFailure(400)).toContain("não tem fatura");
    expect(describeInvoiceFailure(404)).toContain("Não encontramos este cartão");
    expect(describeInvoiceFailure(401)).toContain("sessão expirou");
    expect(describeInvoiceFailure(null)).toContain("Tente de novo");
  });
});

describe("linha do tempo das faturas", () => {
  it("põe a fatura em aberto no topo mesmo se ela vier por último", () => {
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-07" }),
      invoice({ reference: "2026-08", open: true }),
    ]);
    expect(itens.map((i) => i.key)).toEqual(["2026-08-aberta", "2026-07-fechada"]);
  });

  it("marca o ciclo sem lançamento que a API omitiu", () => {
    // Sem esta marca, o usuário leria agosto logo depois de junho sem
    // perceber que julho existiu e foi zero
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-08" }),
      invoice({ reference: "2026-06" }),
    ]);
    expect(itens.map((i) => i.kind)).toEqual(["invoice", "gap", "invoice"]);
    const buraco = itens[1];
    expect(buraco.kind === "gap" && buraco.gap).toEqual({
      from: "2026-07",
      to: "2026-07",
      count: 1,
    });
  });

  it("buraco de anos não é truncado: o resumo bate com o card de baixo", () => {
    // Cartão dormente. A versão com teto de 24 meses cortava o array e
    // escrevia "de agosto de 2024 a julho de 2026" logo acima do card de
    // JANEIRO de 2024 — seis meses sumiam do resumo e da lista ao mesmo tempo
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-08" }),
      invoice({ reference: "2024-01" }),
    ]);
    const buraco = itens[1];
    expect(buraco.kind === "gap" && buraco.gap).toEqual({
      from: "2024-02",
      to: "2026-07",
      count: 30,
    });
    // O extremo mais antigo do texto é o mês seguinte à fatura de baixo
    expect(
      buraco.kind === "gap" ? describeInvoiceGap(buraco.gap) : "",
    ).toBe(
      "Sem lançamentos de fevereiro de 2024 a julho de 2026 · 30 ciclos",
    );
  });

  it("não inventa buraco entre meses consecutivos", () => {
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-08" }),
      invoice({ reference: "2026-07" }),
    ]);
    expect(itens.every((i) => i.kind === "invoice")).toBe(true);
  });

  it("atravessa a virada de ano sem perder mês", () => {
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2027-01" }),
      invoice({ reference: "2026-10" }),
    ]);
    const buraco = itens[1];
    expect(buraco.kind === "gap" && buraco.gap).toEqual({
      from: "2026-11",
      to: "2026-12",
      count: 2,
    });
  });

  it("referência que o parser não entende não gera buraco inventado", () => {
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-08" }),
      invoice({ reference: "sem-mes" }),
    ]);
    expect(itens.map((i) => i.kind)).toEqual(["invoice", "invoice"]);
  });

  it("devolve chave única por item, inclusive com a lista vazia", () => {
    expect(buildInvoiceTimeline([])).toEqual([]);
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-08", open: true }),
      invoice({ reference: "2026-08" }),
    ]);
    expect(new Set(itens.map((i) => i.key)).size).toBe(itens.length);
  });

  it("duas FECHADAS de mesma referência não colidem na chave", () => {
    // O par aberta+fechada acima é salvo pelo desempate "aberta"/"fechada" —
    // este não. Com a chave repetida, um toque expandia os DOIS cards, porque
    // é a chave que marca qual está aberto
    const itens = buildInvoiceTimeline([
      invoice({ reference: "2026-08", total: 100 }),
      invoice({ reference: "2026-08", total: 200 }),
    ]);
    expect(itens).toHaveLength(2);
    expect(new Set(itens.map((i) => i.key)).size).toBe(2);
  });

  it("escreve o buraco de um mês e o de vários", () => {
    expect(describeInvoiceGap({ from: "2026-07", to: "2026-07", count: 1 })).toBe(
      "Sem lançamentos em julho de 2026",
    );
    expect(describeInvoiceGap({ from: "2026-05", to: "2026-07", count: 3 })).toBe(
      "Sem lançamentos de maio de 2026 a julho de 2026 · 3 ciclos",
    );
    expect(describeInvoiceGap(null)).toBe("");
  });

  it("meses vizinhos não geram buraco nenhum", () => {
    expect(invoiceGapBetween("2026-08", "2026-07")).toBeNull();
    expect(invoiceGapBetween("2026-08", "2026-08")).toBeNull();
    // Referência que o parser não entende: a resposta honesta é não afirmar
    expect(invoiceGapBetween("2026-08", "sem-mes")).toBeNull();
  });
});

describe("janela pedida × janela devolvida", () => {
  it("cala quando a janela veio cheia", () => {
    const cheias = [
      invoice({ reference: "2026-08" }),
      invoice({ reference: "2026-07" }),
      invoice({ reference: "2026-06" }),
    ];
    expect(describeInvoiceWindow(cheias, 3)).toBeNull();
  });

  it("explica o 'pedi 6, vieram 4' em vez de deixar o número solto", () => {
    // A API omite ciclo sem lançamento: sem esta frase o seletor afirma "6
    // meses" sobre uma lista de 4 e o usuário acha que perdeu histórico
    const parciais = [
      invoice({ reference: "2026-08" }),
      invoice({ reference: "2026-05" }),
    ];
    expect(describeInvoiceWindow(parciais, 6)).toBe(
      "2 de 6 ciclos fechados têm lançamento. Ciclo sem movimento não vira fatura.",
    );
  });

  it("a fatura em aberto não conta na janela — ela vem de graça", () => {
    // O contrato é explícito: `months` conta faturas FECHADAS, e a aberta não
    // consome o orçamento. Contá-la aqui esconderia um ciclo fechado faltando
    const comAberta = [
      invoice({ reference: "2026-09", open: true }),
      invoice({ reference: "2026-08" }),
    ];
    expect(describeInvoiceWindow(comAberta, 3)).toBe(
      "1 de 3 ciclos fechados tem lançamento. Ciclo sem movimento não vira fatura.",
    );
  });
});
