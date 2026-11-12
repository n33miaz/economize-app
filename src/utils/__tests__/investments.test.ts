import type {
  ForeignQuote,
  InvestmentPosition,
  InvestmentProfile,
  MacroIndicator,
  TreasuryBond,
} from "../../services/api";
import {
  EMPTY_POSITION_FORM,
  INTEREST_OPTIONS,
  INVESTMENT_TYPE_ORDER,
  buildWatchCards,
  explainIndicatorForUser,
  formatBRLOrNull,
  formatProfit,
  formatRate,
  formatRelativeTime,
  formatShortDate,
  groupPositionsByInstitution,
  groupPositionsByType,
  hasTreasuryInterest,
  indexerLabel,
  indexersForType,
  interestSuggestedBy,
  investmentSourceLabel,
  investmentSubtypeLabel,
  investmentTypeLabel,
  isForeignTickerForm,
  isWatching,
  macroCodeForWatch,
  macroValueLabel,
  maturityLabel,
  movementKindLabel,
  movementSignedAmount,
  normalizeInvestmentType,
  normalizeTicker,
  parseDateInput,
  currencyOf,
  exchangeRateFor,
  formatMoney,
  positionCurrentValue,
  positionNeedsQuote,
  positionValueView,
  staleExchangeNotices,
  positionSubtitle,
  positionToFormValues,
  profitOf,
  quoteValueLabel,
  staleLabel,
  treasuryRateLabel,
  treasuryRelevantTo,
  validatePositionForm,
  watchKey,
  watchLabel,
} from "../investments";
import { formatBRL } from "../money";

function position(over: Partial<InvestmentPosition> = {}): InvestmentPosition {
  return {
    id: "pos-1",
    source: "CONNECTOR",
    institution: "Inter",
    accountId: "acc-1",
    name: "CDB Inter 110% CDI",
    code: null,
    type: "FIXED_INCOME",
    subtype: "CDB",
    indexer: "CDI",
    rate: 110,
    currency: "BRL",
    quantity: null,
    unitPrice: null,
    investedAmount: 10000,
    currentValue: 10450.5,
    maturityDate: "2027-03-15",
    positionDate: "2026-09-05",
    updatedAt: "2026-09-05T10:00:00Z",
    stale: false,
    ...over,
  };
}

function profile(over: Partial<InvestmentProfile> = {}): InvestmentProfile {
  return {
    indexers: ["CDI", "SELIC", "USD"],
    watch: [
      { kind: "RATE", code: "CDI" },
      { kind: "RATE", code: "SELIC" },
      { kind: "INDEX", code: "IPCA" },
      { kind: "CURRENCY", code: "USD" },
      { kind: "TICKER", code: "VT", market: "US" },
    ],
    topics: ["selic-cdi", "tesouro", "etf-exterior"],
    derivedFrom: { positions: 3, movements: 12, manualInterests: 1 },
    isDefault: false,
    ...over,
  };
}

function macro(over: Partial<MacroIndicator> = {}): MacroIndicator {
  return {
    code: "CDI",
    name: "CDI",
    value: 14.9,
    unit: "% a.a.",
    referenceDate: "2026-09-05",
    source: "BCB",
    asOf: "2026-09-05T18:00:00Z",
    stale: false,
    ...over,
  };
}

function quote(over: Partial<ForeignQuote> = {}): ForeignQuote {
  return {
    symbol: "VT",
    market: "US",
    price: 118.32,
    currency: "USD",
    priceBrl: 640.12,
    change: 1.1,
    changePercent: 0.94,
    date: "2026-09-05",
    source: "provider",
    asOf: "2026-09-05T21:00:00Z",
    stale: false,
    ...over,
  };
}

function bond(over: Partial<TreasuryBond> = {}): TreasuryBond {
  return {
    name: "Tesouro Selic 2029",
    indexer: "SELIC",
    maturity: "2029-03-01",
    annualRateBuy: 0.1,
    annualRateSell: 0.12,
    unitPriceBuy: 15000,
    unitPriceSell: 14990,
    minInvestment: 150,
    asOf: "2026-09-05T15:00:00Z",
    source: "Tesouro Direto",
    ...over,
  };
}

const AGORA = Date.parse("2026-09-06T12:00:00Z");

describe("rótulos", () => {
  it("traduz tipo, subtipo, indexador, fonte e movimento", () => {
    expect(investmentTypeLabel("FIXED_INCOME")).toBe("Renda fixa");
    expect(investmentTypeLabel("TREASURY")).toBe("Tesouro Direto");
    expect(investmentTypeLabel("ETF")).toBe("ETFs");
    // Tipo desconhecido não vira "undefined" na tela
    expect(investmentTypeLabel("BANANA")).toBe("Outros");
    expect(normalizeInvestmentType("BANANA")).toBe("OTHER");
    expect(normalizeInvestmentType(null)).toBe("OTHER");

    expect(investmentSubtypeLabel("TESOURO_IPCA")).toBe("Tesouro IPCA+");
    expect(investmentSubtypeLabel("cdb")).toBe("CDB");
    // Subtipo novo do servidor é humanizado, nunca exibido cru
    expect(investmentSubtypeLabel("COE_ESTRUTURADO")).toBe("Coe estruturado");
    expect(investmentSubtypeLabel(null)).toBeNull();

    expect(indexerLabel("SELIC")).toBe("Selic");
    expect(indexerLabel("NONE")).toBe("");
    expect(investmentSourceLabel("CONNECTOR")).toBe("Open Finance");
    expect(investmentSourceLabel("MANUAL")).toBe("Manual");
    expect(movementKindLabel("REDEEM")).toBe("Resgate");
    expect(movementKindLabel("YIELD")).toBe("Rendimento");
  });

  it("resgate sai negativo, aplicação e rendimento positivos", () => {
    expect(movementSignedAmount("REDEEM", 500)).toBe(-500);
    expect(movementSignedAmount("REDEEM", -500)).toBe(-500);
    expect(movementSignedAmount("APPLY", -500)).toBe(500);
    expect(movementSignedAmount("YIELD", 12.3)).toBe(12.3);
  });
});

