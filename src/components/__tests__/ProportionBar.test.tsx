import React from "react";
import { render } from "@testing-library/react-native";

import ProportionBar, { type Slice } from "../ProportionBar";

const fatia = (key: string, value: number, color = "#BC8508"): Slice => ({
  key,
  value,
  color,
  label: key,
});

/**
 * EC-227 — a proporção sem uma palavra escrita.
 *
 * Uma legenda de cinco linhas repete a lista logo abaixo, ocupa mais espaço
 * que a própria barra e obriga o olho a viajar entre a cor e o texto.
 */
describe("Barra de proporção", () => {
  it("NÃO escreve nada na tela", () => {
    // É a regra inteira: a resposta é a forma, não o número
    const { queryByText } = render(
      <ProportionBar
        slices={[fatia("Mercado", 800), fatia("Transporte", 200)]}
      />,
    );

    expect(queryByText(/Mercado/)).toBeNull();
    expect(queryByText(/800/)).toBeNull();
    expect(queryByText(/%/)).toBeNull();
  });

  it("quem ouve recebe nome, valor e percentual de cada fatia", () => {
    // Para quem não vê a forma, o detalhe É a informação
    const { getByLabelText } = render(
      <ProportionBar
        slices={[fatia("Mercado", 750), fatia("Transporte", 250)]}
      />,
    );

    expect(
      getByLabelText(
        /Mercado, R\$\s?750,00, 75 por cento; Transporte, R\$\s?250,00, 25 por cento/,
      ),
    ).toBeTruthy();
  });

  it("fatia minúscula continua visível em vez de virar um fio", () => {
    // 0,3% viraria meio pixel — invisível e indistinguível de "não existe"
    const arvore = render(
      <ProportionBar slices={[fatia("Grande", 997), fatia("Migalha", 3)]} />,
    ).toJSON();

    const filhos = (arvore as unknown as {
      children: { props: { style: { flex: number } } }[];
    }).children;
    expect(filhos).toHaveLength(2);
    expect(filhos[1].props.style.flex).toBeGreaterThanOrEqual(0.02);
  });

  it("sem fatia nenhuma, não ocupa espaço", () => {
    expect(render(<ProportionBar slices={[]} />).toJSON()).toBeNull();
  });

  it("total zero não divide por zero", () => {
    expect(
      render(<ProportionBar slices={[fatia("Nada", 0)]} />).toJSON(),
    ).toBeNull();
  });

  it("valor negativo não inverte a barra", () => {
    // Estorno ou crédito numa lista de gastos não pode desenhar ao contrário
    const arvore = render(
      <ProportionBar slices={[fatia("Gasto", 100), fatia("Credito", -50)]} />,
    ).toJSON();

    const filhos = (arvore as unknown as { children: unknown[] }).children;
    expect(filhos).toHaveLength(1);
  });
});
