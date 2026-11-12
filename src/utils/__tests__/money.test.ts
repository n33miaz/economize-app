import {
  formatBRL,
  formatBRLCompact,
  formatDecimal,
  formatPercent,
  parseAmount,
  SEM_VALOR,
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

describe("parseAmount — a única leitura de valor digitado", () => {
  it.each([
    // pt-BR com vírgula decimal
    ["1.234,56", 1234.56],
    ["1234,56", 1234.56],
    ["21,90", 21.9],
    ["0,5", 0.5],
    // ponto que não forma grupo de 3 é decimal de quem cola número
    ["1234.56", 1234.56],
    ["12.34", 12.34],
    ["2.5", 2.5],
    ["1234.567", 1234.567],
    // grupo começando em zero não é milhar: cripto e fração de dólar
    ["0.500", 0.5],
    ["0.001", 0.001],
    // ponto em grupos de 3 é milhar — "2.500" virava R$ 2,50
    ["2.500", 2500],
    ["1.234.567", 1234567],
    // o ambíguo: vale milhar, como `parseAmountInput` já fazia
    ["1.234", 1234],
    // inteiro, "R$", espaços e negativos
    ["100", 100],
    ["R$ 1.234,56", 1234.56],
    ["  2.500  ", 2500],
    ["R$ 18.000,50", 18000.5],
    ["-1.234,56", -1234.56],
    ["R$ -1.234,56", -1234.56],
    ["-2.500", -2500],
    ["-12.5", -12.5],
  ])("%j → %p", (entrada, esperado) => {
    expect(parseAmount(entrada)).toBe(esperado);
  });

  it.each(["", "   ", "R$", "R$ ", "-", ",", ".", "abc", "1,234,567", "1-2"])(
    "%j → null",
    (entrada) => {
      expect(parseAmount(entrada)).toBeNull();
    },
  );
});

/**
 * Campo opcional da API chega como `null` mesmo quando o tipo diz `number`
 * (o resumo de investimentos manda `profit: null` sem posição com preço).
 * Medido em 12/11/2026: `null.toLocaleString` derrubava o app inteiro. O
 * formatador é a segunda linha de defesa — devolve um traço, nunca "R$ 0,00",
 * porque zero afirmaria um valor que ninguém mediu.
 */
describe("valor ausente", () => {
  const ausentes = [null, undefined, Number.NaN, Number.POSITIVE_INFINITY] as unknown as number[];

  it("formatBRL devolve o traço em vez de lançar", () => {
    for (const valor of ausentes) expect(formatBRL(valor)).toBe(SEM_VALOR);
  });

  it("formatBRLCompact devolve o traço em vez de lançar", () => {
    for (const valor of ausentes) expect(formatBRLCompact(valor)).toBe(SEM_VALOR);
  });

  it("percentual e número solto ausentes não lançam: seguem virando zero", () => {
    for (const valor of ausentes) {
      expect(formatPercent(valor)).toBe("0,00%");
      expect(formatDecimal(valor)).toBe("0,00");
    }
  });

  it("zero continua sendo zero: é valor medido", () => {
    expect(plain(formatBRL(0))).toBe("R$ 0,00");
    expect(formatPercent(0)).toBe("0,00%");
  });
});
