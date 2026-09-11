import type { ForecastItem } from "../../services/api";
import { declaredCaveat, declaredShare, forecastOrigin } from "../forecastOrigin";

type Item = Pick<ForecastItem, "source" | "settled" | "amount">;

const medido = (amount = 100): Item => ({ source: "DETECTED", settled: false, amount });
const informado = (amount = 100): Item => ({ source: "USER", settled: false, amount });
const conciliado = (amount = 100): Item => ({ source: "DETECTED", settled: true, amount });

/**
 * EC-206 — medido e informado não podem ter a mesma cara.
 *
 * Uma previsão junta o que o app mediu no extrato com o que a pessoa afirmou.
 * Sem a marca, ela parece mais firme do que é — e quando erra, ninguém sabe se
 * o app leu errado ou se quem digitou errou.
 */
describe("Origem de uma linha da previsão", () => {
  it("série detectada do extrato é MEDIDA", () => {
    expect(forecastOrigin(medido()).kind).toBe("measured");
    expect(forecastOrigin(medido()).badge).toBe("medido");
  });

  it("série agendada pela pessoa é INFORMADA", () => {
    expect(forecastOrigin(informado()).kind).toBe("declared");
    expect(forecastOrigin(informado()).badge).toBe("informado");
  });

  it("conciliada vence as duas: fato não é previsão", () => {
    // Chamá-la de "medido" junto das outras apagaria a diferença entre o que o
    // app espera e o que já entrou na conta
    expect(forecastOrigin(conciliado()).kind).toBe("settled");
    expect(forecastOrigin({ source: "USER", settled: true }).kind).toBe("settled");
  });

  it("toda origem tem selo curto e frase falada", () => {
    for (const item of [medido(), informado(), conciliado()]) {
      const origem = forecastOrigin(item);
      expect(origem.badge.length).toBeGreaterThan(0);
      expect(origem.spoken.length).toBeGreaterThan(origem.badge.length);
    }
  });
});

describe("Quanto da previsão é estimativa", () => {
  it("separa informado de medido, em módulo", () => {
    const { declared, measured, ratio } = declaredShare([
      medido(300),
      informado(-100),
      medido(-600),
    ]);

    expect(declared).toBe(100);
    expect(measured).toBe(900);
    expect(ratio).toBeCloseTo(0.1);
  });

  it("o conciliado fica FORA das duas contas — ele já andou", () => {
    const { declared, measured } = declaredShare([conciliado(5000), informado(100)]);

    expect(measured).toBe(0);
    expect(declared).toBe(100);
  });

  it("sem item nenhum, a proporção é zero e não NaN", () => {
    expect(declaredShare([]).ratio).toBe(0);
    expect(declaredShare([conciliado()]).ratio).toBe(0);
  });

  it("previsão inteiramente medida não ganha ressalva", () => {
    expect(declaredCaveat([medido(500), medido(300)])).toBeNull();
  });

  it("informado residual também não ganha ressalva", () => {
    // 5% de estimativa não muda decisão nenhuma, e um aviso que aparece sempre
    // ensina a ignorar avisos
    expect(declaredCaveat([medido(950), informado(50)])).toBeNull();
  });

  it("informado que pesa vira frase, com a porcentagem", () => {
    expect(declaredCaveat([medido(600), informado(400)])).toBe(
      "40% desta previsão é estimativa informada por você.",
    );
  });

  it("previsão só de estimativa diz 100%", () => {
    expect(declaredCaveat([informado(200), informado(300)])).toBe(
      "100% desta previsão é estimativa informada por você.",
    );
  });
});
