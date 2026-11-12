import { valorDoAporte } from "../walletValue";

const aporte = { assetCode: "USD", quantity: 2, priceAtTransaction: 5 };

describe("valorDoAporte", () => {
  it("com cotação, vale quantidade × cotação", () => {
    expect(valorDoAporte(aporte, [{ code: "USD", buy: 6 }])).toEqual({
      valor: 12,
      custo: 10,
      estimado: false,
    });
  });

  // Antes a Carteira valia 0 aqui e a Home valia o custo
  it("sem cotação, vale o custo e diz que é estimado", () => {
    expect(valorDoAporte(aporte, [])).toEqual({
      valor: 10,
      custo: 10,
      estimado: true,
    });
  });

  // A API manda `null` onde o tipo promete número
  it.each([null, Number.NaN, 0, -1])("cotação %p conta como ausente", (buy) => {
    expect(
      valorDoAporte(aporte, [{ code: "USD", buy: buy as unknown as number }])
        .estimado,
    ).toBe(true);
  });
});