describe("formatRate — a taxa na gramática do indexador", () => {
  it("CDI é percentual DO CDI, não ao ano", () => {
    expect(formatRate(110, "CDI")).toBe("110% do CDI");
    expect(formatRate(102.5, "CDI")).toBe("102,50% do CDI");
    expect(formatRate(null, "CDI")).toBe("CDI");
  });

  it("IPCA e Selic são spread sobre o índice", () => {
    expect(formatRate(6.2, "IPCA")).toBe("IPCA + 6,20% a.a.");
    expect(formatRate(0, "IPCA")).toBe("IPCA");
    expect(formatRate(0.1, "SELIC")).toBe("Selic + 0,10% a.a.");
    expect(formatRate(null, "SELIC")).toBe("Selic");
  });

  it("prefixado é a taxa cheia; sem indexador só mostra quando há taxa", () => {
    expect(formatRate(12.5, "PREFIXADO")).toBe("12,50% a.a.");
    expect(formatRate(null, "PREFIXADO")).toBe("Prefixado");
    expect(formatRate(null, "NONE")).toBeNull();
    expect(formatRate(0, null)).toBeNull();
    expect(formatRate(8, undefined)).toBe("8% a.a.");
    expect(formatRate(2, "USD")).toBe("Dólar + 2% a.a.");
  });

  it("monta a linha de apoio só com o que existe", () => {
    expect(positionSubtitle(position())).toBe("CDB · Inter · 110% do CDI");
    expect(
      positionSubtitle(
        position({ subtype: null, institution: null, indexer: "NONE", rate: null }),
      ),
    ).toBe("");
  });
});

describe("positionCurrentValue — em reais, ou null", () => {
  it("posição do banco devolve o valor que o servidor mandou", () => {
    expect(positionCurrentValue(position())).toBe(10450.5);
  });

  it("sem valor atual, cai em quantidade × preço e depois no investido", () => {
    expect(
      positionCurrentValue(
        position({ currentValue: null, quantity: 10, unitPrice: 25.5 }),
      ),
    ).toBe(255);
    expect(
      positionCurrentValue(position({ currentValue: null, investedAmount: 900 })),
    ).toBe(900);
    expect(
      positionCurrentValue(
        position({ currentValue: null, investedAmount: null }),
      ),
    ).toBeNull();
  });

  it("manual em dólar precisa de cotação: quantidade × preço em reais", () => {
    const vt = position({
      source: "MANUAL",
      type: "ETF",
      code: "vt",
      currency: "USD",
      quantity: 10,
      unitPrice: 100,
      currentValue: null,
      investedAmount: 5000,
    });
    expect(positionNeedsQuote(vt)).toBe(true);
    // O código da posição casa com a cotação em maiúsculas
    expect(positionCurrentValue(vt, { VT: quote() })).toBeCloseTo(6401.2, 2);
  });

  it("sem priceBrl, converte pelo dólar do dia; sem dólar, null", () => {
    const vt = position({
      source: "MANUAL",
      type: "ETF",
      code: "VT",
      currency: "USD",
      quantity: 10,
      currentValue: null,
    });
    expect(
      positionCurrentValue(vt, { VT: quote({ priceBrl: null }) }, 5.4),
    ).toBeCloseTo(10 * 118.32 * 5.4, 2);
    expect(positionCurrentValue(vt, { VT: quote({ priceBrl: null }) })).toBeNull();
    // Sem cotação nenhuma: "cotação indisponível", nunca R$ 0,00
    expect(positionCurrentValue(vt, {})).toBeNull();
  });

  it("manual em dólar com valor em dólar e sem cotação do papel usa o câmbio", () => {
    const vt = position({
      source: "MANUAL",
      code: "VT",
      currency: "USD",
      quantity: null,
      currentValue: 1000,
    });
    expect(positionCurrentValue(vt, {}, 5)).toBe(5000);
  });

  it("posição do banco em dólar NÃO passa pela cotação: o servidor já converteu", () => {
    const bdr = position({ source: "CONNECTOR", currency: "USD", currentValue: 800 });
    expect(positionNeedsQuote(bdr)).toBe(false);
    expect(positionCurrentValue(bdr, {}, 5)).toBe(800);
  });
});

describe("profitOf e formatProfit", () => {
  it("formatBRLOrNull deixa o nulo passar para a tela decidir", () => {
    expect(formatBRLOrNull(1234.5)).toBe(formatBRL(1234.5));
    expect(formatBRLOrNull(null)).toBeNull();
    expect(formatBRLOrNull(Number.NaN)).toBeNull();
  });

  it("valor e percentual sobre o investido", () => {
    expect(profitOf(10000, 10450.5)).toEqual({ value: 450.5, percent: 4.505 });
    expect(profitOf(1000, 900)).toEqual({ value: -100, percent: -10 });
  });

  it("sem base ou sem valor atual não inventa número", () => {
    expect(profitOf(null, 100)).toBeNull();
    expect(profitOf(100, null)).toBeNull();
    // Investido zero: o valor existe, o percentual não
    expect(profitOf(0, 50)).toEqual({ value: 50, percent: null });
  });

  it("resultado desconhecido vira traço, na moeda que for", () => {
    // O resumo da API manda profit:null quando nenhuma posição tem preço
    expect(formatProfit({ value: null, percent: null })).toBe("—");
    expect(formatProfit({ value: null, percent: 5 }, "USD")).toBe("—");
    expect(formatMoney(null as unknown as number, "USD")).toBe("—");
    expect(formatMoney(undefined as unknown as number, "BRL")).toBe("—");
  });

  it("formata com sinal nos dois números", () => {
    expect(formatProfit({ value: 120, percent: 2.3 })).toBe("+R$ 120,00 (+2,30%)");
    expect(formatProfit({ value: -30.5, percent: -1.5 })).toBe("-R$ 30,50 (-1,50%)");
    expect(formatProfit({ value: 50, percent: null })).toBe("+R$ 50,00");
  });
});

