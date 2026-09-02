import type { Category } from "../services/api";

/**
 * A quebra por categoria que o relatório já guardava e ninguém lia (EC-047).
 *
 * <p>O relatório é um RETRATO: `categoriesJson` é o que ele viu no momento em
 * que foi gerado, e continua valendo mesmo que o usuário recategorize tudo
 * depois. É por isso que a fatia sai daqui e não das transações de hoje — as
 * duas respondem perguntas diferentes, e misturá-las faria o relatório mudar
 * de conteúdo sem ninguém ter gerado outro.
 *
 * <p>O que o retrato NÃO tem é tempo: são totais por categoria, sem data. Por
 * isso não existe série semanal a extrair daqui.
 */

/** A chave que o servidor grava quando a transação não tem categoria. */
const SEM_CATEGORIA = "OTHER";

export interface ReportSlice {
  /** Chave gravada no retrato: `systemKey` do seed ou slug da categoria. */
  key: string;
  /** Nome legível, resolvido no catálogo atual; a chave crua é o reserva. */
  label: string;
  /** Magnitude do gasto, sempre positiva. */
  expense: number;
  /** Fração do gasto total do período, de 0 a 1. */
  share: number;
}

/**
 * As fatias de GASTO do retrato, da maior para a menor.
 *
 * <p>Entrada fica fora: salário e gasto na mesma pizza somam grandezas opostas
 * e produzem um desenho que não significa nada. O retrato guarda o valor com
 * sinal, então a separação é exata, não heurística.
 */
export function parseReportCategories(
  categoriesJson: string | null | undefined,
  catalog: Category[] = [],
): ReportSlice[] {
  if (!categoriesJson) return [];

  let bruto: unknown;
  try {
    bruto = JSON.parse(categoriesJson);
  } catch {
    // JSON inválido é dado corrompido, não motivo para derrubar a tela
    return [];
  }
  if (bruto === null || typeof bruto !== "object" || Array.isArray(bruto)) {
    return [];
  }

  const gastos: { key: string; expense: number }[] = [];
  for (const [key, valor] of Object.entries(bruto as Record<string, unknown>)) {
    const gasto = expenseOf(valor);
    if (gasto === null || gasto <= 0) continue;
    gastos.push({ key, expense: gasto });
  }

  const total = gastos.reduce((soma, item) => soma + item.expense, 0);
  if (total <= 0) return [];

  return gastos
    .sort((a, b) => b.expense - a.expense)
    .map((item) => ({
      key: item.key,
      label: labelFor(item.key, catalog),
      expense: item.expense,
      share: item.expense / total,
    }));
}

/**
 * O gasto de uma entrada do retrato, nos DOIS formatos.
 *
 * <p>Formato atual: `{"income": 4400.00, "expense": 5830.00}`. Formato antigo:
 * um número com sinal por categoria, que somava entrada e saída na mesma chave
 * — uma categoria que recebeu 4.400 e gastou 5.830 virava `-1430`, e a fatia
 * contradizia o total de saídas do próprio relatório. Os relatórios já gravados
 * carregam esse formato, e continuam abrindo: com a limitação que sempre
 * tiveram, não com um erro novo.
 */
function expenseOf(valor: unknown): number | null {
  if (typeof valor === "number") {
    return valor < 0 ? Math.abs(valor) : 0;
  }
  if (valor !== null && typeof valor === "object" && !Array.isArray(valor)) {
    const bruto = (valor as { expense?: unknown }).expense;
    const numero = typeof bruto === "number" ? bruto : Number(bruto);
    return Number.isFinite(numero) ? Math.abs(numero) : null;
  }
  const numero = Number(valor);
  return Number.isFinite(numero) ? (numero < 0 ? Math.abs(numero) : 0) : null;
}

/**
 * O nome de hoje para a chave de ontem.
 *
 * <p>A categoria pode ter sido renomeada ou apagada depois do relatório. Nome
 * novo é melhor do que chave crua; chave crua é melhor do que "Sem categoria",
 * que afirmaria algo falso sobre o retrato.
 */
function labelFor(key: string, catalog: Category[]): string {
  // Chave de reserva de quem não tem categoria: vale para a fatia da pizza
  // tanto quanto para o rótulo do card
  if (key === SEM_CATEGORIA) return "Sem categoria";
  const achada = catalog.find(
    (category) => category.systemKey === key || category.slug === key,
  );
  return achada?.name ?? key;
}

/**
 * O nome da categoria dominante para a tela.
 *
 * <p>`OTHER` é a chave de reserva de quem não tem categoria: exibi-la crua faz
 * o card anunciar "Categoria dominante · OTHER", que não diz nada a ninguém.
 */
export function dominantLabel(
  key: string | null | undefined,
  catalog: Category[] = [],
): string | null {
  if (!key) return null;
  return labelFor(key, catalog);
}

/** A categoria do catálogo que corresponde à fatia, quando ainda existe. */
export function categoryForSlice(
  slice: ReportSlice,
  catalog: Category[],
): Category | undefined {
  return catalog.find(
    (category) => category.systemKey === slice.key || category.slug === slice.key,
  );
}
