import React from "react";
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

import EdgeFade, { comAlfaZero } from "../EdgeFade";

describe("comAlfaZero", () => {
  /**
   * A palavra "transparent" interpola a partir de rgba(0,0,0,0) e escurece a
   * emenda no iOS — o `Skeleton` documenta o mesmo cuidado para a faixa
   * dourada. O degradê tem que terminar na MESMA cor, só com alfa zero.
   */
  it("compõe o alfa a partir do hexa do tema", () => {
    expect(comAlfaZero("#181713")).toBe("rgba(24, 23, 19, 0)");
    expect(comAlfaZero("#FFFFFF")).toBe("rgba(255, 255, 255, 0)");
    expect(comAlfaZero("#000000")).toBe("rgba(0, 0, 0, 0)");
  });

  it("aceita hexa em minúsculas e com espaço em volta", () => {
    expect(comAlfaZero("  #0f0e0b ")).toBe("rgba(15, 14, 11, 0)");
  });

  it("aceita rgb e rgba", () => {
    expect(comAlfaZero("rgb(10, 20, 30)")).toBe("rgba(10, 20, 30, 0)");
    expect(comAlfaZero("rgba(10, 20, 30, 0.72)")).toBe("rgba(10, 20, 30, 0)");
  });

  /**
   * Cor que não se sabe compor devolve ela mesma: um degradê de cor sólida
   * para cor sólida é invisível, e é melhor não desenhar desvanecimento nenhum
   * do que desenhar uma barra preta em cima dos chips.
   */
  it("cor desconhecida volta como veio, em vez de virar preto", () => {
    expect(comAlfaZero("papayawhip")).toBe("papayawhip");
    expect(comAlfaZero("#abc")).toBe("#abc");
  });
});

describe("EdgeFade", () => {
  it("desenha o conteúdo e os dois degradês", () => {
    const { getByText, toJSON } = render(
      <EdgeFade>
        <Text>chips</Text>
      </EdgeFade>,
    );

    expect(getByText("chips")).toBeTruthy();
    // conteúdo + ponta esquerda + ponta direita
    expect((toJSON() as any).children).toHaveLength(3);
  });

  /**
   * Os degradês ficam POR CIMA da fileira. Sem `pointerEvents: "none"` o
   * primeiro e o último chip perderiam 24 px de área de toque para um enfeite.
   */
  it("nenhuma das pontas recebe toque", () => {
    const { toJSON } = render(
      <EdgeFade>
        <Text>chips</Text>
      </EdgeFade>,
    );

    const filhos = (toJSON() as any).children;
    [filhos[1], filhos[2]].forEach((ponta: any) => {
      const estilo = Array.isArray(ponta.props.style)
        ? Object.assign({}, ...ponta.props.style)
        : ponta.props.style;
      expect(estilo.pointerEvents).toBe("none");
    });
  });
});