describe("groupPositionsByType", () => {
  it("agrupa na ordem fixa, sem grupo vazio, maior valor primeiro", () => {
    const groups = groupPositionsByType([
      position({ id: "a", type: "ETF", currentValue: 100 }),
      position({ id: "b", type: "FIXED_INCOME", currentValue: 50 }),
      position({ id: "c", type: "FIXED_INCOME", currentValue: 500 }),
      // sem valor NENHUM: com o investido a linha mostraria esse número
      position({ id: "d", type: "FIXED_INCOME", currentValue: null, investedAmount: null }),
      position({ id: "e", type: "XPTO" as never, currentValue: 1 }),
    ]);
    expect(groups.map((g) => g.type)).toEqual(["FIXED_INCOME", "ETF", "OTHER"]);
    expect(groups[0].label).toBe("Renda fixa");
    expect(groups[0].positions.map((p) => p.id)).toEqual(["c", "b", "d"]);
    expect(INVESTMENT_TYPE_ORDER).toHaveLength(8);
  });

  it("lista vazia devolve nenhum grupo", () => {
    expect(groupPositionsByType([])).toEqual([]);
  });
});

describe("groupPositionsByInstitution", () => {
  it("ordena pelo TOTAL de cada instituição, não por uma ordem escrita à mão", () => {
    // Tipo é taxonomia e cabe numa ordem fixa; instituição é a carteira de
    // cada pessoa, e ali quem manda é o tamanho
    const groups = groupPositionsByInstitution([
      position({ id: "a", institution: "Banco Inter", currentValue: 100 }),
      position({ id: "b", institution: "Nubank", currentValue: 900 }),
      position({ id: "c", institution: "Banco Inter", currentValue: 300 }),
    ]);

    expect(groups.map((g) => g.label)).toEqual(["Nubank", "Banco Inter"]);
    expect(groups[1].positions.map((p) => p.id)).toEqual(["c", "a"]);
  });

  it("sem instituição fica por último, mesmo sendo a maior soma", () => {
    // Ausência de dado não é um emissor, e promovê-la ao topo da carteira por
    // tamanho daria destaque justamente ao que não se sabe
    const groups = groupPositionsByInstitution([
      position({ id: "a", institution: null, currentValue: 5000 }),
      position({ id: "b", institution: "Nubank", currentValue: 10 }),
      position({ id: "c", institution: "   ", currentValue: 1 }),
    ]);

    expect(groups.map((g) => g.label)).toEqual(["Nubank", "Sem instituição"]);
    // o nome em branco cai no mesmo balde do nulo
    expect(groups[1].positions.map((p) => p.id)).toEqual(["a", "c"]);
  });

  it("posição sem valor não empurra a instituição para cima", () => {
    const groups = groupPositionsByInstitution([
      position({ id: "a", institution: "XP", currentValue: null, investedAmount: null }),
      position({ id: "b", institution: "Nubank", currentValue: 10 }),
    ]);

    expect(groups.map((g) => g.label)).toEqual(["Nubank", "XP"]);
  });

  it("lista vazia devolve nenhum grupo", () => {
    expect(groupPositionsByInstitution([])).toEqual([]);
  });
});

describe("watchLabel / watchKey / macroCodeForWatch", () => {
  it("dá o nome curto de cada interesse", () => {
    expect(watchLabel({ kind: "RATE", code: "CDI" })).toBe("CDI hoje");
    expect(watchLabel({ kind: "RATE", code: "selic" })).toBe("Selic meta");
    expect(watchLabel({ kind: "INDEX", code: "IPCA" })).toBe("IPCA 12 meses");
    expect(watchLabel({ kind: "INDEX", code: "IGPM" })).toBe("IGP-M 12 meses");
    expect(watchLabel({ kind: "CURRENCY", code: "USD" })).toBe("Dólar");
    expect(watchLabel({ kind: "CURRENCY", code: "JPY" })).toBe("JPY");
    expect(watchLabel({ kind: "TICKER", code: "VT", market: "US" })).toBe(
      "VT · Vanguard Total World",
    );
    // Ticker fora da lista aparece só pelo código — inventar nome seria pior
    expect(watchLabel({ kind: "TICKER", code: "ZZZZ" })).toBe("ZZZZ");
  });

  it("a chave ignora caixa e junta tipo e código", () => {
    expect(watchKey({ kind: "TICKER", code: "vt" })).toBe("TICKER:VT");
    expect(isWatching(profile(), { kind: "RATE", code: "cdi" })).toBe(true);
    expect(isWatching(profile(), { kind: "INDEX", code: "IGPM" })).toBe(false);
    expect(isWatching(null, { kind: "RATE", code: "CDI" })).toBe(false);
  });

  it("aponta o interesse para a série macro certa", () => {
    expect(macroCodeForWatch({ kind: "RATE", code: "CDI" })).toBe("CDI");
    expect(macroCodeForWatch({ kind: "INDEX", code: "IPCA" })).toBe("IPCA_12M");
    expect(macroCodeForWatch({ kind: "INDEX", code: "IPCA_MES" })).toBe("IPCA_MES");
    expect(macroCodeForWatch({ kind: "INDEX", code: "POUPANCA" })).toBe("POUPANCA");
    expect(macroCodeForWatch({ kind: "CURRENCY", code: "USD" })).toBe("USD_PTAX");
    expect(macroCodeForWatch({ kind: "CURRENCY", code: "EUR" })).toBeNull();
    expect(macroCodeForWatch({ kind: "TICKER", code: "VT" })).toBeNull();
  });
});

describe("formatos de valor", () => {
  it("macro segue a unidade", () => {
    expect(macroValueLabel(macro())).toBe("14,90% a.a.");
    expect(macroValueLabel(macro({ code: "IPCA_12M", value: 4.5, unit: "%" }))).toBe("4,50%");
    expect(
      macroValueLabel(macro({ code: "USD_PTAX", value: 5.4321, unit: "BRL" })),
    ).toBe("R$ 5,4321");
    expect(macroValueLabel(macro({ code: "USD_PTAX", value: 5.4, unit: "BRL" }))).toBe(
      "R$ 5,40",
    );
    expect(macroValueLabel(macro({ value: 12.3456, unit: "pts" }))).toBe("12,35 pts");
  });

  it("cotação mostra o símbolo da moeda do papel", () => {
    expect(quoteValueLabel(quote())).toBe("US$ 118,32");
    expect(quoteValueLabel(quote({ currency: "EUR", price: 10 }))).toBe("EUR 10,00");
  });
});

