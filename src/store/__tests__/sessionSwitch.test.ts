// "A sai, B entra: nada de A aparece."
//
// Duas pessoas usam o mesmo aparelho. Este arquivo exercita a troca de conta
// de ponta a ponta — stores de verdade, cliente HTTP de verdade com os
// interceptors de verdade — trocando só o fio: um adaptador do axios que
// responde conforme o token que chegou no cabeçalho. É o token que decide de
// quem é o dado, como no servidor.
//
// O mock do AsyncStorage é global, em jest.setup.js
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AxiosError } from "axios";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";

import api, { isSessionEnded } from "../../services/api";
import {
  PERSONAL_RESETS,
  SESSION_RESETS,
  clearPersonalData,
} from "../sessionReset";
import { useConfirmStore } from "../confirmStore";
import { useAiStore } from "../aiStore";
import { useAuthStore } from "../authStore";
import { useBankStore } from "../bankStore";
import { useCategoriesStore } from "../categoriesStore";
import { useFavoritesStore } from "../favoritesStore";
import { useIndicatorStore } from "../indicatorStore";
import { usePreferencesStore } from "../preferencesStore";
import { useRecurrenceStore } from "../recurrenceStore";
import { useReportsStore } from "../reportsStore";
import { useReviewStore } from "../reviewStore";
import { useToastStore } from "../toastStore";
import { useUserStore } from "../userStore";
import { useWalletStore } from "../walletStore";

/**
 * Um JWT com a cara do que o servidor emite: o `sub` é o e-mail da conta, e
 * é dele que o app tira "quem é esta pessoa". A assinatura não é conferida no
 * cliente.
 */
const jwtFor = (email: string) =>
  `h.${Buffer.from(JSON.stringify({ sub: email })).toString("base64url")}.s`;

const TOK_ANA = jwtFor("ana@casa.dev");
const TOK_BRUNO = jwtFor("bruno@casa.dev");

const TOKENS: Record<string, string> = {
  [`Bearer ${TOK_ANA}`]: "ANA",
  [`Bearer ${TOK_BRUNO}`]: "BRUNO",
};

/** O que o "servidor" devolve para cada rota, já com o nome do dono dentro. */
function bodyFor(url: string, method: string, owner: string): unknown {
  if (url === "/bank-statements") {
    return [{ id: `t-${owner}`, description: `IFOOD DE ${owner}`, amount: -89.9 }];
  }
  if (url === "/wallet/transactions") {
    return [{ id: `w-${owner}`, assetCode: `ATIVO-DE-${owner}`, quantity: 1 }];
  }
  if (url === "/categories") {
    return [{ id: `c-${owner}`, name: `Mesada de ${owner}`, parentId: null }];
  }
  if (url === "/users/me") {
    return { id: `u-${owner}`, name: owner, email: `${owner}@casa.dev` };
  }
  if (url === "/users/me/stats") return { transactions: 1752, owner };
  if (url === "/reports") {
    return { content: [{ id: `r-${owner}`, summary: `Mês de ${owner}` }] };
  }
  if (url === "/transactions/review/count") return { count: 7 };
  if (url === "/recurrences") return [{ id: `s-${owner}`, name: `Aluguel de ${owner}` }];
  if (url === "/chat" && method === "post") {
    return { reply: `Você gastou R$ 89,90 no iFood, ${owner}.` };
  }
  return {};
}

