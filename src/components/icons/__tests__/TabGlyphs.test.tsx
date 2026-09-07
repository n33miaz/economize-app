import React from "react";
import { processColor } from "react-native";
import { render } from "@testing-library/react-native";

import {
  HomeGlyph,
  MarketGlyph,
  WalletGlyph,
  type TabGlyph,
} from "../TabGlyphs";

const OURO = "#F2C14E";
const FUNDO = "#123456";

type No = {
  type?: string;
  props?: Record<string, any>;
  children?: No[] | null;
};

/** Todos os nós da árvore renderizada, em profundidade. */
function nos(no: No | null | undefined, saida: No[] = []): No[] {
  if (!no) return saida;
  saida.push(no);
  (no.children ?? []).forEach((filho) => nos(filho, saida));
  return saida;
}

const FORMAS = new Set(["RNSVGPath", "RNSVGRect"]);

/** Formas pintadas com a cor — o rn-svg entrega `fill` como inteiro ARGB. */
function pintadasCom(arvore: No, cor: string) {
  const alvo = processColor(cor);
  return nos(arvore).filter(
    (n) => FORMAS.has(n.type ?? "") && n.props?.fill?.payload === alvo,
  );
}

function tracadas(arvore: No) {
  return nos(arvore).filter(
    (n) => FORMAS.has(n.type ?? "") && n.props?.stroke != null,
  );
}

const GLIFOS: [string, TabGlyph][] = [
  ["carteira", WalletGlyph],
  ["casa", HomeGlyph],
  ["velas", MarketGlyph],
];

describe.each(GLIFOS)("glifo %s", (_nome, Glyph) => {
  it("monta nas duas variantes, no tamanho pedido", () => {
    for (const filled of [false, true]) {
      const raiz = render(
        <Glyph size={26} color={OURO} filled={filled} />,
      ).toJSON() as No;
      expect(raiz.type).toBe("RNSVGSvgView");
      expect(raiz.props).toMatchObject({ width: 26, height: 26 });
    }
  });

  it("no contorno nenhuma forma é pintada; no cheio a silhueta é", () => {
    // É o par que o preenchimento animado exige: a variante cheia precisa
    // ser uma silhueta de verdade, e a de contorno não pode ter mancha
    const contorno = render(<Glyph size={24} color={OURO} />).toJSON() as No;
    expect(pintadasCom(contorno, OURO)).toHaveLength(0);

    const cheio = render(<Glyph size={24} color={OURO} filled />).toJSON() as No;
    expect(pintadasCom(cheio, OURO).length).toBeGreaterThan(0);
  });

  it("traça com 1.75 e pontas redondas em toda forma, nas duas variantes", () => {
    // Mesma caixa óptica do lucide: traço único e cantos redondos é o que
    // deixa o trio conviver com os ícones lucide do resto do trilho
    for (const filled of [false, true]) {
      const arvore = render(
        <Glyph size={24} color={OURO} filled={filled} />,
      ).toJSON() as No;
      const formas = tracadas(arvore);
      expect(formas.length).toBeGreaterThan(0);
      formas.forEach((forma) => {
        expect(forma.props).toMatchObject({
          strokeWidth: 1.75,
          strokeLinecap: 1,
          strokeLinejoin: 1,
        });
      });
    }
  });

  it("é memoizado — a barra e o trilho re-renderizam a cada troca de rota", () => {
    expect((Glyph as unknown as { $$typeof: symbol }).$$typeof).toBe(
      Symbol.for("react.memo"),
    );
  });
});

describe("recortes da variante cheia", () => {
  it("carteira e casa ficam vazadas por padrão e só pintam o recorte com accent", () => {
    // Vazado é o que funciona em qualquer superfície (barra, pílula do
    // trilho); `accent` existe para quando o fundo NÃO deve aparecer
    for (const Glyph of [WalletGlyph, HomeGlyph]) {
      const vazado = render(
        <Glyph size={24} color={OURO} filled />,
      ).toJSON() as No;
      expect(pintadasCom(vazado, FUNDO)).toHaveLength(0);

      const pintado = render(
        <Glyph size={24} color={OURO} filled accent={FUNDO} />,
      ).toJSON() as No;
      expect(pintadasCom(pintado, FUNDO)).toHaveLength(1);
    }
  });

  it("as velas não têm recorte: accent não pinta nada", () => {
    // Corpos enchem, pavios e eixo continuam traço — nada se perde no cheio
    const arvore = render(
      <MarketGlyph size={24} color={OURO} filled accent={FUNDO} />,
    ).toJSON() as No;
    expect(pintadasCom(arvore, FUNDO)).toHaveLength(0);
    expect(pintadasCom(arvore, OURO)).toHaveLength(2);
  });
});
