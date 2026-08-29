import { padRowsForColumns, splitIntoColumns } from "../layout";

describe("splitIntoColumns", () => {
  it("devolve uma coluna só quando não há grade", () => {
    expect(splitIntoColumns(["a", "b", "c"], 1)).toEqual([["a", "b", "c"]]);
    expect(splitIntoColumns(["a", "b"], 0)).toEqual([["a", "b"]]);
  });

  it("reveza os blocos preservando a prioridade no topo de cada coluna", () => {
    // O 1º e o 2º blocos mais importantes ficam no topo das duas colunas; o
    // corte pela metade ("a, b, c" à esquerda) enterraria o 3º abaixo da dobra.
    // Sem peso declarado todo bloco vale 1 e o equilíbrio degenera no rodízio
    // `i % n` — o comportamento antigo, agora como caso particular
    expect(splitIntoColumns(["a", "b", "c", "d", "e"], 2)).toEqual([
      ["a", "c", "e"],
      ["b", "d"],
    ]);
  });

  it("manda cada bloco para a coluna mais leve quando há peso", () => {
    // Pesos do onboarding da Home (herói, atalhos, carteira, mercado,
    // notícias): o rodízio cego dava 11 × 4, o equilíbrio dá 9 × 6
    const peso: Record<string, number> = {
      mes: 5,
      atalhos: 1,
      carteira: 2,
      mercado: 3,
      noticias: 4,
    };
    expect(
      splitIntoColumns(
        ["mes", "atalhos", "carteira", "mercado", "noticias"],
        2,
        (item) => peso[item],
      ),
    ).toEqual([
      ["mes", "noticias"],
      ["atalhos", "carteira", "mercado"],
    ]);
  });

  it("semeia as colunas por prioridade antes de olhar para o peso", () => {
    // O 2º bloco mais importante não pode ser empurrado para o fim da
    // esquerda só porque é baixinho — a semeadura vem antes do equilíbrio
    const peso: Record<string, number> = { a: 9, b: 1, c: 1 };
    expect(splitIntoColumns(["a", "b", "c"], 2, (item) => peso[item])).toEqual([
      ["a"],
      ["b", "c"],
    ]);
  });

  it("no empate de peso fica a coluna da esquerda, que é a que se lê antes", () => {
    const peso: Record<string, number> = { a: 2, b: 2, c: 1, d: 1 };
    expect(
      splitIntoColumns(["a", "b", "c", "d"], 2, (item) => peso[item]),
    ).toEqual([
      ["a", "c"],
      ["b", "d"],
    ]);
  });

  it("não perde nem duplica bloco nenhum", () => {
    const blocos = ["a", "b", "c", "d", "e", "f", "g"];
    const achatado = splitIntoColumns(blocos, 2).flat();
    expect(achatado).toHaveLength(blocos.length);
    expect(new Set(achatado)).toEqual(new Set(blocos));
  });

  it("aceita mais colunas que blocos sem quebrar", () => {
    // Contrato da função pura, NÃO do produto: coluna vazia na tela é meia
    // tela em branco, e quem recusa abrir a grade nesse caso é o `BlockGrid`
    // (ver `components/__tests__/BlockGrid.test.tsx`). Aqui só se garante que
    // repartir menos itens que colunas não estoura.
    expect(splitIntoColumns(["a"], 3)).toEqual([["a"], [], []]);
  });

  it("devolve colunas vazias para lista vazia", () => {
    expect(splitIntoColumns([], 2)).toEqual([[], []]);
  });
});

describe("padRowsForColumns", () => {
  it("não mexe na lista quando não há grade", () => {
    const itens = ["a", "b", "c"];
    expect(padRowsForColumns(itens, 1)).toBe(itens);
  });

  it("completa a última linha para o item ímpar não esticar", () => {
    expect(padRowsForColumns(["a", "b", "c"], 2)).toEqual([
      "a",
      "b",
      "c",
      null,
    ]);
  });

  it("não inventa buraco quando a última linha já está cheia", () => {
    const itens = ["a", "b", "c", "d"];
    expect(padRowsForColumns(itens, 2)).toBe(itens);
  });

  it("completa o que faltar em grades de três ou mais", () => {
    expect(padRowsForColumns(["a", "b", "c", "d"], 3)).toEqual([
      "a",
      "b",
      "c",
      "d",
      null,
      null,
    ]);
  });

  it("deixa a lista vazia em paz", () => {
    expect(padRowsForColumns([], 2)).toEqual([]);
  });
});