/** Rotas seguradas: a resposta só sai quando o teste soltar. */
const held = new Map<string, Promise<void>>();
function hold(url: string): () => void {
  let release!: () => void;
  held.set(
    url,
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  return () => {
    held.delete(url);
    release();
  };
}

/** Rotas em que o "servidor" tropeça (500), e quantas vezes cada uma foi pedida. */
const failing = new Set<string>();
const hits = new Map<string, string[]>();

/** Tokens que o "servidor" passou a recusar (sessão expirada). */
const expired = new Set<string>();

async function fakeServer(
  config: InternalAxiosRequestConfig,
): Promise<AxiosResponse> {
  const url = config.url ?? "";
  const method = (config.method ?? "get").toLowerCase();
  const authorization = String(config.headers?.Authorization ?? "");

  hits.set(url, [...(hits.get(url) ?? []), authorization]);

  const gate = held.get(url);
  if (gate) await gate;

  if (failing.has(url)) {
    throw new AxiosError("500", "ERR_BAD_RESPONSE", config, null, {
      data: {},
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      config,
    });
  }

  const respond = (data: unknown): AxiosResponse => ({
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config,
  });

  if (url === "/auth/login" || url === "/auth/register") {
    const email = String(JSON.parse(String(config.data)).email);
    const bruno = email.startsWith("bruno");
    return respond({
      token: bruno ? TOK_BRUNO : TOK_ANA,
      name: bruno ? "Bruno" : "Ana",
    });
  }
  if (url === "/auth/login/mfa") {
    return respond({ token: TOK_BRUNO, name: "Bruno" });
  }

  const owner = TOKENS[authorization];
  if (!owner || expired.has(authorization)) {
    throw new AxiosError("401", "ERR_BAD_REQUEST", config, null, {
      data: {},
      status: 401,
      statusText: "Unauthorized",
      headers: {},
      config,
    });
  }
  return respond(bodyFor(url, method, owner));
}

/** Deixa as promessas pendentes (interceptors, `set` dos stores) andarem. */
const settle = async () => {
  for (let i = 0; i < 10; i += 1) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
};

/** Abre o app como alguém e visita as telas que carregam dado de conta. */
async function visitTheScreens() {
  await Promise.all([
    useBankStore.getState().fetchTransactions(),
    useWalletStore.getState().fetchTransactions(),
    useCategoriesStore.getState().fetch(),
    useUserStore.getState().fetchMe(),
    useUserStore.getState().fetchStats(),
    useReportsStore.getState().fetch("MONTHLY"),
    useReviewStore.getState().fetchPendingCount(),
    useRecurrenceStore.getState().fetchSeries(),
  ]);
  await useAiStore.getState().sendMessage("quanto gastei no ifood?");
}

/**
 * Tudo o que o app tem na memória sobre quem está logado, num texto só. É
 * contra ele que se pergunta "sobrou o nome de quem saiu em algum lugar?" —
 * sem depender de o teste lembrar de olhar store por store, que é justamente
 * o erro que este arquivo existe para impedir.
 */
const dump = (names: string[]): string =>
  names
    .map((name) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(`../${name}`) as Record<string, unknown>;
      const hook = Object.entries(mod).find(([key]) =>
        /^use[A-Z].*Store$/.test(key),
      )?.[1] as { getState: () => unknown };
      return JSON.stringify(hook.getState());
    })
    .join("\n");

/** O cache do que é do servidor: extrato, carteira, perfil… */
const everythingInMemory = () => dump(Object.keys(SESSION_RESETS));

/** O que é da pessoa e só existe no aparelho: conversa, favoritos, avisos. */
const everythingPersonal = () => dump(Object.keys(PERSONAL_RESETS));

/** O que foi gravado por último em cada chave do disco. */
function lastWritten(key: string): string | undefined {
  const calls = (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([k]) => k === key,
  );
  return calls.length ? String(calls[calls.length - 1][1]) : undefined;
}

const loginAs = (who: "ana" | "bruno") =>
  useAuthStore.getState().login(`${who}@casa.dev`, "senha");

beforeAll(() => {
  api.defaults.adapter = fakeServer;
});

beforeEach(async () => {
  held.clear();
  expired.clear();
  failing.clear();
  hits.clear();
  useAuthStore.getState().logout();
  // cada teste começa num aparelho que ninguém usou
  clearPersonalData();
  useAuthStore.setState({ lastUserKey: null });
  await settle();
  jest.clearAllMocks();
});

afterEach(() => {
  // o toast de "sessão expirada" arma um timer; sem recolher, ele vaza
  useToastStore.getState().hideToast();
});