describe("buildWatchCards — o que a fileira de Seus indicadores desenha", () => {
  const macros = [
    macro(),
    macro({ code: "SELIC", name: "Selic", value: 15 }),
    macro({ code: "IPCA_12M", name: "IPCA 12m", value: 4.5, unit: "%", stale: true, referenceDate: "2026-09-05" }),
    macro({ code: "IPCA_MES", name: "IPCA mês", value: 0.3, unit: "%" }),
    macro({ code: "USD_PTAX", name: "Dólar", value: 5.41, unit: "BRL" }),
  ];

  it("um cartão por interesse, na ordem do perfil, com valor e nota de atraso", () => {
    const cards = buildWatchCards(profile(), macros, { VT: quote() }, AGORA);
    expect(cards.map((c) => c.label)).toEqual([
      "CDI hoje",
      "Selic meta",
      "IPCA 12 meses",
      "Dólar",
      "VT · Vanguard Total World",
    ]);
    expect(cards[0].value).toBe("14,90% a.a.");
    expect(cards[0].staleNote).toBeNull();
    // IPCA de 12 meses traz o do mês na linha de baixo
    expect(cards[2].value).toBe("4,50%");
    expect(cards[2].secondary).toBe("0,30% no mês");
    expect(cards[2].staleNote).toBe("dado de ontem");
    expect(cards[3].value).toBe("R$ 5,41");
    // Ticker: preço em dólar, reais embaixo e a variação do dia
    expect(cards[4].value).toBe("US$ 118,32");
    expect(cards[4].secondary).toBe("R$ 640,12");
    expect(cards[4].variation).toBe(0.94);
    expect(cards[4].explainCode).toBe("VT");
  });

  it("interesse sem dado aparece com valor nulo — o usuário pediu, então ele existe", () => {
    const cards = buildWatchCards(profile(), [], {}, AGORA);
    expect(cards).toHaveLength(5);
    cards.forEach((card) => expect(card.value).toBeNull());
  });

  it("sem perfil não há cartão", () => {
    expect(buildWatchCards(null, macros, {}, AGORA)).toEqual([]);
  });
});

describe("explainIndicatorForUser — a frase muda com o perfil", () => {
  it("CDI para quem tem CDB fala do rendimento dele", () => {
    expect(explainIndicatorForUser("CDI", profile())).toBe(
      "Seu CDB rende um percentual do CDI: quando ele cai, seu rendimento cai junto.",
    );
    expect(explainIndicatorForUser("CDI", profile({ indexers: [] }))).toMatch(
      /régua da renda fixa/,
    );
  });

  it("Selic muda para quem tem Tesouro Selic, quem só tem CDI e quem não tem nada", () => {
    expect(explainIndicatorForUser("SELIC", profile())).toMatch(/Tesouro Selic acompanha a Selic/);
    expect(explainIndicatorForUser("SELIC", profile({ indexers: ["CDI"] }))).toMatch(
      /CDI segue a Selic/,
    );
    expect(explainIndicatorForUser("SELIC", profile({ indexers: [] }))).toMatch(/taxa básica/);
  });

  it("IPCA fala do título IPCA+ só para quem o tem", () => {
    expect(explainIndicatorForUser("IPCA_12M", profile({ indexers: ["IPCA"] }))).toMatch(
      /título IPCA\+/,
    );
    expect(explainIndicatorForUser("IPCA", profile())).toMatch(/poder de compra/);
  });

  it("dólar cita a VT pelo nome quando ela é o único ticker acompanhado", () => {
    expect(explainIndicatorForUser("USD_PTAX", profile())).toBe(
      "A VT é cotada em dólar: a variação do câmbio entra no seu resultado em reais.",
    );
    const dois = profile({
      watch: [
        { kind: "TICKER", code: "VT" },
        { kind: "TICKER", code: "VOO" },
      ],
    });
    expect(explainIndicatorForUser("USD", dois)).toMatch(/Seus ETFs no exterior/);
    expect(
      explainIndicatorForUser("USD", profile({ watch: [], indexers: ["USD"] })),
    ).toMatch(/Parte da sua carteira/);
    expect(explainIndicatorForUser("USD", profile({ watch: [], indexers: [] }))).toMatch(
      /importados/,
    );
  });

  it("IGP-M, poupança e ticker têm frase própria", () => {
    expect(explainIndicatorForUser("IGPM", profile())).toMatch(/aluguéis/);
    expect(explainIndicatorForUser("POUPANCA", profile())).toMatch(/percentual do CDI/);
    expect(explainIndicatorForUser("POUPANCA", profile({ indexers: [] }))).toMatch(
      /comparação de base/,
    );
    expect(explainIndicatorForUser("VT", profile())).toMatch(/Vanguard Total World/);
    expect(explainIndicatorForUser("ZZZZ", null)).toBe(
      "ZZZZ é cotado em dólar: preço e câmbio somam no seu resultado em reais.",
    );
  });
});

