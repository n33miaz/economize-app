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

import api from "../../services/api";
import { SESSION_RESETS } from "../sessionReset";
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

const TOKENS: Record<string, string> = {
  "Bearer tok-ana": "ANA",
  "Bearer tok-bruno": "BRUNO",
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
      token: bruno ? "tok-bruno" : "tok-ana",
      name: bruno ? "Bruno" : "Ana",
    });
  }
  if (url === "/auth/login/mfa") {
    return respond({ token: "tok-bruno", name: "Bruno" });
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
async function useTheApp() {
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
function everythingInMemory(): string {
  return Object.keys(SESSION_RESETS)
    .map((name) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require(`../${name}`) as Record<string, unknown>;
      const hook = Object.entries(mod).find(([key]) =>
        /^use[A-Z].*Store$/.test(key),
      )?.[1] as { getState: () => unknown };
      return JSON.stringify(hook.getState());
    })
    .join("\n");
}

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
    await useTheApp();
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
    await useTheApp();

    expect(useBankStore.getState().transactions).toEqual([
      expect.objectContaining({ description: "IFOOD DE BRUNO" }),
    ]);
    expect(useWalletStore.getState().transactions).toEqual([
      expect.objectContaining({ assetCode: "ATIVO-DE-BRUNO" }),
    ]);
    expect(useUserStore.getState().me?.name).toBe("BRUNO");
    expect(everythingInMemory()).not.toContain("ANA");
  });

  it("a conversa com o Nino e os favoritos saem também do DISCO", async () => {
    await loginAs("ana");
    await useTheApp();
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
    await settle();
    expect(lastWritten("@ai_chat_storage")).toContain("ANA");
    expect(lastWritten("@favorites")).toContain("ANA");
    expect(lastWritten("@favorite_snapshots")).toContain("ANA");

    useAuthStore.getState().logout();
    await settle();

    expect(lastWritten("@ai_chat_storage")).not.toContain("ANA");
    expect(lastWritten("@favorites")).not.toContain("ANA");
    expect(lastWritten("@favorite_snapshots")).not.toContain("ANA");
    // e a conta nova é recebida pela saudação, não por "Histórico limpo" —
    // que contaria a ela que havia um histórico
    expect(useAiStore.getState().messages).toHaveLength(1);
    expect(useAiStore.getState().messages[0].text).toMatch(/^Olá/);
  });

  it("sessão expirada (401): o interceptor derruba e limpa do mesmo jeito", async () => {
    await loginAs("ana");
    await useTheApp();
    expired.add("Bearer tok-ana");

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
    await useTheApp();
    expect(useBankStore.getState().transactions).toEqual([
      expect.objectContaining({ description: "IFOOD DE BRUNO" }),
    ]);
    expect(everythingInMemory()).not.toContain("ANA");
  });

  it.each([
    ["login direto", () => loginAs("bruno")],
    [
      "login em dois tempos (completeLogin)",
      async () => useAuthStore.getState().completeLogin("tok-bruno", "Bruno"),
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
    await useTheApp();

    await entrar();

    expect(useAuthStore.getState().token).toBe("tok-bruno");
    expect(useAuthStore.getState().userName).toBe("Bruno");
    expect(everythingInMemory()).not.toContain("ANA");
    expect(useBankStore.getState().fetchedAt).toBeNull();
  });

  it("login adiado (deferCommit) não mexe em nada até a sessão entrar", async () => {
    await loginAs("ana");
    await useTheApp();

    const outcome = await useAuthStore
      .getState()
      .login("bruno@casa.dev", "senha", { deferCommit: true });

    expect(outcome).toEqual({ kind: "session", token: "tok-bruno", name: "Bruno" });
    expect(useAuthStore.getState().token).toBe("tok-ana");
    expect(everythingInMemory()).toContain("ANA");
  });
});

describe("a resposta que chega depois da saída", () => {
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
    expect(useBankStore.getState().error).toBeNull();
    expect(everythingInMemory()).not.toContain("ANA");
  });

  it("a resposta do Nino para A não cai na conversa de B", async () => {
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
    expect(everythingInMemory()).not.toContain("ANA");
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
    expect(useBankStore.getState().error).toBeNull();
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
    expired.add("Bearer tok-ana");
    soltar();
    await settle();

    expect(useAuthStore.getState().token).toBe("tok-bruno");
    expect(showToast).not.toHaveBeenCalled();
    expect(useWalletStore.getState().error).toBeNull();
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

    expect(hits.get("/wallet/transactions")).toEqual(["Bearer tok-ana"]);
    expect(useWalletStore.getState().transactions).toEqual([]);
  });
});

describe("o que é do aparelho fica", () => {
  it("tema, tranca e avisos já vistos sobrevivem; o que saiu da conta, não", async () => {
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