describe("A sai, B entra", () => {
  it("sair pelo Perfil: nada de A fica, e B vê o que é dele mesmo dentro do cache de um minuto", async () => {
    await loginAs("ana");
    await visitTheScreens();
    // o cenário só prova alguma coisa se A realmente deixou rastro
    expect(everythingInMemory()).toContain("ANA");
    expect(useBankStore.getState().fetchedAt).not.toBeNull();

    useAuthStore.getState().logout();

    expect(useAuthStore.getState().token).toBeNull();
    expect(everythingInMemory()).not.toContain("ANA");
    expect(useBankStore.getState().fetchedAt).toBeNull();
    expect(useWalletStore.getState().fetchedAt).toBeNull();

    await loginAs("bruno");
    // SEM `force`: é o foco comum da tela, o que respeita a janela de cache.
    // Era aqui que o extrato de A aparecia para B
    await visitTheScreens();

    expect(useBankStore.getState().transactions).toEqual([
      expect.objectContaining({ description: "IFOOD DE BRUNO" }),
    ]);
    expect(useWalletStore.getState().transactions).toEqual([
      expect.objectContaining({ assetCode: "ATIVO-DE-BRUNO" }),
    ]);
    expect(useUserStore.getState().me?.name).toBe("BRUNO");
    expect(everythingInMemory()).not.toContain("ANA");
    expect(everythingPersonal()).not.toContain("ANA");
  });

  it("sessão expirada (401): o interceptor derruba e limpa do mesmo jeito", async () => {
    await loginAs("ana");
    await visitTheScreens();
    expired.add(`Bearer ${TOK_ANA}`);

    // Sem `await`: quem pediu é a sessão que vai morrer, e a resposta dela é
    // abandonada de propósito
    void useBankStore.getState().fetchTransactions(true);
    await settle();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useToastStore.getState().message).toMatch(/sessão expirou/i);
    expect(everythingInMemory()).not.toContain("ANA");
    // o store não ficou travado em "carregando" para quem entrar depois
    expect(useBankStore.getState().isLoading).toBe(false);

    await loginAs("bruno");
    await visitTheScreens();
    expect(useBankStore.getState().transactions).toEqual([
      expect.objectContaining({ description: "IFOOD DE BRUNO" }),
    ]);
    expect(everythingInMemory()).not.toContain("ANA");
  });

  it.each([
    ["login direto", () => loginAs("bruno")],
    [
      "login em dois tempos (completeLogin)",
      async () => useAuthStore.getState().completeLogin(TOK_BRUNO, "Bruno"),
    ],
    [
      "segundo fator",
      () => useAuthStore.getState().submitMfaCode("desafio", "123456"),
    ],
    [
      "cadastro",
      () => useAuthStore.getState().register("Bruno", "bruno@casa.dev", "senha"),
    ],
  ])("troca de conta SEM logout no meio — %s", async (_nome, entrar) => {
    // Não devia acontecer (o Login só existe sem sessão), e por isso mesmo é
    // testado: a entrada não confia que a saída foi feita
    await loginAs("ana");
    await visitTheScreens();

    await entrar();

    expect(useAuthStore.getState().token).toBe(TOK_BRUNO);
    expect(useAuthStore.getState().userName).toBe("Bruno");
    expect(everythingInMemory()).not.toContain("ANA");
    expect(everythingPersonal()).not.toContain("ANA");
    expect(useBankStore.getState().fetchedAt).toBeNull();
  });

  it("login adiado (deferCommit) não mexe em nada até a sessão entrar", async () => {
    await loginAs("ana");
    await visitTheScreens();

    const outcome = await useAuthStore
      .getState()
      .login("bruno@casa.dev", "senha", { deferCommit: true });

    expect(outcome).toEqual({ kind: "session", token: TOK_BRUNO, name: "Bruno" });
    expect(useAuthStore.getState().token).toBe(TOK_ANA);
    expect(everythingInMemory()).toContain("ANA");
  });
});

/**
 * O que só existe NESTE aparelho e é da pessoa: a conversa com o Nino, os
 * favoritos, os avisos derivados da conta. A sessão expira sozinha — apagar
 * isto em toda saída faria a pessoa perder a conversa a cada 401. A regra: só
 * some quando quem entra é OUTRA pessoa.
 */