describe("Tesouro Direto — só o que fala com o perfil", () => {
  const bonds = [
    bond(),
    bond({ name: "Tesouro IPCA+ 2035", indexer: "IPCA", annualRateBuy: 6.2 }),
    bond({ name: "Tesouro Prefixado 2029", indexer: "PREFIXADO", annualRateBuy: 12.5 }),
  ];

  it("filtra pelos indexadores do perfil", () => {
    expect(treasuryRelevantTo(profile(), bonds).map((b) => b.name)).toEqual([
      "Tesouro Selic 2029",
    ]);
    expect(
      treasuryRelevantTo(profile({ indexers: ["IPCA", "PREFIXADO"] }), bonds).map(
        (b) => b.indexer,
      ),
    ).toEqual(["IPCA", "PREFIXADO"]);
  });

  it("perfil sem indexador do Tesouro (só CDI, só dólar) não tem título relevante", () => {
    expect(treasuryRelevantTo(profile({ indexers: ["CDI", "USD"] }), bonds)).toEqual([]);
    expect(hasTreasuryInterest(profile({ indexers: ["CDI", "USD"] }))).toBe(false);
    expect(hasTreasuryInterest(profile())).toBe(true);
    expect(hasTreasuryInterest(null)).toBe(false);
    expect(treasuryRelevantTo(null, bonds)).toEqual([]);
  });

  it("taxa de compra na gramática do título", () => {
    expect(treasuryRateLabel(bonds[0])).toBe("Selic + 0,10% a.a.");
    expect(treasuryRateLabel(bonds[1])).toBe("IPCA + 6,20% a.a.");
    expect(treasuryRateLabel(bonds[2])).toBe("12,50% a.a.");
    expect(treasuryRateLabel(bond({ annualRateBuy: null }))).toBeNull();
  });
});

describe("datas", () => {
  it("data curta e vencimento", () => {
    expect(formatShortDate("2027-03-15")).toBe("15/03/2027");
    expect(formatShortDate("2027-03-15T00:00:00Z")).toBe("15/03/2027");
    expect(formatShortDate(null)).toBeNull();
    expect(formatShortDate("lixo")).toBeNull();
    expect(maturityLabel("2027-03-15")).toBe("vence 15/03/2027");
    expect(maturityLabel(null)).toBeNull();
  });

  it("tempo relativo do 'atualizado há …'", () => {
    expect(formatRelativeTime("2026-09-06T11:59:40Z", AGORA)).toBe("agora");
    expect(formatRelativeTime("2026-09-06T11:55:00Z", AGORA)).toBe("há 5 min");
    expect(formatRelativeTime("2026-09-06T09:00:00Z", AGORA)).toBe("há 3 h");
    expect(formatRelativeTime("2026-09-05T09:00:00Z", AGORA)).toBe("há 1 dia");
    expect(formatRelativeTime("2026-09-03T09:00:00Z", AGORA)).toBe("há 3 dias");
    expect(formatRelativeTime("2026-08-01T09:00:00Z", AGORA)).toBe("01/08/2026");
    expect(formatRelativeTime(null, AGORA)).toBeNull();
    expect(formatRelativeTime("lixo", AGORA)).toBeNull();
  });

  it("nota de atraso diz de que dia é o número", () => {
    expect(staleLabel("2026-09-05", AGORA)).toBe("dado de ontem");
    expect(staleLabel("2026-09-01", AGORA)).toBe("dado de 01/09");
    expect(staleLabel("2026-09-06", AGORA)).toBe("dado de hoje, sem atualização");
    expect(staleLabel(null, AGORA)).toBe("dado antigo");
  });
});

