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
 * O que a tela mostra no lugar de um número que não existe.
 *
 * Campo opcional da API chega `null` mesmo onde o tipo promete `number` (o
 * resumo de investimentos manda `profit: null` sem posição com preço), e
 * `null.toLocaleString` é exceção de renderização: em 12/11/2026 isso levava
 * o app inteiro para a tela de abertura. Os formatadores de DINHEIRO devolvem
 * este traço para nulo, indefinido, NaN e infinito. Nunca zero: "R$ 0,00"
 * afirmaria um valor que ninguém mediu. (Percentual e número solto seguem a
 * regra antiga deles, zero: nunca lançaram, e o resultado é colado a unidades
 * — "% a.a.", "pts" — onde um traço no meio da frase leria pior.)
 */
export const SEM_VALOR = "—";

/** Número de verdade: nem nulo, nem NaN, nem infinito. */
const temValor = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/**
 * Valor completo em BRL (ex.: "R$ 1.234,56"), sempre com 2 casas.
 * `opts` permite ajustes pontuais de Intl sem sair do padrão pt-BR.
 */
export function formatBRL(
  value: number,
  opts?: Intl.NumberFormatOptions,
): string {
  if (!temValor(value)) return SEM_VALOR;
  // Arredonda nas casas que vão aparecer ANTES de formatar: uma soma em ponto
  // flutuante que devia dar zero chega como -3,5e-15, e o Intl escreve isso
  // "-R$ 0,00". O `|| 0` troca o -0 que sobra do arredondamento por 0.
  // Respeita `maximumFractionDigits` maior (cotação com 4 casas) para não
  // cortar precisão de quem pediu mais
  const casas = Math.max(2, opts?.maximumFractionDigits ?? 2);
  const fator = 10 ** casas;
  const arredondado = Math.round(value * fator) / fator || 0;
  return arredondado.toLocaleString("pt-BR", {
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
  if (!temValor(value)) return SEM_VALOR;
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

/**
 * Percentual em pt-BR — "-0,01%", "+1,5%".
 *
 * Existe pelo MESMO motivo que tirou o `toFixed(2)` do dinheiro, no topo deste
 * arquivo: `toFixed` devolve ponto decimal. O app mostrava "R$ 5,18" e
 * "-0.01%" lado a lado no mesmo cartão, com dois separadores diferentes.
 *
 * @param signed prefixa "+" no positivo, para variação onde o sinal é o dado
 */
export function formatPercent(
  value: number,
  opts?: { decimals?: number; signed?: boolean },
): string {
  const decimals = opts?.decimals ?? 2;
  // NaN/Infinity viram 0: um "NaN%" na tela assusta mais do que informa
  const safe = Number.isFinite(value) ? value : 0;
  const digits = safe.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  // o negativo já vem do Intl; só o "+" precisa ser posto à mão
  const sign = opts?.signed && safe > 0 ? "+" : "";
  return `${sign}${digits}%`;
}

/**
 * Número solto em pt-BR, para o que não é moeda nem porcentagem (cotação com
 * símbolo à parte, resultado de conversão). Mesma razão do `formatPercent`.
 */
export function formatDecimal(
  value: number,
  decimals = 2,
  // Teto opcional de casas: quantidade de ativo não tem número fixo de casas
  // ("0,5" dólar, "0,00012345" bitcoin) e min = max cortaria a cripto em zero
  maxDecimals = decimals,
): string {
  const safe = Number.isFinite(value) ? value : 0;
  return safe.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: Math.max(decimals, maxDecimals),
  });
}

// Ponto em grupos de 3 sem vírgula: "2.500", "1.234.567". O primeiro grupo
// não começa com zero — "0.500" e "0.001" são decimais (quantidade de cripto,
// fração de dólar) e lê-los como milhar multiplicaria o valor por mil
const MILHAR_SO_COM_PONTO = /^-?[1-9]\d{0,2}(\.\d{3})+$/;

/**
 * Texto do campo de valor → número. A ÚNICA leitura de valor digitado do app:
 * cada tela tinha a sua, e a que tratava "2.500" como R$ 2,50 gravava o valor
 * mil vezes menor em silêncio em orçamento, reserva, desejo e renda.
 *
 * Regra (pt-BR primeiro, sem esquecer quem cola número do navegador):
 *
 * | Entrada        | Lê       | Por quê                                     |
 * |----------------|----------|---------------------------------------------|
 * | "1.234,56"     | 1234.56  | vírgula decimal, ponto de milhar            |
 * | "1234,56"      | 1234.56  | vírgula decimal                             |
 * | "1234.56"      | 1234.56  | ponto que não forma grupo de 3 é decimal    |
 * | "2.5", "12.34" | decimal  | idem                                        |
 * | "0.500"        | 0.5      | grupo começando em 0 não é milhar           |
 * | "2.500"        | 2500     | ponto em grupos de 3 é milhar               |
 * | "1.234.567"    | 1234567  | idem                                        |
 * | "1.234"        | 1234     | AMBÍGUO: vale milhar, como `parseAmountInput`|
 * |                |          | já fazia — em pt-BR "1.234" é mil e tanto   |
 * | "R$ -1.234,56" | -1234.56 | "R$", espaço e sinal são tolerados          |
 * | "", "-", ","   | null     | não sobra número                            |
 * | "1,234,567"    | null     | duas vírgulas não é valor que se leia       |
 *
 * Devolve `null` quando não dá para ler um número, para quem chama decidir a
 * mensagem: "informe um valor" e "valor inválido" são erros diferentes — e o
 * campo vazio não pode virar 0 e ser aceito pelo servidor como valor.
 */
export function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/[^\d,.-]/g, "");
  if (!/\d/.test(cleaned)) return null;
  let normalized: string;
  if (cleaned.includes(",")) {
    // Vírgula é o decimal em pt-BR; o ponto que sobra é de milhar. Mais de
    // uma vírgula vira NaN no Number abaixo e sai null
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (MILHAR_SO_COM_PONTO.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "");
  } else {
    // ponto solto ("1234.56", "2.5") segue sendo decimal de quem cola número
    normalized = cleaned;
  }
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}