describe("o que só existe no aparelho", () => {
  /** A deixa o seu rastro local: conversa, favorito, retrato e avisos. */
  async function anaUsaOApp() {
    await loginAs("ana");
    await visitTheScreens();
    useFavoritesStore.getState().toggleFavorite("PETR4-DE-ANA");
    useIndicatorStore.getState().upsertFavoriteSnapshot({
      id: "PETR4-DE-ANA",
      type: "stock",
      code: "PETR4",
      name: "Petrobras PN",
      buy: 38.5,
      sell: null,
      variation: 1.2,
    });
    usePreferencesStore.setState({
      lastPurchaseAdvice: {
        bestDay: "2026-11-12",
        basisLastOccurrence: "2026-10-12",
        seenAt: "DE-ANA",
      },
      mealVoucherPromptDismissedFor: "2026-11-05",
      plusInterestAt: 1,
    });
    await settle();
  }

  const conversa = () => JSON.stringify(useAiStore.getState().messages);

  it("A sai, A volta: a conversa, os favoritos e os avisos estão lá", async () => {
    await anaUsaOApp();

    useAuthStore.getState().logout();
    // o cache do servidor morre na saída mesmo sendo a mesma pessoa
    expect(everythingInMemory()).not.toContain("ANA");
    await loginAs("ana");

    expect(conversa()).toContain("quanto gastei no ifood?");
    expect(conversa()).toContain("ANA");
    expect(useFavoritesStore.getState().favorites).toEqual(["PETR4-DE-ANA"]);
    expect(useIndicatorStore.getState().favoriteSnapshots).toHaveLength(1);
    const prefs = usePreferencesStore.getState();
    expect(prefs.lastPurchaseAdvice?.seenAt).toBe("DE-ANA");
    expect(prefs.mealVoucherPromptDismissedFor).toBe("2026-11-05");
    expect(prefs.plusInterestAt).toBe(1);
    // e o que voltou do servidor é buscado de novo, não reaproveitado
    expect(useBankStore.getState().fetchedAt).toBeNull();
  });

  it("a sessão de A expira (401) e A volta: nada se perdeu", async () => {
    await anaUsaOApp();
    expired.add(`Bearer ${TOK_ANA}`);
    void useBankStore.getState().fetchTransactions(true);
    await settle();
    expect(useAuthStore.getState().token).toBeNull();
    expired.clear();

    await loginAs("ana");

    expect(conversa()).toContain("quanto gastei no ifood?");
    expect(useFavoritesStore.getState().favorites).toEqual(["PETR4-DE-ANA"]);
  });

  it("A sai, B entra: nada de A — nem na memória, nem no disco", async () => {
    await anaUsaOApp();
    expect(lastWritten("@ai_chat_storage")).toContain("ANA");
    expect(lastWritten("@favorites")).toContain("ANA");
    expect(lastWritten("@favorite_snapshots")).toContain("ANA");

    useAuthStore.getState().logout();
    await loginAs("bruno");
    await settle();

    expect(everythingPersonal()).not.toContain("ANA");
    expect(lastWritten("@ai_chat_storage")).not.toContain("ANA");
    expect(lastWritten("@favorites")).not.toContain("ANA");
    expect(lastWritten("@favorite_snapshots")).not.toContain("ANA");
    expect(lastWritten("@preferences_storage")).not.toContain("ANA");
    // B é recebido pela saudação, não por "Histórico limpo" — que contaria a
    // ele que havia um histórico
    expect(useAiStore.getState().messages).toHaveLength(1);
    expect(useAiStore.getState().messages[0].text).toMatch(/^Olá/);
  });

  it("B sai, A volta: vazio — o que era de A foi apagado quando B entrou", async () => {
    await anaUsaOApp();
    useAuthStore.getState().logout();
    await loginAs("bruno");
    await visitTheScreens();
    useAuthStore.getState().logout();

    await loginAs("ana");

    // nem o de A (apagado na entrada de B), nem o de B (apagado agora)
    expect(everythingPersonal()).not.toContain("ANA");
    expect(everythingPersonal()).not.toContain("BRUNO");
    expect(useAiStore.getState().messages).toHaveLength(1);
    expect(useFavoritesStore.getState().favorites).toEqual([]);
  });

  it("o aparelho guarda um resumo de quem saiu, não o e-mail", async () => {
    await loginAs("ana");
    useAuthStore.getState().logout();
    await settle();

    const { lastUserKey } = useAuthStore.getState();
    expect(lastUserKey).toMatch(/^[0-9a-f]+$/);
    expect(lastWritten("@auth_storage")).not.toContain("ana@casa.dev");
    expect(lastWritten("@auth_storage")).not.toContain(TOK_ANA);
  });

  it("token que não diz de quem é conta como OUTRA pessoa", async () => {
    await anaUsaOApp();
    useAuthStore.getState().logout();

    // na dúvida apaga: errar para este lado custa uma conversa; para o outro,
    // mostra a conversa de alguém a quem não devia
    useAuthStore.getState().completeLogin("token-opaco", "Ana");

    expect(everythingPersonal()).not.toContain("ANA");
    expect(useAuthStore.getState().lastUserKey).toBeNull();
  });

  it("sessão gravada por versão anterior: a chave sai do token ao hidratar", async () => {
    // quem atualiza o app logado não tem `lastUserKey` no disco. Sem tirá-la
    // do token, a primeira volta do próprio dono apagaria a conversa dele
    useAuthStore.setState({ token: TOK_ANA, userName: "Ana", lastUserKey: null });
    await useAuthStore.persist.rehydrate();

    const depois = useAuthStore.getState().lastUserKey;
    expect(depois).not.toBeNull();
    useAuthStore.getState().logout();
    await loginAs("ana");
    expect(useAuthStore.getState().lastUserKey).toBe(depois);
  });
});

