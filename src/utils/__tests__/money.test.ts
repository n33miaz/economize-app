import { formatBRL, formatBRLCompact } from "../money";

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
