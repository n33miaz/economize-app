import { PISO_DE_AVISO, vale } from "../materiality";
import { firstRiskMonth, isMonthAtRisk } from "../recurrence";
import type { ForecastMonth } from "../../services/api";

const mes = (month: string, cumulativeNet: number): ForecastMonth =>
  ({
    month,
    start: `${month}-01`,
    end: `${month}-30`,
    income: 0,
    expense: 0,
    net: cumulativeNet,
    cumulativeNet,
    items: [],
  }) as unknown as ForecastMonth;

describe("Piso de materialidade", () => {
  it("os treze centavos do concorrente não valem uma tela", () => {
    expect(vale(0.13)).toBe(false);
  });

  it("abaixo do piso não interrompe, em qualquer sinal", () => {
    for (const valor of [0.01, 0.13, 1, 4.99, -0.13, -4.99]) {
      expect(vale(valor)).toBe(false);
    }
  });

  it("do piso para cima, merece frase", () => {
    for (const valor of [5, 5.01, 180, -5, -539.7]) {
      expect(vale(valor)).toBe(true);
    }
  });

  it("a borda é inclusiva", () => {
    expect(vale(PISO_DE_AVISO)).toBe(true);
    expect(vale(PISO_DE_AVISO - 0.01)).toBe(false);
  });

  it("ausente, NaN e Infinity são imateriais", () => {
    // Aviso sem número não tem o que dizer, e um Infinity vindo de divisão
    // por zero não pode virar alerta
    expect(vale(null)).toBe(false);
    expect(vale(undefined)).toBe(false);
    expect(vale(NaN)).toBe(false);
    expect(vale(Infinity)).toBe(false);
  });
});

/**
 * A distinção que o EC-212 existe para sustentar: o piso governa o que se
 * DIZ, nunca o que se CONTA. Estes dois testes, lado a lado, são a regra.
 */
describe("O piso governa o alerta, não a cor", () => {
  it("um mês que fecha em treze centavos negativos CONTINUA negativo", () => {
    // A cor descreve o número; pintá-lo de verde seria mentir
    expect(isMonthAtRisk(mes("2026-10", -0.13))).toBe(true);
  });

  it("mas ele NÃO ganha o alerta da Home", () => {
    expect(firstRiskMonth([mes("2026-10", -0.13)])).toBeNull();
  });

  it("um rombo de verdade continua alertando", () => {
    expect(firstRiskMonth([mes("2026-10", -539.7)])?.month).toBe("2026-10");
  });

  it("o alerta aponta o primeiro mês MATERIAL, pulando o imaterial antes dele", () => {
    const meses = [mes("2026-10", -0.13), mes("2026-11", -820)];

    expect(firstRiskMonth(meses)?.month).toBe("2026-11");
  });

  it("meses positivos não alertam", () => {
    expect(firstRiskMonth([mes("2026-10", 1200)])).toBeNull();
  });
});