describe("a resposta que chega depois da saída", () => {
  it("quem esperava recebe uma REJEIÇÃO identificável — não fica esperando para sempre", async () => {
    // O cenário que a promessa pendente travava: A confirma uma exclusão, um
    // 401 em outra requisição derruba a sessão, e a exclusão responde depois.
    // O diálogo espera num `finally`; sem a espera terminar, ficava "ocupado"
    // por cima da tela de login
    await loginAs("ana");
    const soltar = hold("/categories/c-1");
    const exclusao = api.delete("/categories/c-1");
    await settle();
    const showToast = jest.spyOn(useToastStore.getState(), "showToast");

    useAuthStore.getState().logout();
    soltar();

    const erro = await exclusao.then(
      () => null,
      (e: unknown) => e,
    );
    expect(isSessionEnded(erro)).toBe(true);
    // tem a cara de um cancelamento do axios, para quem já ignora cancelamento
    expect(erro).toMatchObject({ code: "ERR_CANCELED", __CANCEL__: true });
    // e não vira aviso, nem repetição, nem um segundo logout
    expect(showToast).not.toHaveBeenCalled();
    expect(hits.get("/categories/c-1")).toHaveLength(1);
    showToast.mockRestore();
  });

  it("o diálogo de confirmação de quem saiu fecha, sem responder por ninguém", async () => {
    await loginAs("ana");
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    useConfirmStore.getState().ask({
      title: "Excluir a categoria Mesada DE ANA?",
      onConfirm,
      onCancel,
    });

    useAuthStore.getState().logout();

    expect(useConfirmStore.getState().request).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("o extrato pedido por A e respondido depois do logout não entra no store", async () => {
    await loginAs("ana");
    const soltar = hold("/bank-statements");
    void useBankStore.getState().fetchTransactions();
    await settle();
    expect(useBankStore.getState().isLoading).toBe(true);

    useAuthStore.getState().logout();
    soltar();
    await settle();

    // Sem a guarda do interceptor a lista de A entrava AQUI, com `fetchedAt`
    // novo — e servia a B pelo minuto seguinte
    expect(useBankStore.getState().transactions).toEqual([]);
    expect(useBankStore.getState().fetchedAt).toBeNull();
    // a rejeição chega ao `catch` do store, e a frase que ele escreve é
    // vazia: nenhum "falha ao carregar extrato" por causa de quem saiu
    expect(useBankStore.getState().error).toBeFalsy();
    expect(useBankStore.getState().isLoading).toBe(false);
    expect(everythingInMemory()).not.toContain("ANA");
  });

  it("a resposta do Nino para A não cai na conversa de B", async () => {
    // o store registra no console a entrega que falhou; aqui é o esperado
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    await loginAs("ana");
    const soltar = hold("/chat");
    void useAiStore.getState().sendMessage("quanto gastei no ifood?");
    await settle();

    useAuthStore.getState().logout();
    await loginAs("bruno");
    soltar();
    await settle();

    expect(useAiStore.getState().messages).toHaveLength(1);
    expect(useAiStore.getState().isLoading).toBe(false);
    expect(everythingPersonal()).not.toContain("ANA");
    erro.mockRestore();
  });

  it("B já entrou e está no meio da própria busca: a de A não atrapalha nem a lista nem o erro", async () => {
    await loginAs("ana");
    const soltar = hold("/bank-statements");
    void useBankStore.getState().fetchTransactions();
    await settle();

    useAuthStore.getState().logout();
    await loginAs("bruno");
    // as duas buscas estão presas na mesma rota; soltam juntas
    const buscaDeBruno = useBankStore.getState().fetchTransactions();
    soltar();
    await buscaDeBruno;
    await settle();

    expect(useBankStore.getState().transactions).toEqual([
      expect.objectContaining({ description: "IFOOD DE BRUNO" }),
    ]);
    // a rejeição da busca de A pode chegar depois do sucesso da de B: o que
    // ela escreve é frase vazia, que tela nenhuma mostra
    expect(useBankStore.getState().error).toBeFalsy();
    expect(useBankStore.getState().isLoading).toBe(false);
  });

  it("o 401 atrasado de A não derruba a sessão de B", async () => {
    await loginAs("ana");
    const soltar = hold("/wallet/transactions");
    void useWalletStore.getState().fetchTransactions();
    await settle();

    useAuthStore.getState().logout();
    await loginAs("bruno");
    jest.clearAllMocks();
    const showToast = jest.spyOn(useToastStore.getState(), "showToast");
    expired.add(`Bearer ${TOK_ANA}`);
    soltar();
    await settle();

    expect(useAuthStore.getState().token).toBe(TOK_BRUNO);
    expect(showToast).not.toHaveBeenCalled();
    expect(useWalletStore.getState().error).toBeFalsy();
    showToast.mockRestore();
  });
});

describe("a repetição automática", () => {
  it("o pedido de A que falhou não é refeito com o token de B", async () => {
    // O interceptor repete um 5xx uma vez, depois de uma pausa. Se a sessão
    // trocar NA pausa, repetir mandaria o pedido de quem saiu com o token de
    // quem entrou — num POST, o lançamento de uma pessoa na conta da outra
    await loginAs("ana");
    failing.add("/wallet/transactions");
    void useWalletStore
      .getState()
      .addTransaction({
        assetCode: "ATIVO-DE-ANA",
        type: "BUY",
        quantity: 1,
        priceAtTransaction: 10,
      })
      .catch(() => {});
    await settle();

    useAuthStore.getState().logout();
    await loginAs("bruno");
    failing.clear();
    // a pausa do interceptor é de um segundo
    await new Promise<void>((resolve) => setTimeout(resolve, 1200));
    await settle();

    expect(hits.get("/wallet/transactions")).toEqual([`Bearer ${TOK_ANA}`]);
    expect(useWalletStore.getState().transactions).toEqual([]);
  });
});

describe("o que é do aparelho fica", () => {
  it("tema, tranca e avisos já vistos sobrevivem até à entrada de outra pessoa", async () => {
    await loginAs("ana");
    usePreferencesStore.setState({
      theme: "light",
      biometricLogin: true,
      biometricChoiceMade: true,
      relockPolicy: "onClose",
      relockAfterMinutes: 15,
      versionNoticeSeenFor: "2.4.0",
      lastSeenVersion: "2.4.0",
      cycleAnchorDay: 12,
      lastPurchaseAdvice: {
        bestDay: "2026-11-12",
        basisLastOccurrence: "2026-10-12",
        seenAt: "2026-11-01",
      },
      mealVoucherPromptDismissedFor: "2026-11-05",
      plusInterestAt: 1,
    });

    useAuthStore.getState().logout();
    await loginAs("bruno");

    const prefs = usePreferencesStore.getState();
    expect(prefs.theme).toBe("light");
    // sair pela tranca para digitar a senha é um `logout()`: a tranca que a
    // pessoa acabou de usar não pode sair desligada disso
    expect(prefs.biometricLogin).toBe(true);
    expect(prefs.biometricChoiceMade).toBe(true);
    expect(prefs.relockPolicy).toBe("onClose");
    expect(prefs.relockAfterMinutes).toBe(15);
    expect(prefs.versionNoticeSeenFor).toBe("2.4.0");
    expect(prefs.lastSeenVersion).toBe("2.4.0");
    expect(prefs.cycleAnchorDay).toBe(12);

    expect(prefs.lastPurchaseAdvice).toBeNull();
    expect(prefs.mealVoucherPromptDismissedFor).toBeNull();
    expect(prefs.plusInterestAt).toBeNull();
  });

  it("o arquivo que chegou pelo 'Abrir com' atravessa a saída e a entrada", async () => {
    await loginAs("ana");
    useBankStore.getState().receberArquivo("content://downloads/extrato.ofx");

    useAuthStore.getState().logout();
    await loginAs("ana");

    expect(useBankStore.getState().arquivoRecebido).toBe(
      "content://downloads/extrato.ofx",
    );
    useBankStore.getState().descartarArquivoRecebido();
  });
});
