import type { ProviderBill } from "../../services/api";
import { formatBRL } from "../money";
import {
  compareWithProviderBill,
  describeProviderBill,
} from "../providerBill";

const fatura = (over: Partial<ProviderBill> = {}): ProviderBill => ({
  closingDate: "2026-08-31",
  dueDate: "2026-09-07",
  total: 2311.49,
  minimumPayment: 347.63,
  financeCharges: null,
  allowsInstallments: true,
  syncedAt: "2026-09-21T10:00:00Z",
  ...over,
});

describe("comparar a nossa fatura com a do banco", () => {
  it("o caso que motivou tudo: o banco fechou MAIS do que enxergamos", () => {
    // Medido na conta do dono em 21/09/2026
    const c = compareWithProviderBill(775.67, fatura())!;

    expect(c.agreement).toBe("faltando");
    expect(c.difference).toBeCloseTo(1535.82, 2);
    expect(c.headline).toBe(`Faltam ${formatBRL(1535.82)} aqui`);
    // a frase tem de dizer o que fazer, não só que diverge
    expect(c.detail).toMatch(/reconecte o banco ou importe/i);
  });

  it("quando bate, diz que bate — silêncio pareceria falta de informação", () => {
    const c = compareWithProviderBill(2311.49, fatura())!;

    expect(c.agreement).toBe("confere");
    expect(c.difference).toBe(0);
  });

  it("diferença de centavo é arredondamento, não divergência", () => {
    expect(compareWithProviderBill(2311.494, fatura())!.agreement).toBe("confere");
  });

  it("somar MAIS que o banco é recorte de ciclo, e a frase não acusa o banco", () => {
    const c = compareWithProviderBill(2500, fatura())!;

    expect(c.agreement).toBe("adiantado");
    expect(c.difference).toBeCloseTo(188.51, 2);
    expect(c.detail).toMatch(/virada do ciclo/i);
    // "sobrando" diria que o banco cobrou a menos, o que não sabemos
    expect(c.headline).not.toMatch(/sobrando/i);
  });

  it("sem fatura do banco não há o que comparar", () => {
    expect(compareWithProviderBill(100, null)).toBeNull();
    expect(compareWithProviderBill(100, undefined)).toBeNull();
    expect(compareWithProviderBill(100, fatura({ total: null }))).toBeNull();
  });
});

describe("a linha curta da fatura do banco", () => {
  it("junta vencimento, mínimo e encargos", () => {
    expect(describeProviderBill(fatura({ financeCharges: 20 }))).toBe(
      `vence 07/09 · mínimo ${formatBRL(347.63)} · encargos ${formatBRL(20)}`,
    );
  });

  it("mínimo zero não vira linha — zero e 'não sei' não são a mesma coisa", () => {
    expect(describeProviderBill(fatura({ minimumPayment: 0 }))).toBe("vence 07/09");
  });

  it("sem nada para dizer, não diz nada", () => {
    expect(
      describeProviderBill(fatura({ dueDate: null, minimumPayment: null })),
    ).toBeNull();
    expect(describeProviderBill(null)).toBeNull();
  });
});
