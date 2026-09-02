import {
  categoryForSlice,
  dominantLabel,
  parseReportCategories,
} from "../reportBreakdown";

import type { Category } from "../../services/api";

const categoria = (over: Partial<Category>): Category =>
  ({
    id: "c1",
    name: "Alimentação",
    groupName: null,
    slug: "alimentacao",
    flow: "EXPENSE",
    color: null,
    icon: null,
    systemKey: "FOOD",
    parentSystemKey: null,
    parentId: null,
    system: true,
    archived: false,
    ...over,
  }) as Category;

describe("parseReportCategories", () => {
  it("ordena os gastos do maior para o menor e calcula a fração", () => {
    const fatias = parseReportCategories(
      JSON.stringify({ FOOD: -300, TRANSPORT: -700 }),
    );

    expect(fatias.map((f) => f.key)).toEqual(["TRANSPORT", "FOOD"]);
    expect(fatias[0].expense).toBe(700);
    expect(fatias[0].share).toBeCloseTo(0.7);
    expect(fatias[1].share).toBeCloseTo(0.3);
  });

  it("deixa a entrada fora da pizza", () => {
    // Salário e gasto na mesma pizza somam grandezas opostas e desenham algo
    // que não significa nada
    const fatias = parseReportCategories(
      JSON.stringify({ SALARY: 4400, FOOD: -300 }),
    );

    expect(fatias).toHaveLength(1);
    expect(fatias[0].key).toBe("FOOD");
  });

  it("resolve o nome no catálogo de hoje", () => {
    const fatias = parseReportCategories(
      JSON.stringify({ FOOD: -300 }),
      [categoria({ name: "Alimentação e bebidas" })],
    );

    expect(fatias[0].label).toBe("Alimentação e bebidas");
  });

  it("categoria apagada mostra a chave em vez de mentir", () => {
    // "Sem categoria" afirmaria algo falso sobre o retrato: havia categoria,
    // ela é que não existe mais
    const fatias = parseReportCategories(JSON.stringify({ ANTIGA: -300 }), []);

    expect(fatias[0].label).toBe("ANTIGA");
  });

  it("a fatia sem categoria também é traduzida na pizza", () => {
    // Antes de revisar o extrato, quase tudo cai em OTHER: uma fatia chamada
    // "OTHER" na legenda seria o retrato inteiro ilegível
    const fatias = parseReportCategories(JSON.stringify({ OTHER: -5830 }));

    expect(fatias[0].label).toBe("Sem categoria");
  });

  it("casa também por slug, que é a chave das categorias do usuário", () => {
    const fatias = parseReportCategories(
      JSON.stringify({ "pet-shop": -120 }),
      [categoria({ systemKey: null, slug: "pet-shop", name: "Pet shop" })],
    );

    expect(fatias[0].label).toBe("Pet shop");
  });

  it("retrato ausente, vazio ou corrompido não derruba a tela", () => {
    expect(parseReportCategories(null)).toEqual([]);
    expect(parseReportCategories("")).toEqual([]);
    expect(parseReportCategories("{}")).toEqual([]);
    expect(parseReportCategories("nao é json")).toEqual([]);
    expect(parseReportCategories("[1,2,3]")).toEqual([]);
  });

  it("período só com entrada não tem pizza de gasto", () => {
    expect(parseReportCategories(JSON.stringify({ SALARY: 4400 }))).toEqual([]);
  });

  it("valor não numérico é ignorado em vez de virar NaN na fatia", () => {
    const fatias = parseReportCategories(
      JSON.stringify({ FOOD: -300, QUEBRADA: "abc" }),
    );

    expect(fatias).toHaveLength(1);
    expect(fatias[0].share).toBe(1);
  });
});

describe("parseReportCategories — formato novo, com entrada e saída separadas", () => {
  it("usa o gasto, e não o líquido da categoria", () => {
    // O caso que expôs o defeito: a mesma categoria recebeu 4.400 e gastou
    // 5.830. No formato antigo isso virava "-1430" e a fatia contradizia o
    // total de saídas do relatório na mesma tela
    const fatias = parseReportCategories(
      JSON.stringify({ OTHER: { income: 4400, expense: 5830 } }),
    );

    expect(fatias[0].expense).toBe(5830);
    expect(fatias[0].share).toBe(1);
  });

  it("categoria só de entrada não entra na pizza de gasto", () => {
    const fatias = parseReportCategories(
      JSON.stringify({
        SALARY: { income: 4400, expense: 0 },
        FOOD: { income: 0, expense: 500 },
      }),
    );

    expect(fatias.map((f) => f.key)).toEqual(["FOOD"]);
  });

  it("o formato antigo continua abrindo", () => {
    // Relatório já gravado não pode parar de renderizar por causa de formato
    const fatias = parseReportCategories(JSON.stringify({ FOOD: -500 }));

    expect(fatias[0].expense).toBe(500);
  });
});

describe("dominantLabel", () => {
  it("OTHER vira 'Sem categoria', que é o que ele significa", () => {
    // "Categoria dominante · OTHER" não diz nada a ninguém
    expect(dominantLabel("OTHER")).toBe("Sem categoria");
  });

  it("chave conhecida vira o nome do catálogo", () => {
    expect(dominantLabel("FOOD", [categoria({ name: "Alimentação" })])).toBe(
      "Alimentação",
    );
  });

  it("sem dominante não inventa rótulo", () => {
    expect(dominantLabel(null)).toBeNull();
    expect(dominantLabel(undefined)).toBeNull();
  });
});

describe("categoryForSlice", () => {
  it("devolve a categoria viva para a fatia, quando existe", () => {
    const catalogo = [categoria({})];
    const fatia = parseReportCategories(JSON.stringify({ FOOD: -300 }), catalogo)[0];

    // É o que dá à fatia a COR da entidade: a mesma categoria veste a mesma
    // cor em qualquer tela
    expect(categoryForSlice(fatia, catalogo)?.id).toBe("c1");
    expect(categoryForSlice(fatia, [])).toBeUndefined();
  });
});
