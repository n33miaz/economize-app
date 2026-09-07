import axios from "axios";

/**
 * Leitura única de uma falha de requisição.
 *
 * O app tinha a mania de gritar "servidores instáveis" para qualquer erro —
 * inclusive para um 404 de negócio e para um GET que a própria tela já sabia
 * explicar. Este módulo é a régua: o interceptor decide se AVISA, os stores
 * decidem o que ESCREVER no `ErrorState`, e os dois partem da mesma leitura.
 *
 * Ele é puro de propósito — não conhece o cliente HTTP, nem store, nem tela —
 * para ser testável ponta a ponta e para os stores poderem importá-lo sem
 * arrastar o `api.ts` inteiro (que os testes de store dublam por completo).
 */

export type RequestFailureKind =
  /** O navegador sabe que está sem rede (`navigator.onLine === false`). */
  | "offline"
  /** Sem resposta, ou 502/503 do proxy da hospedagem: a API está subindo. */
  | "waking"
  /** 429 — o servidor pediu calma. */
  | "rate-limited"
  /** 401/403 — a sessão acabou. */
  | "unauthorized"
  /** 426 — versão do app vencida; outra frente cuida da tela disso. */
  | "upgrade"
  /** 5xx que não é hibernação: o servidor tropeçou. */
  | "server"
  /** 4xx de negócio: a resposta explica, e quem chamou é que mostra. */
  | "client"
  /** Não é falha HTTP (erro de código, cancelamento): não há o que repetir. */
  | "unknown";

export interface RequestFailure {
  kind: RequestFailureKind;
  /** Frase pronta para a tela, no tom da casa: sem culpar o servidor à toa. */
  message: string;
  /** Repetir o MESMO pedido, sem mudar nada, tem chance de dar certo? */
  retryable: boolean;
  /** Status HTTP; null quando nem houve resposta. */
  status: number | null;
  /** `Retry-After` em segundos, quando o 429 veio com o cabeçalho. */
  retryAfterSeconds: number | null;
}

export const FAILURE_MESSAGES: Record<RequestFailureKind, string> = {
  offline: "Você está offline. Verifique a conexão e tente de novo.",
  waking: "O servidor está acordando. Aguarde alguns segundos e tente de novo.",
  "rate-limited": "Muitas solicitações em pouco tempo. Aguarde alguns segundos.",
  unauthorized: "Sua sessão expirou. Faça login novamente.",
  upgrade: "Atualize o aplicativo para continuar.",
  server: "Não conseguimos concluir agora. Já estamos tentando de novo.",
  client: "Não foi possível concluir a solicitação.",
  unknown: "Não foi possível concluir.",
};

// Códigos com que o axios descreve "nem chegou lá": timeout, rede fora,
// conexão recusada ou derrubada. Cancelamento fica FORA — quem cancelou não
// quer que ninguém repita nada em nome dele.
const NO_RESPONSE_CODES = new Set([
  "ECONNABORTED",
  "ERR_NETWORK",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "ECONNRESET",
]);

// Os dois status que o proxy da hospedagem devolve enquanto o container
// hibernado sobe. Só contam como "acordando" com o cabeçalho de roteamento
// junto: um 503 da própria API é tropeço dela, não soneca.
const WAKING_STATUSES = new Set([502, 503]);
const HOSTING_ROUTING_HEADER = "x-render-routing";

function readStatus(error: unknown): number | null {
  const status = (error as { response?: { status?: unknown } } | null)
    ?.response?.status;
  return typeof status === "number" ? status : null;
}

/**
 * Cabeçalho da resposta, tolerando as formas que os adaptadores devolvem:
 * `AxiosHeaders` (com `get`), objeto em minúsculas ou na forma canônica.
 */
export function readResponseHeader(
  error: unknown,
  name: string,
): string | null {
  const headers = (error as { response?: { headers?: unknown } } | null)
    ?.response?.headers as
    | (Record<string, unknown> & { get?: (key: string) => unknown })
    | undefined;
  if (!headers) return null;
  let raw: unknown =
    typeof headers.get === "function" ? headers.get(name) : undefined;
  if (raw === undefined || raw === null) {
    raw = headers[name.toLowerCase()] ?? headers[name];
  }
  if (raw === undefined || raw === null) return null;
  const text = String(raw).trim();
  return text.length > 0 ? text : null;
}

