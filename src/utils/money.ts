// Formatação monetária canônica do app. Cada tela mantinha a própria cópia
// de formatBRL e qualquer ajuste precisava ser repetido em cinco lugares —
// aqui vira fonte única. `toFixed(2)` está fora de questão: deixava
// "R$ 18129.68" na tela, com ponto no lugar da vírgula e sem separador de
// milhar, num app inteiro em pt-BR.

const THOUSAND = 1_000;
const MILLION = 1_000_000;

// Piso da abreviação: regra do produto é abreviar a partir de 6 dígitos
// inteiros (100 mil) — abaixo disso o valor completo ainda lê bem
const COMPACT_FLOOR = 100_000;

// Mesmo espaço não separável que o Intl põe depois do "R$" no formato
// completo — os dois formatos ficam idênticos lado a lado
const NBSP = "\u00A0";

/**
 * Valor completo em BRL (ex.: "R$ 1.234,56"), sempre com 2 casas.
 * `opts` permite ajustes pontuais de Intl sem sair do padrão pt-BR.
 */
export function formatBRL(
  value: number,
  opts?: Intl.NumberFormatOptions,
): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    ...opts,
  });
}

/**
 * Abreviação pt-BR para valores grandes — "abreviar em vez de espremer":
 * abaixo de 100 mil sai completo; a partir de 100 mil vira "R$ 123,4 mil";
 * a partir de 1 milhão vira "R$ 1,2 mi". Sempre uma casa decimal, vírgula
 * pt-BR e sinal negativo preservado antes do "R$", como no Intl.
 */
export function formatBRLCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs < COMPACT_FLOOR) return formatBRL(value);

  const sign = value < 0 ? "-" : "";
  let scaled = abs / THOUSAND;
  let suffix = "mil";
  // A escala é decidida DEPOIS do arredondamento a uma casa: 999.950
  // ficaria "R$ 1.000,0 mil" — promove para "R$ 1,0 mi"
  if (abs >= MILLION || Math.round(scaled * 10) / 10 >= THOUSAND) {
    scaled = abs / MILLION;
    suffix = "mi";
  }
  const digits = scaled.toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
  return `${sign}R$${NBSP}${digits} ${suffix}`;
}
