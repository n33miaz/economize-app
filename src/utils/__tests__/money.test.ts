import {
  formatBRL,
  formatBRLCompact,
  formatDecimal,
  formatPercent,
} from "../money";

// O Intl separa "R$" do número com espaço não separável (U+00A0); normalizar
// para espaço comum deixa os asserts legíveis sem depender desse detalhe
const plain = (s: string) => s.replace(/\u00A0/g, " ");

describe("formatBRL", () => {
  it("formats with pt-BR grouping and 2 decimal places", () => {
    expect(plain(formatBRL(18129.68))).toBe("R$ 18.129,68");
    expect(plain(formatBRL(1234.5))).toBe("R$ 1.234,50");
  });

  it("formats zero", () => {
    expect(plain(formatBRL(0))).toBe("R$ 0,00");
  });

  it("keeps the negative sign before R$", () => {
    expect(plain(formatBRL(-1234.56))).toBe("-R$ 1.234,56");
  });

  it("accepts Intl option overrides", () => {
    expect(
      plain(
        formatBRL(10, { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
      ),
    ).toBe("R$ 10");
  });
});

describe("formatBRLCompact", () => {
  it("keeps the full format below 100 thousand (6-digit rule)", () => {
    expect(plain(formatBRLCompact(0))).toBe("R$ 0,00");
    expect(plain(formatBRLCompact(9999.99))).toBe("R$ 9.999,99");
    expect(plain(formatBRLCompact(99_999.99))).toBe("R$ 99.999,99");
    expect(plain(formatBRLCompact(-99_999.99))).toBe("-R$ 99.999,99");
  });

  it("abbreviates thousands from 100 thousand with one decimal place", () => {
    expect(plain(formatBRLCompact(100_000))).toBe("R$ 100,0 mil");
    expect(plain(formatBRLCompact(123_400))).toBe("R$ 123,4 mil");
    expect(plain(formatBRLCompact(124_960))).toBe("R$ 125,0 mil");
    expect(plain(formatBRLCompact(999_940))).toBe("R$ 999,9 mil");
  });

  it("abbreviates millions from 1 million", () => {
    expect(plain(formatBRLCompact(1_000_000))).toBe("R$ 1,0 mi");
    expect(plain(formatBRLCompact(1_200_000))).toBe("R$ 1,2 mi");
    expect(plain(formatBRLCompact(12_345_678))).toBe("R$ 12,3 mi");
  });

  it("promotes to millions when rounding would produce 1.000,0 mil", () => {
    expect(plain(formatBRLCompact(999_950))).toBe("R$ 1,0 mi");
  });

  it("keeps the negative sign before R$ when abbreviating", () => {
    expect(plain(formatBRLCompact(-123_400))).toBe("-R$ 123,4 mil");
    expect(plain(formatBRLCompact(-1_500_000))).toBe("-R$ 1,5 mi");
    expect(plain(formatBRLCompact(-999_950))).toBe("-R$ 1,0 mi");
  });

  it("uses the same non-breaking space as Intl after R$", () => {
    expect(formatBRLCompact(100_000)).toBe("R$\u00A0100,0 mil");
  });
});

describe("formatPercent", () => {
  it("usa vírgula, como todo o resto do app", () => {
    // era "-0.01%" ao lado de "R$ 5,18" no MESMO cartão da Home
    expect(formatPercent(-0.01)).toBe("-0,01%");
    expect(formatPercent(1.5)).toBe("1,50%");
  });

  it("marca o positivo só quando o sinal é o dado", () => {
    expect(formatPercent(2.35, { signed: true })).toBe("+2,35%");
    expect(formatPercent(-2.35, { signed: true })).toBe("-2,35%");
    // sem `signed`, nada de "+": a variação já vem com o ícone ao lado
    expect(formatPercent(2.35)).toBe("2,35%");
  });

  it("zero não ganha sinal", () => {
    expect(formatPercent(0, { signed: true })).toBe("0,00%");
  });

  it("respeita o número de casas pedido", () => {
    expect(formatPercent(12.34, { decimals: 1 })).toBe("12,3%");
    expect(formatPercent(12.34, { decimals: 0 })).toBe("12%");
  });

  it("agrupa o milhar", () => {
    expect(formatPercent(1234.5, { decimals: 1 })).toBe("1.234,5%");
  });

  it("NaN e Infinity viram zero em vez de assustar na tela", () => {
    expect(formatPercent(NaN)).toBe("0,00%");
    expect(formatPercent(Infinity)).toBe("0,00%");
  });
});

describe("formatDecimal", () => {
  it("número solto também sai em pt-BR", () => {
    expect(formatDecimal(5.18)).toBe("5,18");
    expect(formatDecimal(1234.5)).toBe("1.234,50");
  });

  it("aceita outra precisão", () => {
    expect(formatDecimal(5.185, 1)).toBe("5,2");
  });

  it("valor inválido vira zero", () => {
    expect(formatDecimal(NaN)).toBe("0,00");
  });
});
