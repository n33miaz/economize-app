import type { NewsArticle } from "../services/api";

/**
 * Quais manchetes do radar falam DESTE ativo (EC-103).
 *
 * <p>Filtro local, sem requisição nova: as notícias do mercado já estão
 * carregadas, e o que falta é dizer quais delas têm a ver com o papel aberto.
 *
 * <p>Casa pelo código ("PETR4") ou por uma palavra distintiva do nome da
 * empresa. Palavra distintiva exclui o jargão societário que todo nome de
 * companhia carrega — "SA", "ON", "PN", "Holding" casariam com metade do
 * noticiário e transformariam a seção em ruído.
 */

/** Vocabulário que aparece em quase todo nome de companhia aberta. */
const JARGAO_SOCIETARIO = new Set([
  "sa",
  "s",
  "on",
  "pn",
  "pna",
  "pnb",
  "ltda",
  "holding",
  "holdings",
  "participacoes",
  "participacao",
  "brasil",
  "brasileira",
  "brasileiro",
  "cia",
  "companhia",
  "corp",
  "inc",
  "pfd",
  "unt",
  "units",
  "do",
  "da",
  "de",
  "e",
]);

/** Quantas manchetes a folha mostra: mais que isso vira uma segunda tela. */
export const MAX_ASSET_NEWS = 3;

function semAcento(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
}

/**
 * As palavras do nome que identificam a empresa. Menos de três letras sai
 * fora junto com o jargão: "AS" e "IP" casariam com qualquer texto.
 */
export function distinctiveWords(name: string | null | undefined): string[] {
  return semAcento(name ?? "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !JARGAO_SOCIETARIO.has(word));
}

export function assetNews(
  articles: NewsArticle[],
  code: string | null | undefined,
  name: string | null | undefined,
  limit: number = MAX_ASSET_NEWS,
): NewsArticle[] {
  const codigo = semAcento(code ?? "").trim();
  const palavras = distinctiveWords(name);
  if (!codigo && palavras.length === 0) return [];

  const alvos = codigo ? [codigo, ...palavras] : palavras;
  return articles
    .filter((article) => {
      const texto = semAcento(`${article.title} ${article.description ?? ""}`);
      // Fronteira de palavra: sem ela, "vale" casaria com "valeu" e "equivale",
      // e a seção encheria de notícia que não fala da empresa
      return alvos.some((alvo) =>
        new RegExp(`(^|[^a-z0-9])${escapar(alvo)}([^a-z0-9]|$)`).test(texto),
      );
    })
    .slice(0, limit);
}

function escapar(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * O papel contra o índice, no dia (EC-103).
 *
 * <p>"Subiu 4%" sozinho não diz se foi o papel ou o mercado inteiro. Comparar
 * com o índice é o que separa desempenho de maré — e é a única comparação com
 * "ativo relevante" que não exige escolher, por conta própria, quais seriam os
 * pares de cada empresa.
 *
 * <p>Diferença menor que meio ponto percentual é dita como "acompanhou": abaixo
 * disso a distinção é ruído do fechamento, não informação.
 */
export function benchmarkPhrase(
  assetPct: number | null | undefined,
  benchmarkPct: number | null | undefined,
  benchmarkLabel: string,
): string | null {
  if (assetPct == null || benchmarkPct == null) return null;
  const diff = assetPct - benchmarkPct;
  if (Math.abs(diff) < 0.5) return `Acompanhou o ${benchmarkLabel} hoje`;
  const pontos = Math.abs(diff).toFixed(2).replace(".", ",");
  return diff > 0
    ? `${pontos} pontos acima do ${benchmarkLabel} hoje`
    : `${pontos} pontos abaixo do ${benchmarkLabel} hoje`;
}
