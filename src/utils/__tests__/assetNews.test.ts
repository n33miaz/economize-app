import { assetNews, benchmarkPhrase, distinctiveWords } from "../assetNews";

import type { NewsArticle } from "../../services/api";

const noticia = (title: string, description: string | null = null): NewsArticle =>
  ({
    source: { id: null, name: "InfoMoney" },
    author: null,
    title,
    description,
    url: `https://exemplo.test/${encodeURIComponent(title)}`,
    urlToImage: null,
    publishedAt: "2026-09-01T10:00:00Z",
    content: null,
  }) as NewsArticle;

describe("distinctiveWords", () => {
  it("descarta o jargão societário que todo nome carrega", () => {
    // "SA", "PFD" e "Brasileiro" casariam com metade do noticiário
    expect(distinctiveWords("Petroleo Brasileiro SA Pfd")).toEqual(["petroleo"]);
  });

  it("ignora acento e pontuação", () => {
    expect(distinctiveWords("Óticas Diniz S/A")).toEqual(["oticas", "diniz"]);
  });

  it("palavra de duas letras não identifica ninguém", () => {
    expect(distinctiveWords("BB Seguridade")).toEqual(["seguridade"]);
  });

  it("nome ausente não quebra", () => {
    expect(distinctiveWords(null)).toEqual([]);
    expect(distinctiveWords("")).toEqual([]);
  });
});

describe("assetNews", () => {
  it("casa pelo código do papel", () => {
    const achadas = assetNews(
      [noticia("PETR4 sobe 4% após balanço"), noticia("Dólar recua")],
      "PETR4",
      "Petroleo Brasileiro SA Pfd",
    );

    expect(achadas).toHaveLength(1);
    expect(achadas[0].title).toContain("PETR4");
  });

  it("casa por palavra distintiva do nome, inclusive na descrição", () => {
    const achadas = assetNews(
      [noticia("Estatal anuncia dividendos", "A Petroleo Brasileiro pagará...")],
      "PETR4",
      "Petroleo Brasileiro SA Pfd",
    );

    expect(achadas).toHaveLength(1);
  });

  it("respeita fronteira de palavra: 'vale' não casa com 'equivale'", () => {
    // Sem a fronteira, a seção encheria de notícia que não fala da empresa
    const achadas = assetNews(
      [noticia("Movimento equivale a 3% do índice"), noticia("Vale fecha acordo")],
      "VALE3",
      "Vale ON",
    );

    expect(achadas).toHaveLength(1);
    expect(achadas[0].title).toBe("Vale fecha acordo");
  });

  it("ignora caixa e acento dos dois lados", () => {
    const achadas = assetNews(
      [noticia("ÓTICAS DINIZ amplia rede")],
      "OTIC3",
      "Óticas Diniz",
    );

    expect(achadas).toHaveLength(1);
  });

  it("corta no limite: mais que isso vira uma segunda tela", () => {
    const muitas = [1, 2, 3, 4, 5].map((n) => noticia(`PETR4 notícia ${n}`));

    expect(assetNews(muitas, "PETR4", "Petroleo")).toHaveLength(3);
    expect(assetNews(muitas, "PETR4", "Petroleo", 2)).toHaveLength(2);
  });

  it("sem manchete relacionada, devolve vazio — a tela não desenha seção", () => {
    expect(assetNews([noticia("Dólar recua")], "PETR4", "Petroleo")).toEqual([]);
  });

  it("sem código nem nome não sai casando com tudo", () => {
    expect(assetNews([noticia("Qualquer coisa")], null, null)).toEqual([]);
    expect(assetNews([noticia("Qualquer coisa")], "", "SA ON")).toEqual([]);
  });
});

describe("benchmarkPhrase", () => {
  it("papel acima do índice", () => {
    // "Subiu 4%" sozinho não diz se foi o papel ou o mercado inteiro
    expect(benchmarkPhrase(4.11, 0.32, "IBOVESPA")).toBe(
      "3,79 pontos acima do IBOVESPA hoje",
    );
  });

  it("papel abaixo do índice", () => {
    expect(benchmarkPhrase(-2.0, 1.0, "IBOVESPA")).toBe(
      "3,00 pontos abaixo do IBOVESPA hoje",
    );
  });

  it("diferença mínima é maré, não desempenho", () => {
    expect(benchmarkPhrase(1.2, 1.0, "IBOVESPA")).toBe(
      "Acompanhou o IBOVESPA hoje",
    );
    expect(benchmarkPhrase(1.0, 1.4, "IBOVESPA")).toBe(
      "Acompanhou o IBOVESPA hoje",
    );
  });

  it("sem um dos lados não inventa comparação", () => {
    expect(benchmarkPhrase(null, 1.0, "IBOVESPA")).toBeNull();
    expect(benchmarkPhrase(1.0, null, "IBOVESPA")).toBeNull();
    expect(benchmarkPhrase(undefined, undefined, "IBOVESPA")).toBeNull();
  });
});