describe("formulário da posição manual", () => {
  // Dinheiro pela regra do dinheiro, quantidade e taxa pela de número: a
  // leitura antiga dava "1.000" reais como 1
  const ler = (campos: Partial<typeof EMPTY_POSITION_FORM>) =>
    validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "Posição",
      ...campos,
    });

  it.each([
    ["investedAmount", "1.000", 1000],
    ["investedAmount", "1.234,56", 1234.56],
    ["investedAmount", "1234.56", 1234.56],
    ["currentValue", "2.500", 2500],
    ["unitPrice", "118,32", 118.32],
    ["quantity", "1.234", 1.234],
    ["quantity", "0,5", 0.5],
    ["quantity", "1.234.567", 1234567],
    ["rate", "12,5", 12.5],
    ["rate", "10.75", 10.75],
  ] as const)("%s %j → %p", (campo, texto, esperado) => {
    const result = ler({
      investedAmount: "100",
      quantity: "1",
      unitPrice: "1",
      indexer: "CDI",
      [campo]: texto,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload[campo]).toBe(esperado);
  });

  it("vazio é não informado; texto sem número é erro do campo", () => {
    const vazio = ler({ investedAmount: "100", quantity: "" });
    expect(vazio.ok).toBe(true);
    if (vazio.ok) expect(vazio.payload.quantity).toBeNull();

    const lixo = ler({ investedAmount: "abc" });
    expect(lixo.ok).toBe(false);
    if (!lixo.ok) expect(lixo.errors.investedAmount).toMatch(/maior que zero/);
  });

  it("aceita data brasileira e ISO, e recusa 31/02", () => {
    expect(parseDateInput("15/03/2027")).toBe("2027-03-15");
    expect(parseDateInput("2027-03-15")).toBe("2027-03-15");
    expect(parseDateInput("31/02/2027")).toBeNull();
    expect(parseDateInput("15-03-2027")).toBeNull();
    expect(parseDateInput("")).toBeNull();
  });

  it("exige nome e alguma medida do investido", () => {
    const result = validatePositionForm({ ...EMPTY_POSITION_FORM });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.name).toBeTruthy();
      expect(result.errors.investedAmount).toMatch(/valor investido/);
    }
  });

  it("ação, ETF e cripto exigem código, e ele sai em maiúsculas", () => {
    const semCodigo = validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "Vanguard",
      type: "ETF",
      investedAmount: "5000",
    });
    expect(semCodigo.ok).toBe(false);
    if (!semCodigo.ok) expect(semCodigo.errors.code).toBeTruthy();

    const comCodigo = validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "Vanguard Total World",
      type: "ETF",
      code: "vt",
      currency: "usd",
      indexer: "NONE",
      quantity: "10",
      unitPrice: "118,32",
      investedAmount: "6.000,00",
    });
    expect(comCodigo.ok).toBe(true);
    if (comCodigo.ok) {
      expect(comCodigo.payload).toMatchObject({
        name: "Vanguard Total World",
        type: "ETF",
        code: "VT",
        currency: "USD",
        indexer: null,
        rate: null,
        quantity: 10,
        unitPrice: 118.32,
        investedAmount: 6000,
      });
      expect(interestSuggestedBy(comCodigo.payload)).toEqual({
        kind: "TICKER",
        code: "VT",
        market: "US",
      });
    }
  });

  it("quantidade e preço em reais preenchem o investido; em dólar, não", () => {
    const real = validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "BOVA11",
      type: "ETF",
      code: "BOVA11",
      indexer: "NONE",
      quantity: "10",
      unitPrice: "120",
    });
    expect(real.ok && real.payload.investedAmount).toBe(1200);

    const dolar = validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "VT",
      type: "ETF",
      code: "VT",
      currency: "USD",
      indexer: "NONE",
      quantity: "10",
      unitPrice: "100",
    });
    // Quantidade × preço daria dólares no campo que promete reais
    expect(dolar.ok && dolar.payload.investedAmount).toBeNull();
    expect(interestSuggestedBy(real.ok ? real.payload : { name: "", type: "ETF" })).toBeNull();
  });

  it("recusa número negativo, zero onde não cabe e data inválida", () => {
    const result = validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "CDB",
      quantity: "-1",
      unitPrice: "0",
      investedAmount: "abc",
      rate: "110",
      maturityDate: "32/13/2027",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.quantity).toMatch(/maior que zero/);
      expect(result.errors.unitPrice).toMatch(/maior que zero/);
      expect(result.errors.investedAmount).toMatch(/maior que zero/);
      expect(result.errors.maturityDate).toMatch(/dia\/mês\/ano/);
    }
  });

  it("CDB completo vira o corpo do cadastro com vencimento ISO", () => {
    const result = validatePositionForm({
      ...EMPTY_POSITION_FORM,
      name: "CDB Inter",
      type: "FIXED_INCOME",
      subtype: "CDB",
      institution: "Inter",
      indexer: "CDI",
      rate: "110",
      investedAmount: "10.000,00",
      currentValue: "10.450,50",
      maturityDate: "15/03/2027",
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload).toEqual({
        name: "CDB Inter",
        type: "FIXED_INCOME",
        subtype: "CDB",
        code: null,
        institution: "Inter",
        indexer: "CDI",
        rate: 110,
        currency: "BRL",
        quantity: null,
        unitPrice: null,
        investedAmount: 10000,
        currentValue: 10450.5,
        maturityDate: "2027-03-15",
      });
    }
  });

  it("volta a posição para o formulário no formato de digitação", () => {
    const values = positionToFormValues(
      position({ rate: 110.5, quantity: 10, maturityDate: "2027-03-15" }),
    );
    expect(values.rate).toBe("110,5");
    expect(values.quantity).toBe("10");
    expect(values.maturityDate).toBe("15/03/2027");
    expect(values.indexer).toBe("CDI");
    expect(positionToFormValues(null)).toEqual(EMPTY_POSITION_FORM);
    expect(positionToFormValues(position({ indexer: null })).indexer).toBe("NONE");
  });

  it("indexadores por tipo e a detecção de ticker no exterior", () => {
    expect(indexersForType("FIXED_INCOME")).toContain("CDI");
    expect(indexersForType("TREASURY")).toEqual(["SELIC", "IPCA", "PREFIXADO"]);
    expect(indexersForType("CRYPTO")).toEqual(["NONE"]);
    expect(isForeignTickerForm({ ...EMPTY_POSITION_FORM, type: "ETF", currency: "USD" })).toBe(true);
    expect(isForeignTickerForm({ ...EMPTY_POSITION_FORM, type: "ETF", currency: "BRL" })).toBe(false);
    expect(
      isForeignTickerForm({ ...EMPTY_POSITION_FORM, type: "FIXED_INCOME", currency: "USD" }),
    ).toBe(false);
  });

  it("normaliza o ticker digitado", () => {
    expect(normalizeTicker(" vt ")).toBe("VT");
    expect(normalizeTicker("bova11")).toBe("BOVA11");
    expect(normalizeTicker("BRK.B")).toBe("BRK.B");
    expect(normalizeTicker("")).toBeNull();
    expect(normalizeTicker("um ticker enorme demais")).toBeNull();
    // As opções prontas cobrem o que a API macro entrega
    expect(INTEREST_OPTIONS.map((o) => o.code)).toEqual(
      expect.arrayContaining(["CDI", "SELIC", "IPCA", "USD"]),
    );
  });
});

