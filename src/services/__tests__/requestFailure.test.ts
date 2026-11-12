import { AxiosError, AxiosHeaders } from "axios";
import type { InternalAxiosRequestConfig } from "axios";

import {
  describeLoadFailure,
  describeSaveFailure,
  describeRequestFailure,
  isSessionEnded,
  SessionEndedError,
} from "../api";
import { summarizeErrorForLog } from "../requestFailure";

const config = {
  headers: new AxiosHeaders(),
  method: "get",
  url: "/x",
} as InternalAxiosRequestConfig;

/** Falha COM resposta do servidor, como o axios a entrega. */
function comResposta(
  status: number,
  headers: Record<string, string> = {},
  data: unknown = {},
): AxiosError {
  return new AxiosError("Request failed", "ERR_BAD_RESPONSE", config, {}, {
    status,
    statusText: "",
    headers,
    data,
    config,
  });
}

/** Falha SEM resposta: rede, timeout, recusa. */
function semResposta(code?: string): AxiosError {
  return new AxiosError("Network Error", code, config, {});
}

/** O 503 que a sincronização devolve quando a leitura de um banco falha. */
const PROBLEMA_SINCRONIZACAO = {
  type: "https://economize.app/erros/servico-indisponivel",
  title: "Serviço Indisponível",
  status: 503,
  detail:
    "Não foi possível ler Nubank no provedor agora; nada foi importado. Tente de novo em alguns minutos.",
};

const navigatorOriginal = (globalThis as { navigator?: unknown }).navigator;

