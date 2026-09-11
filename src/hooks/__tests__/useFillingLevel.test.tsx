import React from "react";
import { Text } from "react-native";
import { act, render } from "@testing-library/react-native";

import PotIcon from "../../components/PotIcon";
import { POT_STEPS } from "../../components/potSteps";
import { useFillingLevel } from "../useFillingLevel";

const reduzido = { atual: false };
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual("react-native-reanimated/mock"),
  useReducedMotion: () => reduzido.atual,
}));

function Sonda({ alvo, animar }: { alvo: number; animar: boolean }) {
  const nivel = useFillingLevel(alvo, animar);
  return <Text testID="nivel">{String(nivel)}</Text>;
}

const lerNivel = (tela: ReturnType<typeof render>) =>
  Number(tela.getByTestId("nivel").props.children);

/**
 * EC-223 — o pote que enche.
 *
 * O que se prova aqui é que o enchimento anda pelos degraus do desenho e
 * termina no valor exato — e que ele nunca atrasa a informação de quem pediu
 * para reduzir movimento.
 */
describe("Pote que enche", () => {
  beforeEach(() => {
    reduzido.atual = false;
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it("sem animação, o valor já nasce no lugar", () => {
    const tela = render(<Sonda alvo={0.75} animar={false} />);

    expect(lerNivel(tela)).toBe(0.75);
  });

  it("com animação, começa vazio e sobe", () => {
    const tela = render(<Sonda alvo={0.75} animar />);

    expect(lerNivel(tela)).toBe(0);

    act(() => {
      jest.advanceTimersByTime(80);
    });
    expect(lerNivel(tela)).toBeGreaterThan(0);
  });

  it("termina no valor EXATO, não no último degrau", () => {
    const tela = render(<Sonda alvo={0.63} animar />);

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // 0,63 fica entre os degraus 0,55 e 0,7 — parar em 0,55 mostraria menos
    // dinheiro do que a pessoa tem
    expect(lerNivel(tela)).toBe(0.63);
  });

  it("passa por cada degrau abaixo do alvo, um de cada vez", () => {
    const tela = render(<Sonda alvo={1} animar />);
    const vistos: number[] = [lerNivel(tela)];

    for (let i = 0; i < 25; i++) {
      act(() => {
        jest.advanceTimersByTime(60);
      });
      const atual = lerNivel(tela);
      if (vistos[vistos.length - 1] !== atual) vistos.push(atual);
    }

    expect(vistos[0]).toBe(0);
    expect(vistos[vistos.length - 1]).toBe(1);
    // Subiu sempre, nunca desceu
    expect([...vistos].sort((a, b) => a - b)).toEqual(vistos);
    expect(vistos.length).toBeGreaterThan(3);
  });

  it("reduzir movimento entrega o valor final no primeiro quadro", () => {
    reduzido.atual = true;

    const tela = render(<Sonda alvo={0.9} animar />);

    expect(lerNivel(tela)).toBe(0.9);
  });

  it("alvo fora da faixa é grampeado, e não quebra a subida", () => {
    expect(lerNivel(render(<Sonda alvo={2} animar={false} />))).toBe(1);
    expect(lerNivel(render(<Sonda alvo={-1} animar={false} />))).toBe(0);
    expect(lerNivel(render(<Sonda alvo={NaN} animar={false} />))).toBe(0);
  });

  it("desmontar no meio não deixa timer de pé", () => {
    const tela = render(<Sonda alvo={1} animar />);
    tela.unmount();

    // Sem a limpeza, estes timers chamariam setState num componente morto
    expect(() =>
      act(() => {
        jest.advanceTimersByTime(3000);
      }),
    ).not.toThrow();
  });

  /**
   * A guarda que impede a régua de degraus e o desenho de divergirem.
   *
   * Se alguém mudar um limite dentro do PotIcon e esquecer de `potSteps.ts`, a
   * animação ganha um passo morto — um intervalo em que nada aparece — e
   * ninguém perceberia olhando o código. Aqui o teste desenha o pote logo
   * antes e logo depois de cada degrau e cobra que o SVG mude.
   */
  it("todo degrau declarado muda mesmo o desenho do pote", () => {
    for (const degrau of POT_STEPS) {
      const antes = JSON.stringify(render(<PotIcon level={degrau - 0.001} />).toJSON());
      const depois = JSON.stringify(render(<PotIcon level={degrau + 0.001} />).toJSON());

      expect(antes).not.toEqual(depois);
    }
  });
});
