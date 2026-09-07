import {
  BANK_KEYS,
  BANK_LOGOS,
  bankKeyFor,
  bankMonogram,
  bankWords,
} from "../bankBrand";

/**
 * Da instituição que o provedor manda à chave do logo.
 *
 * O texto vem livre e muda de grafia entre sincronizações; o que se prova
 * aqui é que acento e caixa não importam, que a casadura é por palavra
 * inteira (e não por pedaço), e que nome que não é banco devolve null em vez
 * de um logo errado.
 */
describe("bankKeyFor", () => {
  it.each([
    ["Banco Inter S.A.", "inter"],
    ["INTER", "inter"],
    ["Nubank", "nubank"],
    ["Nu Pagamentos S.A. - Instituição de Pagamento", "nubank"],
    ["Mercado Pago", "mercadopago"],
    ["MercadoPago", "mercadopago"],
    ["MELI", "mercadopago"],
    ["Itaú Unibanco", "itau"],
    ["ITAU", "itau"],
    ["Banco Bradesco S.A.", "bradesco"],
    ["Santander Brasil", "santander"],
    ["Banco do Brasil", "bb"],
    ["BB Cartão", "bb"],
    ["Caixa Econômica Federal", "caixa"],
    ["C6 Bank", "c6"],
    ["BTG Pactual", "btg"],
    ["Sicoob", "sicoob"],
    ["Sicredi", "sicredi"],
  ])("%s → %s", (nome, chave) => {
    expect(bankKeyFor(nome)).toBe(chave);
  });

  it("casa por palavra, não por pedaço de palavra", () => {
    // "inter" dentro de "Intermediação" e "bb" dentro de "Abbey" dariam logo
    // errado — e logo errado é pior do que nenhum
    expect(bankKeyFor("Intermediação Financeira")).toBeNull();
    expect(bankKeyFor("Abbey National")).toBeNull();
    expect(bankKeyFor("Caixinha Poupança")).toBeNull();
  });

  it("nome do agregador não é banco", () => {
    // O `connectorName` do provedor é o nome do serviço dele, não da
    // instituição — nunca pode virar logo nem aparecer na tela
    expect(bankKeyFor("MeuAgregador")).toBeNull();
    expect(bankKeyFor("Conexão bancária")).toBeNull();
  });

  it("vazio e nulo devolvem null sem reclamar", () => {
    expect(bankKeyFor(null)).toBeNull();
    expect(bankKeyFor(undefined)).toBeNull();
    expect(bankKeyFor("")).toBeNull();
    expect(bankKeyFor("   ")).toBeNull();
    expect(bankKeyFor("...")).toBeNull();
  });

  it("toda chave tem logo embalado", () => {
    for (const key of BANK_KEYS) {
      expect(BANK_LOGOS[key]).toBeDefined();
    }
  });
});

describe("bankWords", () => {
  it("tira acento, baixa a caixa e separa por tudo que não é letra ou número", () => {
    expect(bankWords("Itaú Unibanco S.A.")).toEqual(["itau", "unibanco", "s", "a"]);
    expect(bankWords("C6-Bank")).toEqual(["c6", "bank"]);
  });
});

describe("bankMonogram", () => {
  it("usa as iniciais das palavras com identidade", () => {
    expect(bankMonogram("Banco do Brasil")).toBe("BB");
    expect(bankMonogram("Nu Pagamentos S.A.")).toBe("NP");
    expect(bankMonogram("Flash")).toBe("F");
  });

  it("no máximo duas letras, sempre maiúsculas", () => {
    expect(bankMonogram("caixa economica federal")).toBe("CE");
  });

  it("sem nome, sem monograma", () => {
    expect(bankMonogram("")).toBe("");
    expect(bankMonogram(null)).toBe("");
    expect(bankMonogram(undefined)).toBe("");
  });
});