function fingirRede(onLine: boolean | undefined) {
  Object.defineProperty(globalThis, "navigator", {
    value: onLine === undefined ? undefined : { onLine },
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  Object.defineProperty(globalThis, "navigator", {
    value: navigatorOriginal,
    configurable: true,
    writable: true,
  });
});

/**
 * A régua única das falhas de requisição.
 *
 * O que se prova aqui é a classificação — e, por consequência, o que o
 * interceptor e os stores vão dizer. A frase "servidores instáveis" saiu do
 * app de propósito, e este arquivo é o que impede ela de voltar por acidente.
 */
describe("describeRequestFailure", () => {
  it("sem resposta nenhuma é o servidor acordando, e vale repetir", () => {
    const r = describeRequestFailure(semResposta("ERR_NETWORK"));
    expect(r.kind).toBe("waking");
    expect(r.retryable).toBe(true);
    expect(r.status).toBeNull();
    expect(r.message).toMatch(/acordando/);
  });

  it("timeout (ECONNABORTED) é a mesma coisa que sem resposta", () => {
    const r = describeRequestFailure(semResposta("ECONNABORTED"));
    expect(r.kind).toBe("waking");
    expect(r.retryable).toBe(true);
  });

  it("pedido cancelado não é falha de servidor e não se repete", () => {
    const r = describeRequestFailure(semResposta("ERR_CANCELED"));
    expect(r.kind).toBe("unknown");
    expect(r.retryable).toBe(false);
  });

  it("sem resposta com o navegador offline é 'você está offline', dito uma vez só", () => {
    fingirRede(false);
    const r = describeRequestFailure(semResposta("ERR_NETWORK"));
    expect(r.kind).toBe("offline");
    expect(r.message).toMatch(/offline/i);
    expect(r.retryable).toBe(true);
  });

  it("navegador online (ou sem navigator) não muda a leitura de 'acordando'", () => {
    fingirRede(true);
    expect(describeRequestFailure(semResposta("ERR_NETWORK")).kind).toBe("waking");
    fingirRede(undefined);
    expect(describeRequestFailure(semResposta("ERR_NETWORK")).kind).toBe("waking");
  });

  it("com resposta, o navegador offline é ignorado — a resposta chegou", () => {
    fingirRede(false);
    expect(describeRequestFailure(comResposta(500)).kind).toBe("server");
  });

  it("429 com Retry-After é calmo, informativo e sabe quanto esperar", () => {
    const r = describeRequestFailure(comResposta(429, { "retry-after": "7" }));
    expect(r.kind).toBe("rate-limited");
    expect(r.retryAfterSeconds).toBe(7);
    expect(r.retryable).toBe(true);
    expect(r.message).toBe(
      "Muitas solicitações em pouco tempo. Aguarde alguns segundos.",
    );
  });

  it("429 lê o Retry-After também na forma canônica e arredonda para cima", () => {
    expect(
      describeRequestFailure(comResposta(429, { "Retry-After": "2.2" }))
        .retryAfterSeconds,
    ).toBe(3);
  });

  it("429 sem Retry-After continua sendo 429, só sem prazo", () => {
    const r = describeRequestFailure(comResposta(429));
    expect(r.kind).toBe("rate-limited");
    expect(r.retryAfterSeconds).toBeNull();
  });

  it("502 com o cabeçalho de roteamento da hospedagem é hibernação", () => {
    const r = describeRequestFailure(
      comResposta(502, { "x-render-routing": "hibernate-wake" }),
    );
    expect(r.kind).toBe("waking");
    expect(r.status).toBe(502);
    expect(r.retryable).toBe(true);
  });

  it("503 com o cabeçalho também acorda; sem ele é tropeço da própria API", () => {
    expect(
      describeRequestFailure(comResposta(503, { "x-render-routing": "wake" })).kind,
    ).toBe("waking");
    expect(describeRequestFailure(comResposta(503)).kind).toBe("server");
  });

  it("500 é falha do servidor, vale repetir, e a frase não culpa 'instabilidade'", () => {
    const r = describeRequestFailure(comResposta(500));
    expect(r.kind).toBe("server");
    expect(r.retryable).toBe(true);
    expect(r.status).toBe(500);
    expect(r.message).toBe(
      "Não conseguimos concluir agora. Já estamos tentando de novo.",
    );
    expect(r.message).not.toMatch(/inst[áa]ve/i);
  });

  it("404 é de negócio: leva o detail do servidor e não se repete", () => {
    const r = describeRequestFailure(
      comResposta(404, {}, { detail: "Não encontramos este cartão." }),
    );
    expect(r.kind).toBe("client");
    expect(r.retryable).toBe(false);
    expect(r.message).toBe("Não encontramos este cartão.");
  });

  it("4xx sem detail cai numa frase neutra", () => {
    const r = describeRequestFailure(comResposta(400));
    expect(r.kind).toBe("client");
    expect(r.message).toBe("Não foi possível concluir a solicitação.");
  });

  it("401 e 403 são sessão expirada", () => {
    expect(describeRequestFailure(comResposta(401))).toMatchObject({
      kind: "unauthorized",
      retryable: false,
      message: "Sua sessão expirou. Faça login novamente.",
    });
    expect(describeRequestFailure(comResposta(403)).kind).toBe("unauthorized");
  });

  it("426 é reconhecido e deixado para a outra frente", () => {
    const r = describeRequestFailure(comResposta(426));
    expect(r.kind).toBe("upgrade");
    expect(r.retryable).toBe(false);
  });

  it("Error comum (bug, promessa rejeitada à mão) não é rede e não se repete", () => {
    const r = describeRequestFailure(new Error("boom"));
    expect(r.kind).toBe("unknown");
    expect(r.retryable).toBe(false);
    expect(r.status).toBeNull();
  });

  it("aceita o objeto cru que os testes de store usam como erro", () => {
    // Os stores são testados com `{ response: { status } }` sem AxiosError por
    // trás; a leitura precisa ser a mesma para o dublê e para o erro real
    const r = describeRequestFailure({
      response: { status: 409, data: { detail: "Conexão já registrada." } },
    });
    expect(r.kind).toBe("client");
    expect(r.message).toBe("Conexão já registrada.");
  });

  it("503 classificado da API leva o detail com o banco e não se repete", () => {
    const r = describeRequestFailure(comResposta(503, {}, PROBLEMA_SINCRONIZACAO));
    expect(r.kind).toBe("server");
    expect(r.message).toBe(PROBLEMA_SINCRONIZACAO.detail);
    // "tente em alguns minutos": repetir em 1 s releria todos os bancos
    expect(r.retryable).toBe(false);
  });

  it("5xx com detail técnico segue com a frase genérica", () => {
    const r = describeRequestFailure(
      comResposta(500, {}, {
        type: "https://economize.app/erros/erro-interno",
        detail: "Internal Server Error",
      }),
    );
    expect(r.message).toBe(
      "Não conseguimos concluir agora. Já estamos tentando de novo.",
    );
    expect(r.retryable).toBe(true);
  });

  it("lê cabeçalho vindo como AxiosHeaders", () => {
    const headers = new AxiosHeaders({ "Retry-After": "4" });
    const erro = new AxiosError("x", "ERR_BAD_RESPONSE", config, {}, {
      status: 429,
      statusText: "",
      headers,
      data: {},
      config,
    });
    expect(describeRequestFailure(erro).retryAfterSeconds).toBe(4);
  });
});

describe("describeLoadFailure — a frase do ErrorState de quem só lê", () => {
  it("transporte fala por si: acordando, offline, 429, sessão", () => {
    expect(describeLoadFailure(semResposta("ERR_NETWORK"), "Falha ao carregar extrato."))
      .toMatch(/acordando/);
    expect(describeLoadFailure(comResposta(429), "Falha ao carregar extrato."))
      .toMatch(/Muitas solicitações/);
    expect(describeLoadFailure(comResposta(401), "Falha ao carregar extrato."))
      .toMatch(/sessão expirou/);
    fingirRede(false);
    expect(describeLoadFailure(semResposta("ERR_NETWORK"), "Falha ao carregar extrato."))
      .toMatch(/offline/i);
  });

  it("5xx e 4xx ficam com a frase do domínio, que é a que explica a tela", () => {
    expect(describeLoadFailure(comResposta(500), "Falha ao carregar extrato."))
      .toBe("Falha ao carregar extrato.");
    expect(describeLoadFailure(comResposta(404), "Falha ao carregar extrato."))
      .toBe("Falha ao carregar extrato.");
  });

  it("Error comum também fica com a frase do domínio", () => {
    expect(describeLoadFailure(new Error("offline"), "Erro ao carregar carteira"))
      .toBe("Erro ao carregar carteira");
  });
});

/**
 * A resposta de uma sessão que já acabou. O interceptor rejeita com ela; o que
 * se prova aqui é que quem trata erro genérico a deixa passar sem aviso — sem
 * que tela ou store nenhum precise saber que o caso existe.
 */
describe("SessionEndedError — a resposta sem destinatário", () => {
  it("é reconhecida pela marca, e tem a cara de um cancelamento", () => {
    const erro = new SessionEndedError();

    expect(isSessionEnded(erro)).toBe(true);
    expect(erro).toBeInstanceOf(Error);
    expect(erro.code).toBe("ERR_CANCELED");
    expect(isSessionEnded(new Error("qualquer"))).toBe(false);
    expect(isSessionEnded(semResposta("ERR_CANCELED"))).toBe(false);
    expect(isSessionEnded(null)).toBe(false);
  });

  it("não é falha de ninguém: sem frase, sem repetição", () => {
    const r = describeRequestFailure(new SessionEndedError());

    expect(r.kind).toBe("session-ended");
    expect(r.retryable).toBe(false);
    expect(r.message).toBe("");
  });

  it("o ErrorState de quem entrou não ganha a 'falha' de quem saiu", () => {
    expect(
      describeLoadFailure(new SessionEndedError(), "Falha ao carregar extrato."),
    ).toBe("");
  });
});

describe("describeSaveFailure — o erro de quem grava", () => {
  it("o detalhe do servidor vence a frase do domínio", () => {
    expect(
      describeSaveFailure(
        { response: { status: 400, data: { detail: "Nome duplicado." } } },
        "Falha ao criar categoria.",
      ),
    ).toBe("Nome duplicado.");
  });

  it("sem detalhe, vale a leitura da falha de carga", () => {
    expect(describeSaveFailure(new Error("x"), "Falha ao criar categoria.")).toBe(
      "Falha ao criar categoria.",
    );
  });

  it("5xx só mostra o detail quando é ProblemDetail classificado da API", () => {
    // O 503 da sincronização nomeia o banco: é a frase que a pessoa precisa
    expect(
      describeSaveFailure(
        comResposta(503, {}, PROBLEMA_SINCRONIZACAO),
        "Falha ao sincronizar",
      ),
    ).toBe(PROBLEMA_SINCRONIZACAO.detail);
    // Reason phrase em inglês do `erro-interno` nunca chega à tela
    expect(
      describeSaveFailure(
        comResposta(503, {}, {
          type: "https://economize.app/erros/erro-interno",
          detail: "Service Unavailable",
        }),
        "Falha ao sincronizar",
      ),
    ).toBe("Falha ao sincronizar");
    // Corpo sem o `type` da API (proxy, outro serviço) também não
    expect(
      describeSaveFailure(
        comResposta(500, {}, { detail: "java.lang.NullPointerException" }),
        "Falha ao sincronizar",
      ),
    ).toBe("Falha ao sincronizar");
  });

  it("400 e 409 da sincronização mostram o detail da API", () => {
    expect(
      describeSaveFailure(
        comResposta(400, {}, {
          type: "https://economize.app/erros/requisicao-invalida",
          detail:
            "Nenhuma conexão pôde ser sincronizada. Reconecte pelo app: Nubank.",
        }),
        "Falha ao sincronizar",
      ),
    ).toMatch(/Reconecte pelo app: Nubank/);
    expect(
      describeSaveFailure(
        comResposta(409, {}, {
          type: "https://economize.app/erros/conflito",
          detail: "Já existe uma sincronização em andamento. Aguarde ela terminar.",
        }),
        "Falha ao sincronizar",
      ),
    ).toMatch(/em andamento/);
  });

  it("sessão encerrada não tem frase, nem com detalhe pendurado", () => {
    const erro = Object.assign(new SessionEndedError(), {
      response: { status: 400, data: { detail: "De quem saiu." } },
    });
    expect(describeSaveFailure(erro, "Falha ao criar categoria.")).toBe("");
  });
});

describe("summarizeErrorForLog", () => {
  it("leva status, código e mensagem — nunca o token nem o corpo enviado", () => {
    const comSegredo = new AxiosError(
      "Request failed with status code 500",
      "ERR_BAD_RESPONSE",
      {
        ...config,
        headers: new AxiosHeaders({ Authorization: "Bearer segredo.jwt" }),
        data: JSON.stringify({ message: "quanto devo no cartão?" }),
      } as InternalAxiosRequestConfig,
      {},
      {
        status: 500,
        statusText: "x",
        headers: {},
        config,
        data: {},
      },
    );

    const resumo = summarizeErrorForLog(comSegredo);

    expect(resumo).toBe(
      "status=500 code=ERR_BAD_RESPONSE Request failed with status code 500",
    );
    expect(resumo).not.toContain("segredo");
    expect(resumo).not.toContain("cartão");
  });

  it("sem resposta, fica o código; sem nada, uma frase neutra", () => {
    expect(summarizeErrorForLog(semResposta("ECONNABORTED"))).toBe(
      "code=ECONNABORTED Network Error",
    );
    expect(summarizeErrorForLog(undefined)).toBe("erro sem detalhes");
  });

  it("corta mensagem longa: o log não é lugar de texto arbitrário", () => {
    const resumo = summarizeErrorForLog(new Error("x".repeat(500)));
    expect(resumo.length).toBeLessThanOrEqual(121);
  });
});
