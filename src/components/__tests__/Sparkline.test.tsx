import React from "react";
import { render } from "@testing-library/react-native";
import { Path } from "react-native-svg";

import Sparkline from "../Sparkline";

/**
 * A linha de tendência do card de ativo.
 *
 * <p>Existe porque o dono disse que a tela de Mercado estava "muito pobre —
 * nenhum usuário vai usar", e o dado para enriquecê-la já chegava na mesma
 * resposta da cotação e era descartado.
 *
 * <p>O que os testes guardam é a régua: escala LOCAL (a forma do movimento,
 * nunca a magnitude), série curta não desenha nada, e série plana não divide
 * por zero.
 */
const desenhar = (values: number[] | null | undefined) =>
  render(<Sparkline values={values} tone="up" width={40} height={20} />);

const caminho = (tela: ReturnType<typeof desenhar>): string | undefined =>
  tela.UNSAFE_queryAllByType(Path)[0]?.props.d;

describe("Sparkline", () => {
  it("desenha um ponto por fechamento, na ordem recebida", () => {
    const d = caminho(desenhar([10, 12, 11, 14]));

    expect(d).toBeDefined();
    expect(d!.startsWith("M0")).toBe(true);
    // Quatro pontos = um M e três L
    expect((d!.match(/L/g) ?? []).length).toBe(3);
  });

  /**
   * A escala é do próprio papel: o menor valor encosta embaixo e o maior em
   * cima. É isso que faz a linha mostrar a FORMA do movimento — e é por isso
   * que duas linhas lado a lado não são comparáveis entre si, nem devem
   * parecer.
   */
  it("usa a própria faixa como escala: o mínimo embaixo, o máximo em cima", () => {
    const d = caminho(desenhar([10, 20]))!;
    const [, y0, , y1] = d.replace(/[ML]/g, " ").trim().split(/\s+/);

    expect(Number(y0)).toBeGreaterThan(Number(y1));
  });

  /** Menos de dois pontos não é linha — e o espaço continua reservado. */
  it("um ponto só, ou nenhum, não desenha traço", () => {
    expect(caminho(desenhar([10]))).toBeUndefined();
    expect(caminho(desenhar([]))).toBeUndefined();
    expect(caminho(desenhar(null))).toBeUndefined();
    expect(caminho(desenhar(undefined))).toBeUndefined();
  });

  /** Série plana: divide por zero se ninguém cuidar. Vai para o meio. */
  it("série plana vira uma reta no meio, sem dividir por zero", () => {
    const d = caminho(desenhar([7, 7, 7]))!;
    const ys = d
      .replace(/[ML]/g, " ")
      .trim()
      .split(/\s+/)
      .filter((_, i) => i % 2 === 1)
      .map(Number);

    expect(ys.every((y) => y === 10)).toBe(true);
    expect(ys).toHaveLength(3);
  });
});
