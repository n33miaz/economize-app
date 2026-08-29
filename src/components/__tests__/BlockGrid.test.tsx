import React from "react";
import { render, within } from "@testing-library/react-native";
import { Text, View } from "react-native";

import BlockGrid from "../BlockGrid";

function bloco(key: string) {
  return (
    <View key={key} testID={`bloco-${key}`}>
      <Text>{key}</Text>
    </View>
  );
}

/**
 * Quais blocos caíram em cada coluna, na ordem renderizada. Lê os `testID`
 * que o componente nomeia — sem isso a asserção provaria só que os blocos
 * existem, e o bug que interessa é justamente ONDE eles param.
 */
function colunas(tela: ReturnType<typeof render>): string[][] {
  return tela
    .queryAllByTestId(/^coluna-\d+$/)
    .map((coluna) =>
      within(coluna)
        .queryAllByTestId(/^bloco-/)
        .map((b) => String(b.props.testID).replace("bloco-", "")),
    );
}

describe("BlockGrid", () => {
  it("empilha tudo numa coluna só no celular", () => {
    const tela = render(
      <BlockGrid columns={1}>{[bloco("a"), bloco("b"), bloco("c")]}</BlockGrid>,
    );

    // Sem linha de grade: os blocos são filhos diretos, empilhados
    expect(colunas(tela)).toEqual([]);
    expect(tela.getByTestId("bloco-a")).toBeTruthy();
    expect(tela.getByTestId("bloco-c")).toBeTruthy();
  });

  it("NÃO abre grade quando sobra menos bloco do que coluna", () => {
    // O caso da Análise: mês com saídas e nenhuma receita categorizada (quem
    // só importa cartão nunca tem). Com dois blocos condicionais e um deles
    // ausente, a grade deixava o ranking na esquerda e a metade direita
    // vazia de cima a baixo.
    const tela = render(
      <BlockGrid columns={2}>{[bloco("gastos"), false]}</BlockGrid>,
    );

    expect(colunas(tela)).toEqual([]);
    expect(tela.getByTestId("bloco-gastos")).toBeTruthy();
  });

  it("abre grade assim que há um bloco por coluna", () => {
    const tela = render(
      <BlockGrid columns={2}>{[bloco("gastos"), bloco("receitas")]}</BlockGrid>,
    );

    // Prioridade preservada: o 1º no topo da esquerda, o 2º no topo da direita
    expect(colunas(tela)).toEqual([["gastos"], ["receitas"]]);
  });

  it("descarta bloco condicional ausente antes de distribuir", () => {
    const tela = render(
      <BlockGrid columns={2}>
        {[bloco("a"), null, bloco("b"), false, bloco("c")]}
      </BlockGrid>,
    );

    // Se o `null` ocupasse vaga, "b" cairia sozinho na direita e "c" voltaria
    // para a esquerda — uma coluna com o dobro de conteúdo da outra
    expect(colunas(tela)).toEqual([["a", "c"], ["b"]]);
  });

  it("equilibra pelo peso em vez de revezar às cegas", () => {
    // Conjunto do onboarding da Home: sem extrato, sem revisão e sem
    // compromisso. O rodízio cego mandava herói + carteira + notícias para a
    // esquerda (peso 11) e deixava a direita com 4 — terminando na metade
    // da altura da outra.
    const pesos = { mes: 5, atalhos: 1, carteira: 2, mercado: 3, noticias: 4 };
    const tela = render(
      <BlockGrid columns={2} weights={pesos}>
        {[
          bloco("mes"),
          bloco("atalhos"),
          bloco("carteira"),
          bloco("mercado"),
          bloco("noticias"),
        ]}
      </BlockGrid>,
    );

    const distribuicao = colunas(tela);
    expect(distribuicao).toEqual([
      ["mes", "noticias"],
      ["atalhos", "carteira", "mercado"],
    ]);

    const somas = distribuicao.map((coluna) =>
      coluna.reduce(
        (total, key) => total + pesos[key as keyof typeof pesos],
        0,
      ),
    );
    // O que importa não é a arrumação exata, é a diferença: 11 × 4 virou 9 × 6
    expect(Math.abs(somas[0] - somas[1])).toBeLessThanOrEqual(3);
  });

  it("mantém o 1º e o 2º blocos no topo das duas colunas mesmo pesando pouco", () => {
    // Prioridade ganha do equilíbrio na semeadura: o 2º bloco mais importante
    // não pode ser empurrado para o fim da esquerda só porque é baixinho
    const tela = render(
      <BlockGrid columns={2} weights={{ a: 9, b: 1, c: 1 }}>
        {[bloco("a"), bloco("b"), bloco("c")]}
      </BlockGrid>,
    );

    expect(colunas(tela)).toEqual([["a"], ["b", "c"]]);
  });
});
