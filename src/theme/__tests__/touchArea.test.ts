import { TOUCH_MIN, touchArea, touchHeight } from "../ds";

/**
 * O alvo de toque no NAVEGADOR.
 *
 * <p>Medido em 21/09/2026 com o app de pé: um clique 8 px fora de um botão que
 * declara `hitSlop` de 10 <b>não disparou</b>; o mesmo clique no centro
 * disparou. O `hitSlop` do React Native é no-op no react-native-web, e o
 * navegador no iPhone é o foco declarado do dono — ali o olho que esconde os
 * valores era um alvo de 18 × 18.
 *
 * <p>Estes testes guardam a aritmética de quem substituiu o `hitSlop`.
 */
describe("touchArea", () => {
  it("leva um ícone minúsculo ao mínimo das duas plataformas", () => {
    // 18 + 13 + 13 = 44
    expect(touchArea(18)).toEqual({ padding: 13, margin: -13 });
  });

  it("devolve por fora o que cresceu por dentro — a tela não anda um pixel", () => {
    const { padding, margin } = touchArea(24) as {
      padding: number;
      margin: number;
    };
    expect(padding + margin).toBe(0);
    expect(24 + padding * 2).toBeGreaterThanOrEqual(TOUCH_MIN);
  });

  it("arredonda para cima: 43 não pode virar 43", () => {
    const { padding } = touchArea(43) as { padding: number };
    expect(43 + padding * 2).toBeGreaterThanOrEqual(TOUCH_MIN);
  });

  it("quem já é grande o bastante não ganha nada", () => {
    // Devolver padding zero seria inofensivo, mas devolver objeto vazio
    // permite espalhar sem sujar o estilo de quem não precisa
    expect(touchArea(44)).toEqual({});
    expect(touchArea(60)).toEqual({});
  });

  it("aceita um mínimo maior, para alvo de dedo em movimento", () => {
    const { padding } = touchArea(24, 48) as { padding: number };
    expect(24 + padding * 2).toBeGreaterThanOrEqual(48);
  });
});

describe("touchHeight", () => {
  it("cresce só na vertical: link de texto já é largo", () => {
    expect(touchHeight(17)).toEqual({
      paddingVertical: 14,
      marginVertical: -14,
    });
  });

  it("também devolve o que cresceu", () => {
    const { paddingVertical, marginVertical } = touchHeight(20) as {
      paddingVertical: number;
      marginVertical: number;
    };
    expect(paddingVertical + marginVertical).toBe(0);
    expect(20 + paddingVertical * 2).toBeGreaterThanOrEqual(TOUCH_MIN);
  });

  it("altura suficiente não mexe em nada", () => {
    expect(touchHeight(44)).toEqual({});
  });
});