describe("moeda estrangeira — a posição na moeda dela", () => {
  // O Intl separa símbolo e número com espaço não separável; as expectativas
  // ficam legíveis com espaço comum
  const limpo = (texto: string | null) => texto?.replace(/\u00A0/g, " ") ?? null;

  const DOLAR = position({
    id: "pos-usd",
    source: "CONNECTOR",
    currency: "USD",
    investedAmount: 800,
    currentValue: 1000,
  });
  const CAMBIO = { currency: "USD", rate: 5.4, asOf: "2026-11-04T15:00:00Z", stale: false };

  it("formata na moeda certa, e moeda desconhecida sai pelo código — nunca R$", () => {
    expect(limpo(formatMoney(1234.5, "USD"))).toBe("US$ 1.234,50");
    expect(limpo(formatMoney(-10, "eur"))).toBe("-€ 10,00");
    expect(limpo(formatMoney(10, "CHF"))).toBe("CHF 10,00");
    expect(limpo(formatMoney(10, "BRL"))).toBe("R$ 10,00");
    // Código torto do conector não derruba a lista
    expect(limpo(formatMoney(10, "??"))).toBe("?? 10,00");
    expect(currencyOf({ currency: null })).toBe("BRL");
    expect(currencyOf({ currency: " usd " })).toBe("USD");
    expect(limpo(formatProfit({ value: 200, percent: 25 }, "USD"))).toBe(
      "+US$ 200,00 (+25,00%)",
    );
  });

  it("convertida: valor em dólar, equivalente em reais pelo câmbio do servidor", () => {
    const view = positionValueView(DOLAR, { exchangeRates: [CAMBIO] });
    expect(limpo(view.primary)).toBe("US$ 1.000,00");
    expect(limpo(view.equivalent)).toBe("≈ R$ 5.400,00");
    // Resultado dólar contra dólar: misturar com reais daria +4.600
    expect(limpo(view.profitLabel)).toBe("+US$ 200,00 (+25,00%)");
    expect(view.excluded).toBe(false);
  });

  it("sem cotação: só a moeda de origem, marcada como fora do total", () => {
    const view = positionValueView(
      DOLAR,
      {
        unconverted: [
          { id: "pos-usd", name: "x", code: null, currency: "USD", investedAmount: 800, currentValue: 1000 },
        ],
        exchangeRates: [],
      },
      {},
      // O dólar do bloco macro está à mão, e mesmo assim não entra: o total
      // do servidor não tem esta posição
      5.41,
    );
    expect(limpo(view.primary)).toBe("US$ 1.000,00");
    expect(view.equivalent).toBeNull();
    expect(view.excluded).toBe(true);
  });

  it("manual sem cotação também não ganha reais do dólar local", () => {
    const manual = { ...DOLAR, source: "MANUAL" as const };
    const view = positionValueView(
      manual,
      { unconverted: [{ id: "pos-usd", name: "x", code: null, currency: "USD", investedAmount: null, currentValue: null }] },
      {},
      5.41,
    );
    expect(limpo(view.primary)).toBe("US$ 1.000,00");
    expect(view.equivalent).toBeNull();
    expect(view.excluded).toBe(true);
  });

  it("resposta antiga (sem os campos): dólar do conector aparece em dólar, sem equivalente", () => {
    [null, undefined, {}].forEach((summary) => {
      const view = positionValueView(DOLAR, summary);
      expect(limpo(view.primary)).toBe("US$ 1.000,00");
      expect(view.equivalent).toBeNull();
      expect(view.excluded).toBe(false);
    });
    expect(staleExchangeNotices(null)).toEqual([]);
    expect(staleExchangeNotices({})).toEqual([]);
    expect(exchangeRateFor({}, "USD")).toBeNull();
  });

  it("resposta antiga: reais e manual em dólar continuam como eram", () => {
    const reais = positionValueView(position({ investedAmount: 100, currentValue: 120 }), undefined);
    expect(limpo(reais.primary)).toBe("R$ 120,00");
    expect(limpo(reais.profitLabel)).toBe("+R$ 20,00 (+20,00%)");

    const manual = position({
      source: "MANUAL",
      currency: "USD",
      code: "VT",
      quantity: 10,
      investedAmount: null,
      currentValue: null,
    });
    const comCotacao = positionValueView(manual, undefined, { VT: quote({ priceBrl: 640 }) });
    // O papel é cotado em dólar: o número da posição é em dólar, e os reais
    // são conta derivada — antes saía "R$ 6.400,00" como se fosse o valor dela
    expect(limpo(comCotacao.primary)).toBe("US$ 1.183,20");
    expect(limpo(comCotacao.equivalent)).toBe("≈ R$ 6.400,00");
    expect(positionValueView(manual, undefined).primary).toBeNull();
  });

  describe("posição manual de ticker no exterior", () => {
    // O que o formulário grava: quantidade, custo em REAIS e nenhum valor
    // atual — quem dá o valor é a cotação do papel, na moeda dele
    const VT = position({
      id: "pos-vt",
      source: "MANUAL",
      currency: "USD",
      code: "VT",
      quantity: 2,
      unitPrice: 100,
      investedAmount: 1000,
      currentValue: null,
    });

    it("com cotação e sem câmbio: valor em dólar, sem reais, fora do total por falta de CÂMBIO", () => {
      // Medido em 12/11/2026: a API devolvia price 110,5 / priceBrl null e a
      // tela dizia "cotação indisponível" — a cotação existia, faltava o dólar
      const view = positionValueView(VT, { exchangeRates: [] }, { VT: quote({ price: 110.5, priceBrl: null }) });
      expect(limpo(view.primary)).toBe("US$ 221,00");
      expect(view.equivalent).toBeNull();
      expect(view.excluded).toBe(true);
      expect(view.missing).toBe("fx");
      // Custo em reais contra valor em dólar não é resultado de nada
      expect(view.profitLabel).toBeNull();
    });

    it("com cotação e câmbio do servidor (priceBrl): dólar, ≈ reais e resultado em reais", () => {
      const view = positionValueView(VT, undefined, { VT: quote({ price: 110.5, priceBrl: 600 }) });
      expect(limpo(view.primary)).toBe("US$ 221,00");
      expect(limpo(view.equivalent)).toBe("≈ R$ 1.200,00");
      expect(view.excluded).toBe(false);
      expect(view.missing).toBeNull();
      // Investido R$ 1.000 contra R$ 1.200: os dois lados em reais
      expect(limpo(view.profitLabel)).toBe("+R$ 200,00 (+20,00%)");
    });

    it("com cotação em dólar e só o dólar do bloco macro: converte por ele", () => {
      const view = positionValueView(VT, undefined, { VT: quote({ price: 110.5, priceBrl: null }) }, 5);
      expect(limpo(view.primary)).toBe("US$ 221,00");
      expect(limpo(view.equivalent)).toBe("≈ R$ 1.105,00");
      expect(view.excluded).toBe(false);
    });

    it("sem a cotação do papel: sem valor, fora do total por falta de COTAÇÃO", () => {
      const view = positionValueView(VT, { exchangeRates: [] }, {}, 5);
      expect(view.primary).toBeNull();
      expect(view.equivalent).toBeNull();
      expect(view.excluded).toBe(true);
      expect(view.missing).toBe("quote");
    });

    it("cotação em outra moeda que não o dólar: o dólar macro não serve de câmbio", () => {
      const view = positionValueView(
        { ...VT, currency: "EUR" },
        undefined,
        { VT: quote({ price: 50, currency: "EUR", priceBrl: null }) },
        5,
      );
      expect(limpo(view.primary)).toBe("€ 100,00");
      expect(view.equivalent).toBeNull();
      expect(view.missing).toBe("fx");
    });
  });

  it("conector em dólar sem valor atual cai em quantidade × preço, ainda em dólar", () => {
    const view = positionValueView(
      { ...DOLAR, currentValue: null, quantity: 4, unitPrice: 50 },
      { exchangeRates: [CAMBIO] },
    );
    expect(limpo(view.primary)).toBe("US$ 200,00");
    expect(limpo(view.equivalent)).toBe("≈ R$ 1.080,00");
  });

  it("câmbio inválido não vira equivalente", () => {
    [0, -1, NaN].forEach((rate) => {
      const view = positionValueView(DOLAR, { exchangeRates: [{ ...CAMBIO, rate }] });
      expect(view.equivalent).toBeNull();
    });
    expect(exchangeRateFor({ exchangeRates: [{ ...CAMBIO, currency: "usd" }] }, "USD")?.rate).toBe(5.4);
  });

  it("cotação velha: aviso com a data, só para stale", () => {
    expect(
      staleExchangeNotices({
        exchangeRates: [
          { ...CAMBIO, stale: true },
          { currency: "EUR", rate: 6.1, asOf: "2026-11-10T15:00:00Z", stale: false },
        ],
      }),
    ).toEqual(["Câmbio US$ de 04/11/2026"]);
    expect(
      staleExchangeNotices({ exchangeRates: [{ ...CAMBIO, asOf: null, stale: true }] }),
    ).toEqual(["Câmbio US$ desatualizado"]);
  });

  it("a ordem da lista compara em reais; sem câmbio a posição fica por último", () => {
    const reais = position({ id: "brl", currentValue: 1200 });
    const semCambio = position({ id: "eur", currency: "EUR", currentValue: 9999 });
    const [grupo] = groupPositionsByType([reais, semCambio, DOLAR], {
      exchangeRates: [CAMBIO],
    });
    // US$ 1.000 × 5,4 = R$ 5.400 passa na frente de R$ 1.200
    expect(grupo.positions.map((p) => p.id)).toEqual(["pos-usd", "brl", "eur"]);

    const grupos = groupPositionsByInstitution(
      [
        { ...reais, institution: "A" },
        { ...DOLAR, institution: "B" },
      ],
      { exchangeRates: [CAMBIO] },
    );
    expect(grupos.map((g) => g.key)).toEqual(["B", "A"]);
  });

  it("a ordem usa o valor que a linha mostra: quantidade × preço quando falta o valor atual", () => {
    const resumo = { exchangeRates: [CAMBIO] };
    // US$ 10 × 100 = US$ 1.000 → R$ 5.400, o mesmo número da linha
    const porQuantidade = position({
      id: "usd-qtd",
      currency: "USD",
      currentValue: null,
      quantity: 10,
      unitPrice: 100,
      investedAmount: null,
      institution: "B",
    });
    expect(positionValueView(porQuantidade, resumo).equivalent).toBe(
      `≈ ${formatBRL(5400)}`,
    );
    const reais = position({ id: "brl", currentValue: 1200, institution: "A" });
    const menor = position({ id: "brl-2", currentValue: 300, institution: "B" });

    const [grupo] = groupPositionsByType([reais, menor, porQuantidade], resumo);
    expect(grupo.positions.map((p) => p.id)).toEqual(["usd-qtd", "brl", "brl-2"]);

    const grupos = groupPositionsByInstitution([reais, menor, porQuantidade], resumo);
    expect(grupos.map((g) => g.key)).toEqual(["B", "A"]);
    expect(grupos[0].positions.map((p) => p.id)).toEqual(["usd-qtd", "brl-2"]);
  });

  it("a manual em dólar cotada pelo app compete pelo ≈ R$ que a linha mostra", () => {
    const resumo = { exchangeRates: [CAMBIO] };
    const cotada = position({
      id: "vt",
      source: "MANUAL",
      code: "VT",
      currency: "USD",
      currentValue: null,
      quantity: 2,
      investedAmount: 1000,
      institution: "B",
    });
    const cotacoes = { VT: quote({ priceBrl: 600 }) };
    expect(positionValueView(cotada, resumo, cotacoes).equivalent).toBe(
      `≈ ${formatBRL(1200)}`,
    );
    const reais = position({ id: "brl", currentValue: 500, institution: "A" });

    // Sem as cotações ela ainda não tem valor e fica por último...
    const [antes] = groupPositionsByType([cotada, reais], resumo);
    expect(antes.positions.map((p) => p.id)).toEqual(["brl", "vt"]);
    // ...com elas, R$ 1.200 passa na frente de R$ 500
    const [grupo] = groupPositionsByType([reais, cotada], resumo, cotacoes);
    expect(grupo.positions.map((p) => p.id)).toEqual(["vt", "brl"]);

    // Sem priceBrl vale o dólar do bloco macro: 2 × 118,32 × 5 = R$ 1.183,20
    const [peloDolar] = groupPositionsByType(
      [reais, cotada],
      resumo,
      { VT: quote({ priceBrl: null }) },
      5,
    );
    expect(peloDolar.positions.map((p) => p.id)).toEqual(["vt", "brl"]);

    // O TAMANHO da instituição não usa a cotação (o total ainda é decisão do
    // dono): se usasse, B valeria R$ 1.200 e passaria na frente de A, R$ 500
    const grupos = groupPositionsByInstitution([cotada, reais], resumo, cotacoes);
    expect(grupos.map((g) => g.key)).toEqual(["A", "B"]);
  });

  it("posições sem valor ficam por último, na ordem em que vieram", () => {
    const semValor = (id: string) =>
      position({ id, currentValue: null, investedAmount: null });
    const [grupo] = groupPositionsByType([
      semValor("x"),
      semValor("y"),
      position({ id: "a", currentValue: 10 }),
      semValor("z"),
    ]);
    expect(grupo.positions.map((p) => p.id)).toEqual(["a", "x", "y", "z"]);
  });

  it("em reais também: sem valor atual, vale quantidade × preço", () => {
    const [grupo] = groupPositionsByType([
      position({ id: "a", currentValue: 500 }),
      position({ id: "b", currentValue: null, quantity: 3, unitPrice: 400 }),
    ]);
    expect(grupo.positions.map((p) => p.id)).toEqual(["b", "a"]);
  });
});
