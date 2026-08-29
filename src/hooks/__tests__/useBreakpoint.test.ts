import {
  BREAKPOINTS,
  CONTENT_MAX_WIDTH,
  SIDE_RAIL_WIDTH,
  columnsForWidth,
  contentWidthFor,
  shouldUseSideRail,
} from "../useBreakpoint";

describe("shouldUseSideRail — a decisão trilho × barra inferior", () => {
  it("mantém a barra inferior no celular e no tablet", () => {
    expect(shouldUseSideRail(390)).toBe(false); // iPhone no navegador
    expect(shouldUseSideRail(768)).toBe(false); // tablet em pé
    expect(shouldUseSideRail(BREAKPOINTS.desktop - 1)).toBe(false);
  });

  it("passa para o trilho a partir de 1024", () => {
    expect(shouldUseSideRail(BREAKPOINTS.desktop)).toBe(true);
    expect(shouldUseSideRail(1440)).toBe(true);
    expect(shouldUseSideRail(1920)).toBe(true);
  });
});

describe("contentWidthFor", () => {
  it("desconta o trilho da largura útil quando ele existe", () => {
    expect(contentWidthFor(1440)).toBe(1440 - SIDE_RAIL_WIDTH);
  });

  it("devolve a janela inteira enquanto quem navega é a barra", () => {
    expect(contentWidthFor(390)).toBe(390);
    expect(contentWidthFor(1023)).toBe(1023);
  });

  it("nunca devolve largura negativa", () => {
    expect(contentWidthFor(0)).toBe(0);
  });
});

describe("columnsForWidth — seleção de colunas por largura", () => {
  it("fica em uma coluna enquanto o miolo é estreito", () => {
    expect(columnsForWidth(390)).toBe(1);
    expect(columnsForWidth(BREAKPOINTS.tablet - 1)).toBe(1);
  });

  it("abre a segunda coluna a partir de 768 de MIOLO", () => {
    expect(columnsForWidth(BREAKPOINTS.tablet)).toBe(2);
    expect(columnsForWidth(CONTENT_MAX_WIDTH)).toBe(2);
  });

  it("para em duas: o teto de 1180 deixaria a terceira com ~370 px", () => {
    expect(columnsForWidth(1920)).toBe(2);
  });
});

describe("as duas regras juntas", () => {
  // O caso que quebraria em silêncio: no limiar do trilho a janela ganha 1 px
  // mas o miolo PERDE 240 de uma vez. Se a conta de colunas olhasse a janela
  // em vez do miolo, a tela mais larga viraria duas colunas espremidas.
  it("ligar o trilho não derruba a grade para uma coluna", () => {
    const antes = columnsForWidth(contentWidthFor(BREAKPOINTS.desktop - 1));
    const depois = columnsForWidth(contentWidthFor(BREAKPOINTS.desktop));
    expect(antes).toBe(2);
    expect(depois).toBe(2);
  });

  it("o miolo com trilho ainda comporta duas colunas de 768", () => {
    expect(contentWidthFor(BREAKPOINTS.desktop)).toBeGreaterThanOrEqual(
      BREAKPOINTS.tablet,
    );
  });

  it("o celular de 390 px continua em uma coluna e com barra inferior", () => {
    expect(shouldUseSideRail(390)).toBe(false);
    expect(columnsForWidth(contentWidthFor(390))).toBe(1);
  });
});
