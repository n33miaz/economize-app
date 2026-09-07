import type { ImageSourcePropType } from "react-native";

/**
 * Identidade visual dos bancos.
 *
 * O provedor manda a instituição como texto livre — "Nu Pagamentos S.A.",
 * "Banco Inter S.A.", "Itaú Unibanco" — e a mesma conta pode chegar com
 * grafia diferente entre uma sincronização e outra. Aqui essa variedade vira
 * uma CHAVE estável, e a chave vira logo.
 *
 * A casadura é por PALAVRA, e não por pedaço de palavra: "inter" dentro de
 * "Intermediação" ou "bb" dentro de "Abbey" dariam logo errado, e um logo
 * errado é pior do que nenhum — o monograma neutro é a resposta honesta para
 * quem não está na lista.
 */

export type BankKey =
  | "bb"
  | "bradesco"
  | "btg"
  | "c6"
  | "caixa"
  | "inter"
  | "itau"
  | "mercadopago"
  | "nubank"
  | "santander"
  | "sicoob"
  | "sicredi";

export const BANK_KEYS: BankKey[] = [
  "bb",
  "bradesco",
  "btg",
  "c6",
  "caixa",
  "inter",
  "itau",
  "mercadopago",
  "nubank",
  "santander",
  "sicoob",
  "sicredi",
];

// `require` estático, um por logo: o Metro só embala no bundle o que resolve
// em tempo de build, e um caminho montado em runtime ficaria de fora
export const BANK_LOGOS: Record<BankKey, ImageSourcePropType> = {
  bb: require("../../assets/banks/bb.png"),
  bradesco: require("../../assets/banks/bradesco.png"),
  btg: require("../../assets/banks/btg.png"),
  c6: require("../../assets/banks/c6.png"),
  caixa: require("../../assets/banks/caixa.png"),
  inter: require("../../assets/banks/inter.png"),
  itau: require("../../assets/banks/itau.png"),
  mercadopago: require("../../assets/banks/mercadopago.png"),
  nubank: require("../../assets/banks/nubank.png"),
  santander: require("../../assets/banks/santander.png"),
  sicoob: require("../../assets/banks/sicoob.png"),
  sicredi: require("../../assets/banks/sicredi.png"),
};

// Faixa dos diacríticos combinantes (U+0300–U+036F), montada por código e não
// por escape no literal: o intervalo fica legível e não depende de como o
// editor grava caracteres invisíveis
const COMBINING_MARKS = new RegExp(
  `[${String.fromCharCode(0x300)}-${String.fromCharCode(0x36f)}]`,
  "g",
);

/** Sem acento e em minúsculas: a forma em que dois nomes se comparam. */
function fold(value: string): string {
  return value.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/** As palavras do nome, já dobradas — é sobre elas que a casadura acontece. */
export function bankWords(value: string): string[] {
  return fold(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

/**
 * A chave do logo para o nome que o provedor mandou, ou `null` quando não há
 * logo para ele. Aceita `institution`, `name` ou `connectorName` — quem chama
 * escolhe o campo mais específico que tiver.
 */
export function bankKeyFor(value: string | null | undefined): BankKey | null {
  if (!value) return null;
  const words = bankWords(value);
  if (words.length === 0) return null;
  const has = (word: string) => words.includes(word);
  const phrase = words.join(" ");

  // Os nomes compostos vêm antes: "Banco do Brasil" também contém "banco", e
  // "Mercado Pago" chega tanto junto quanto separado
  if (has("nubank") || has("nu")) return "nubank";
  if (has("mercadopago") || has("meli") || phrase.includes("mercado pago")) {
    return "mercadopago";
  }
  if (has("bb") || phrase.includes("banco do brasil")) return "bb";
  if (has("inter")) return "inter";
  if (has("itau")) return "itau";
  if (has("bradesco")) return "bradesco";
  if (has("santander")) return "santander";
  if (has("caixa")) return "caixa";
  if (has("c6")) return "c6";
  if (has("btg")) return "btg";
  if (has("sicoob")) return "sicoob";
  if (has("sicredi")) return "sicredi";
  return null;
}

// Palavras que não carregam identidade: "Banco DO Brasil" é BB, não BDB, e o
// "S.A." do nome jurídico não é inicial de nada
const MONOGRAM_STOPWORDS = new Set([
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
  "o",
  "a",
  "s",
  "sa",
  "ltda",
]);

/**
 * Iniciais para o monograma de quem não tem logo: "Banco Inter" → "BI",
 * "Flash" → "F", "Nu Pagamentos S.A." → "NP". Vazio quando não há nome.
 */
export function bankMonogram(value: string | null | undefined): string {
  if (!value) return "";
  const all = value.trim().split(/\s+/).filter(Boolean);
  const meaningful = all.filter(
    (word) => !MONOGRAM_STOPWORDS.has(fold(word).replace(/[^a-z0-9]/g, "")),
  );
  const source = meaningful.length > 0 ? meaningful : all;
  return source
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join("");
}
