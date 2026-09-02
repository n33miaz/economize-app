import { buildEnteringPresets } from "../motionPresets";

describe("buildEnteringPresets — forma por plataforma", () => {
  it("na web não usa deslocamento inicial (o Reanimated deixaria o bloco absoluto)", () => {
    // Na web, `.withInitialValues()` vira keyframe de nome próprio e a
    // limpeza do gerenciador aplica `position: absolute` ao terminar — foi
    // assim que a Home inteira colapsou em blocos sobrepostos
    const presets = buildEnteringPresets(true, false);
    const card = presets.cardEntering as unknown as { initialValues?: unknown };
    const item = presets.listItemEntering(2) as unknown as {
      initialValues?: unknown;
    };
    expect(card.initialValues).toBeUndefined();
    expect(item.initialValues).toBeUndefined();
    // O FAB na web é um preset nomeado, não uma função (que a web não carrega)
    expect(typeof presets.fabEntering).not.toBe("function");
    expect(presets.fabEntering).toBeDefined();
  });

  it("no nativo mantém o deslocamento sutil de 12 px e a animação do FAB em função", () => {
    const presets = buildEnteringPresets(false, false);
    const card = presets.cardEntering as unknown as {
      initialValues?: { transform?: unknown[] };
    };
    expect(card.initialValues?.transform).toEqual([{ translateY: 12 }]);
    expect(typeof presets.fabEntering).toBe("function");
  });

  it("com movimento reduzido tudo é undefined, nas duas plataformas", () => {
    for (const web of [true, false]) {
      const presets = buildEnteringPresets(web, true);
      expect(presets.cardEntering).toBeUndefined();
      expect(presets.listItemEntering(0)).toBeUndefined();
      expect(presets.fabEntering).toBeUndefined();
    }
  });

  it("o atraso do item de lista tem teto no 6º item", () => {
    const presets = buildEnteringPresets(true, false);
    const late = presets.listItemEntering(40) as unknown as { delayV?: number };
    const capped = presets.listItemEntering(5) as unknown as { delayV?: number };
    expect(late.delayV).toBe(capped.delayV);
  });
});
