/**
 * Quando o número foi lido pela última vez — dito num lugar só.
 *
 * O defeito que isto resolve foi visto no concorrente e anotado com hora: a
 * tela de saldos dele dizia "Atualizado agora" enquanto a tela de Conexões,
 * no mesmo aplicativo e no mesmo minuto, dizia que a última leitura tinha
 * 11 horas. Não é um erro de relógio — é a frase "agora" escrita à mão,
 * solta na tela, sem nenhum carimbo por trás. Quem lê acredita, e o número
 * velho passa por novo.
 *
 * A regra daqui é curta: **o rótulo nasce sempre de um instante medido.**
 * Sem instante não existe "agora" — existe "sem leitura ainda", que é a
 * verdade. E o mesmo instante que gera o texto gera o tom, para a tela não
 * precisar decidir sozinha o que é velho.
 *
 * Aceita ISO (o que a API devolve) e epoch em ms (o que os stores guardam)
 * porque as duas formas existem no app, e obrigar a conversão na chamada
 * seria mais um lugar para errar.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Quanto tempo o número ainda é "de agora".
 *
 * Uma hora é o limite porque é a cadência de sincronização das conexões
 * bancárias: dentro dela, o valor na tela é o valor que o banco tinha. Um dia
 * é o limite do aceitável — passou disso, a tela precisa dizer em cor, não só
 * em texto, que aquele saldo pode ter mudado.
 */
export const FRESH_UNTIL_MS = HOUR;
export const AGING_UNTIL_MS = DAY;

/**
 * `fresh` a tela mostra discreto; `aging` merece atenção; `stale` e `unknown`
 * pedem cor de aviso, porque o número pode estar errado agora.
 */
export type FreshnessTone = "fresh" | "aging" | "stale" | "unknown";

export interface FreshnessStampValue {
  label: string;
  tone: FreshnessTone;
  /** Milissegundos desde a leitura; `null` quando não houve leitura. */
  ageMs: number | null;
}

/** ISO, epoch em ms, ou nada. */
export type Instant = string | number | null | undefined;

function toEpoch(value: Instant): number | null {
  if (value === null || value === undefined) return null;
  const time = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function shortDate(time: number): string {
  const date = new Date(time);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/**
 * "agora", "há 5 min", "há 2 h", "há 3 dias" ou a data curta; `null` sem
 * instante — e `null` é de propósito: quem chama tem de escolher o que dizer
 * quando não há leitura, em vez de herdar um "agora" que ninguém mediu.
 *
 * Relógio adiantado no aparelho daria diferença negativa e um "há -3 min"
 * absurdo; o piso em zero devolve "agora", que é o mais próximo da verdade
 * que dá para afirmar.
 */
export function formatRelativeTime(
  value: Instant,
  now: number = Date.now(),
): string | null {
  const time = toEpoch(value);
  if (time === null) return null;
  const diff = Math.max(0, now - time);
  if (diff < MINUTE) return "agora";
  if (diff < HOUR) return `há ${Math.floor(diff / MINUTE)} min`;
  if (diff < DAY) return `há ${Math.floor(diff / HOUR)} h`;
  if (diff < 7 * DAY) {
    const days = Math.floor(diff / DAY);
    return `há ${days} ${days === 1 ? "dia" : "dias"}`;
  }
  return shortDate(time);
}

/**
 * O carimbo inteiro: texto, tom e idade. É o que a tela desenha.
 *
 * @param prefix palavra que abre a frase ("atualizado", "sincronizado"). Fica
 *               fora do módulo porque muda com o que está sendo carimbado, e
 *               entra em minúscula para colar em qualquer lugar da linha.
 */
export function freshnessStamp(
  value: Instant,
  now: number = Date.now(),
  prefix = "atualizado",
): FreshnessStampValue {
  const time = toEpoch(value);
  if (time === null) {
    // Nunca "agora": sem leitura, o honesto é dizer que não houve
    return { label: "sem leitura ainda", tone: "unknown", ageMs: null };
  }
  const ageMs = Math.max(0, now - time);
  const relative = formatRelativeTime(time, now) ?? "";
  const tone: FreshnessTone =
    ageMs < FRESH_UNTIL_MS ? "fresh" : ageMs < AGING_UNTIL_MS ? "aging" : "stale";
  // Passada uma semana o texto vira data, e data pede "em": "sincronizado
  // há 3 dias" e "sincronizado em 01/09/2026" leem os dois como frase
  const juncao = ageMs >= 7 * DAY ? `${prefix} em` : prefix;
  return { label: `${juncao} ${relative}`, tone, ageMs };
}