/** O `detail` do ProblemDetail: a mensagem boa, quando o servidor a escreveu. */
function readDetail(error: unknown): string | null {
  const data = (
    error as { response?: { data?: { detail?: unknown } } } | null
  )?.response?.data;
  return typeof data?.detail === "string" && data.detail.trim().length > 0
    ? data.detail
    : null;
}

function browserIsOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function hadNoResponse(error: unknown): boolean {
  if (readStatus(error) !== null) return false;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && NO_RESPONSE_CODES.has(code)) return true;
  // Erro do axios sem `response` é rede ou timeout; um `Error` qualquer (bug
  // de parse, promessa rejeitada à mão) não é — e repetir não o consertaria
  return (
    axios.isAxiosError(error) && !error.response && code !== "ERR_CANCELED"
  );
}

function readRetryAfterSeconds(error: unknown): number | null {
  const raw = readResponseHeader(error, "Retry-After");
  if (raw === null) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds)) {
    return seconds >= 0 ? Math.ceil(seconds) : null;
  }
  // A outra forma prevista pelo protocolo é uma data HTTP
  const at = Date.parse(raw);
  if (Number.isNaN(at)) return null;
  return Math.max(0, Math.ceil((at - Date.now()) / 1000));
}

function failure(
  kind: RequestFailureKind,
  status: number | null,
  retryable: boolean,
  overrides: Partial<Pick<RequestFailure, "message" | "retryAfterSeconds">> = {},
): RequestFailure {
  return {
    kind,
    status,
    retryable,
    message: overrides.message ?? FAILURE_MESSAGES[kind],
    retryAfterSeconds: overrides.retryAfterSeconds ?? null,
  };
}

/**
 * Classifica a falha. Pura: mesma entrada, mesma saída — a única leitura de
 * ambiente é `navigator.onLine`, que é o que distingue "estou sem rede" de
 * "o servidor não respondeu", e só entra quando não houve resposta nenhuma.
 */
export function describeRequestFailure(error: unknown): RequestFailure {
  const status = readStatus(error);

  if (status === null) {
    if (!hadNoResponse(error)) return failure("unknown", null, false);
    if (browserIsOffline()) return failure("offline", null, true);
    return failure("waking", null, true);
  }

  if (status === 401 || status === 403) {
    return failure("unauthorized", status, false);
  }
  if (status === 426) return failure("upgrade", status, false);
  if (status === 429) {
    return failure("rate-limited", status, true, {
      retryAfterSeconds: readRetryAfterSeconds(error),
    });
  }
  if (
    WAKING_STATUSES.has(status) &&
    readResponseHeader(error, HOSTING_ROUTING_HEADER) !== null
  ) {
    return failure("waking", status, true);
  }
  if (status >= 500) return failure("server", status, true);

  return failure("client", status, false, {
    message: readDetail(error) ?? FAILURE_MESSAGES.client,
  });
}

/**
 * Mensagem para o `error` de um store que só LÊ.
 *
 * Falha de leitura não vira toast: a tela mostra um `ErrorState` com "tentar
 * de novo", e a frase precisa dizer o que aconteceu de verdade. Quando a
 * causa é de transporte (offline, servidor acordando, 429), a explicação do
 * domínio ("falha ao carregar extrato") esconderia justamente o que o usuário
 * consegue resolver — esperar, ou olhar o wi-fi. Nos outros casos a frase do
 * domínio é a melhor que existe, e é ela que fica.
 */
export function describeLoadFailure(error: unknown, fallback: string): string {
  const described = describeRequestFailure(error);
  switch (described.kind) {
    case "offline":
    case "waking":
    case "rate-limited":
    case "unauthorized":
      return described.message;
    default:
      return fallback;
  }
}
