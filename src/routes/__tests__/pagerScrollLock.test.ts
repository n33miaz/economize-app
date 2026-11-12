import { Animated } from "react-native";
import { SceneStyleInterpolators } from "@react-navigation/bottom-tabs";
import {
  pagerScrollLockStyle,
  restingShiftInterpolator,
} from "../pagerScrollLock";

// Lê o translateX e a opacidade que o interpolador dá para um progresso fixo
function cenaEm(progresso: number) {
  const progress = new Animated.Value(progresso);
  const { sceneStyle } = restingShiftInterpolator("web")({
    current: { progress },
  }) as { sceneStyle: { opacity: any; transform: { translateX: any }[] } };
  return {
    x: sceneStyle.transform[0].translateX.__getValue() as number,
    opacidade: sceneStyle.opacity.__getValue() as number,
  };
}

describe("shift da barra de baixo sem sobra rolável", () => {
  it("em repouso, a aba fora de foco fica em 0 px (nada para rolar)", () => {
    expect(cenaEm(1)).toEqual({ x: 0, opacidade: 0 });
    expect(cenaEm(-1)).toEqual({ x: 0, opacidade: 0 });
  });

  it("durante a troca desliza como o forShift", () => {
    expect(cenaEm(0)).toEqual({ x: 0, opacidade: 1 });
    expect(cenaEm(0.5).x).toBeCloseTo(25);
    expect(cenaEm(-0.5).x).toBeCloseTo(-25);
  });

  it("fora da web é o forShift original", () => {
    expect(restingShiftInterpolator("android")).toBe(
      SceneStyleInterpolators.forShift,
    );
    expect(restingShiftInterpolator("ios")).toBe(
      SceneStyleInterpolators.forShift,
    );
  });
});

describe("trava de rolagem do contêiner das abas de cima", () => {
  it("na web com suporte a clip, o contêiner deixa de ser rolável", () => {
    // `hidden` aceitaria scrollLeft vindo de scrollIntoView/foco; `clip` não
    expect(pagerScrollLockStyle("web", true)).toEqual({ overflow: "clip" });
  });

  it("no Android e no iOS nada muda: o paginador é nativo", () => {
    expect(pagerScrollLockStyle("android", true)).toBeUndefined();
    expect(pagerScrollLockStyle("ios", true)).toBeUndefined();
  });

  it("navegador sem clip mantém o hidden da biblioteca", () => {
    // um valor desconhecido viraria `visible` e as abas vizinhas vazariam
    expect(pagerScrollLockStyle("web", false)).toBeUndefined();
  });

  it("sem argumentos, segue a plataforma do teste (nativa): undefined", () => {
    expect(pagerScrollLockStyle()).toBeUndefined();
  });
});
