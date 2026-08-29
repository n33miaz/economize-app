import type { NewsCategory, NewsRegion } from "../store/preferencesStore";

// Lógica pura do carrossel de notícias do Mercado, extraída do componente
// para ser testável sem montar UI nem depender de relógio real.

/** Quantas notícias o carrossel mantém em memória por vez. */
export const TICKER_LIMIT = 15;
/** Cadência do avanço automático. */
export const TICKER_ROTATE_MS = 20_000;
/** Janela de pausa após interação manual — o usuário está lendo. */
export const TICKER_PAUSE_MS = 30_000;
/** Renovação da lista, alinhada ao cache do servidor. */
export const TICKER_REFRESH_MS = 10 * 60_000;

/**
 * Módulo que nunca devolve negativo: deslizar para trás a partir da primeira
 * notícia precisa cair na última, e `%` puro devolveria -1.
 */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export interface TickerQueryParams {
  limit: number;
  region?: string;
  category?: string;
}

/**
 * Preferências viram parâmetros de rede só quando restringem algo: "all" é
 * ausência de filtro. O servidor antigo ignora os params sem mudar o shape da
 * resposta, então mandar só o necessário mantém a URL estável entre versões.
 */
export function buildTickerParams(
  region: NewsRegion,
  category: NewsCategory,
): TickerQueryParams {
  const params: TickerQueryParams = { limit: TICKER_LIMIT };
  if (region !== "all") params.region = region;
  if (category !== "all") params.category = category;
  return params;
}

interface TickerArticleLike {
  url?: string | null;
  title?: string | null;
}

/**
 * Saneia a resposta para o carrossel: sem manchete ou link não há o que
 * mostrar nem abrir, URL repetida quebraria a chave estável dos slides, e o
 * corte em `limit` protege contra o servidor antigo, que ignora `limit=`.
 */
export function prepareTickerArticles<T extends TickerArticleLike>(
  articles: T[] | null | undefined,
  limit: number = TICKER_LIMIT,
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const article of articles ?? []) {
    if (!article?.url || !article?.title) continue;
    if (seen.has(article.url)) continue;
    seen.add(article.url);
    result.push(article);
    if (result.length >= limit) break;
  }
  return result;
}

/**
 * Posição de leitura após a renovação silenciosa da lista: se a notícia em
 * tela continua existindo, o índice segue ela (mesmo que tenha mudado de
 * lugar); senão, o índice antigo é reaproveitado via módulo — nunca um salto
 * para o zero no meio da leitura.
 */
export function indexAfterRefresh(
  articles: TickerArticleLike[],
  currentUrl: string | null,
  fallbackIndex: number,
): number {
  if (articles.length === 0) return 0;
  if (currentUrl) {
    const found = articles.findIndex((article) => article.url === currentUrl);
    if (found >= 0) return found;
  }
  return wrapIndex(fallbackIndex, articles.length);
}

/**
 * Tempo relativo compacto em pt-BR. Recebe `now` por parâmetro para o
 * componente decidir o relógio — e os testes não dependerem de Date.now.
 */
export function relativeTimeLabel(publishedAt: string, now: number): string {
  const timestamp = Date.parse(publishedAt);
  if (Number.isNaN(timestamp)) return "";
  const diffMinutes = Math.floor((now - timestamp) / 60_000);
  if (diffMinutes < 1) return "agora";
  if (diffMinutes < 60) return `há ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `há ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays === 1 ? "há 1 dia" : `há ${diffDays} dias`;
  // Mais de uma semana deixa de ser "momento": a data absoluta diz mais
  return new Date(timestamp).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

export interface AutoAdvanceController {
  /** Agenda o próximo avanço em `rotateMs`. */
  start(): void;
  /** Cancela qualquer agendamento pendente. */
  stop(): void;
  /** Interação manual: o próximo avanço espera `pauseMs` em vez de `rotateMs`. */
  pause(): void;
}

/**
 * Piloto do avanço automático como uma máquina de um timer só: cada tick
 * reagenda o seguinte, e a pausa é apenas o mesmo timer com espera maior.
 * Fica fora do React para o teste controlar tudo com fake timers e para o
 * componente ter um único ponto de limpeza (stop).
 *
 * `running` é estado explícito porque pause() chega de handlers de gesto que
 * podem disparar depois do stop() do cleanup (release após blur, gesto com
 * leitor de tela ativo): sem a trava, a pausa "ressuscitava" um piloto que o
 * componente já tinha desligado — e o timer auto-reagendável sobrevivia até
 * ao desmonte.
 */
export function createAutoAdvance(
  onAdvance: () => void,
  { rotateMs, pauseMs }: { rotateMs: number; pauseMs: number },
): AutoAdvanceController {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;

  const clear = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const schedule = (delay: number) => {
    clear();
    timer = setTimeout(() => {
      timer = null;
      onAdvance();
      schedule(rotateMs);
    }, delay);
  };

  return {
    start: () => {
      running = true;
      schedule(rotateMs);
    },
    stop: () => {
      running = false;
      clear();
    },
    // Só adia o que está andando: pausa nunca liga um piloto parado
    pause: () => {
      if (running) schedule(pauseMs);
    },
  };
}
