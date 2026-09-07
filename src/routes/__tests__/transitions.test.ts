import {
  STACK_DURATION_MS,
  ephemeralTransition,
  fadeTransition,
  modalLikeTransition,
  slideRightTransition,
} from "../transitions";

describe("escala das transições de pilha", () => {
  it("as entradas que deslizam ficam entre 240 e 260 ms", () => {
    // Abaixo disso a tela "aparece"; acima, o app parece esperar por ela
    for (const transicao of [slideRightTransition, ephemeralTransition]) {
      expect(transicao.animationDuration).toBeGreaterThanOrEqual(240);
      expect(transicao.animationDuration).toBeLessThanOrEqual(260);
    }
  });

  it("os dois slide_from_right têm a MESMA duração", () => {
    // Eram 260 e 240 para o mesmo movimento — a diferença só se notava
    // como inconsistência
    expect(ephemeralTransition.animationDuration).toBe(
      slideRightTransition.animationDuration,
    );
    expect(slideRightTransition.animationDuration).toBe(
      STACK_DURATION_MS.slide,
    );
  });

  it("efêmeras deslizam pela direita como card; auth só esmaece; modal sobe", () => {
    expect(ephemeralTransition).toMatchObject({
      animation: "slide_from_right",
      presentation: "card",
    });
    expect(fadeTransition.animation).toBe("fade");
    expect(modalLikeTransition).toMatchObject({
      animation: "slide_from_bottom",
      presentation: "modal",
      gestureEnabled: true,
    });
  });

  it("fade não é mais lento que o deslize; modal é o degrau mais longo", () => {
    // O fade não percorre distância; o modal percorre a altura inteira
    expect(fadeTransition.animationDuration).toBeLessThanOrEqual(
      STACK_DURATION_MS.slide,
    );
    expect(modalLikeTransition.animationDuration).toBeGreaterThan(
      STACK_DURATION_MS.slide,
    );
  });
});
