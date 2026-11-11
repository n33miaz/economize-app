// O teste de guarda da limpeza de sessão.
//
// A pergunta que ele responde: "se alguém criar um store novo com dado de
// usuário, ou um campo novo num store que já existe, e esquecer do logout, o
// que quebra?" Antes: nada. O extrato ficou fora do `logout()` sem que teste
// nenhum reclamasse, e duas pessoas usam o mesmo aparelho.
//
// São três redes, uma por tamanho de esquecimento:
//  1. o ARQUIVO — todo store de `src/store` tem de estar classificado;
//  2. o CAMPO de store limpo — volta ao estado inicial, ou está na lista de
//     quem fica de propósito;
//  3. o CAMPO de store "do aparelho" — está numa lista fechada. Um store que
//     nasceu só com estado de tela e ganha um campo com dado de alguém não
//     passa sem que uma pessoa olhe.
import fs from "fs";
import path from "path";

import {
  DEVICE_STORES,
  PERSONAL_RESETS,
  SESSION_RESETS,
  clearPersonalData,
  clearSessionData,
} from "../sessionReset";

const STORE_DIR = path.join(__dirname, "..");

const storeFiles = fs
  .readdirSync(STORE_DIR)
  .filter((file) => /\.tsx?$/.test(file))
  .map((file) => file.replace(/\.tsx?$/, ""))
  .sort();

/**
 * Os campos que SOBREVIVEM à limpeza, por store, e o porquê de cada grupo.
 * Um campo novo que não volte ao inicial e não esteja aqui quebra o teste — e
 * um campo listado aqui que passe a ser limpo também, para a lista não mentir.
 */
const KEPT_ON_DEVICE: Record<string, string[]> = {
  // O arquivo que o Android entregou ("Abrir com") atravessa a tela de login
  bankStore: ["arquivoRecebido"],
  // Cotação pública e filtros de lista; só os retratos dos favoritos caem
  indicatorStore: ["indicators", "loading", "error", "lastFetched", "filters"],
  // Quando o APP abriu ("uma oferta por sessão"): sair da conta não reabre o app
  planStore: ["sessionStartedAt"],
  // Preferências do APARELHO. O que é derivado da conta não está aqui
  preferencesStore: [
    "theme",
    "biometricLogin",
    "biometricChoiceMade",
    "relockPolicy",
    "relockAfterMinutes",
    "defaultCurrency",
    "hideBalance",
    "language",
    "notificationsEnabled",
    "lastSeenVersion",
    "newsRegion",
    "newsCategory",
    "viewDepth",
    "cycleAnchorDay",
    "potAnnouncementSeen",
    "versionNoticeSeenFor",
    "sessionCount",
    "plusOfferLastShownAt",
    "dismissedHints",
    "hasHydrated",
  ],
  // Se o disco já foi lido: fato do processo, não da conta
  shoppingStore: ["hasHydrated"],
  // A cor do último aviso: sem texto, não diz nada de ninguém
  toastStore: ["type"],
};

/**
 * Os campos de dado de cada store "do aparelho" — lista FECHADA.
 *
 * Falhou aqui? Um destes stores ganhou (ou perdeu) um campo. Se o campo novo
 * guarda qualquer coisa de quem está logado, o store deixou de ser "do
 * aparelho": dê a ele um `reset()` e mude-o de tabela em `sessionReset`. Se é
 * mesmo estado de tela, acrescente o nome aqui — a linha no diff é a prova de
 * que alguém decidiu.
 */
const DEVICE_STORE_FIELDS: Record<string, string[]> = {
  // `token` e `userName` são a sessão, e é o `logout()` que os apaga;
  // `lastUserKey` é um resumo (não o e-mail) e sobrevive de propósito
  authStore: [
    "token",
    "userName",
    "isLoading",
    "error",
    "hasHydrated",
    "lastUserKey",
  ],
  overlayStore: ["layers", "hostMounted"],
  serverStore: ["isWaking", "waitedSeconds"],
  tabBarStore: ["escondida", "ultimoY"],
  versionStore: [
    "status",
    "info",
    "checkedAt",
    "refusedByServer",
    "bannerDismissed",
  ],
};

type AnyStore = {
  getState: () => Record<string, unknown>;
  setState: (partial: Record<string, unknown>) => void;
};

/** O hook `useXStore` exportado pelo módulo — um por arquivo, por convenção. */
function storeOf(name: string): AnyStore {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(`../${name}`) as Record<string, unknown>;
  const hooks = Object.entries(mod).filter(
    ([key, value]) =>
      /^use[A-Z].*Store$/.test(key) &&
      typeof (value as AnyStore | undefined)?.getState === "function",
  );
  if (hooks.length !== 1) {
    throw new Error(
      `${name}: esperava um hook de store exportado, achei ${hooks.length}`,
    );
  }
  return hooks[0][1] as AnyStore;
}

const dataKeys = (state: Record<string, unknown>) =>
  Object.keys(state).filter((key) => typeof state[key] !== "function");

/**
 * Sujeira no formato do campo: a mesma FORMA do valor inicial, para o reset
 * do store poder ler o próprio estado sem estourar, mas com conteúdo que não é
 * o inicial.
 */
function dirty(initial: unknown): unknown {
  if (typeof initial === "boolean") return !initial;
  if (typeof initial === "number") return initial + 4242;
  if (typeof initial === "string") return `${initial}-de-quem-saiu`;
  if (Array.isArray(initial)) return [...initial, { id: "de-quem-saiu" }];
  if (initial instanceof Map) return new Map([["de-quem-saiu", {}]]);
  if (initial && typeof initial === "object") {
    return { ...initial, "de-quem-saiu": { id: "de-quem-saiu" } };
  }
  // null/undefined: qualquer coisa serve, e um objeto cobre "dado carregado"
  return { id: "de-quem-saiu" };
}

describe("todo store está classificado", () => {
  it.each(storeFiles)("%s está em exatamente UMA das três tabelas", (name) => {
    const tabelas = [
      name in SESSION_RESETS && "SESSION_RESETS",
      name in PERSONAL_RESETS && "PERSONAL_RESETS",
      name in DEVICE_STORES && "DEVICE_STORES",
    ].filter(Boolean);
    // Falhou com lista vazia? Você criou um store. Se ele guarda cache do
    // servidor, dê a ele um `reset()` e uma linha em SESSION_RESETS; se guarda
    // algo da pessoa que só existe no aparelho, PERSONAL_RESETS; se é estado
    // de tela ou do aparelho, DEVICE_STORES com o porquê
    expect(tabelas).toHaveLength(1);
  });

  it("o manifesto não cita store que não existe", () => {
    const listed = [
      ...Object.keys(SESSION_RESETS),
      ...Object.keys(PERSONAL_RESETS),
      ...Object.keys(DEVICE_STORES),
    ].sort();
    expect(listed).toEqual(storeFiles);
  });

  it("quem fica tem motivo escrito", () => {
    for (const reason of Object.values(DEVICE_STORES)) {
      expect(reason.trim().length).toBeGreaterThan(10);
    }
  });
});

describe("store do aparelho tem a lista de campos fechada", () => {
  // `sessionReset` é o manifesto, não um store: não tem estado
  const names = Object.keys(DEVICE_STORES).filter((n) => n !== "sessionReset");

  it("a lista de campos cobre exatamente os stores do aparelho", () => {
    expect(Object.keys(DEVICE_STORE_FIELDS).sort()).toEqual(names.sort());
  });

  it.each(names)("%s", (name) => {
    expect(dataKeys(storeOf(name).getState()).sort()).toEqual(
      [...DEVICE_STORE_FIELDS[name]].sort(),
    );
  });
});

describe("todo campo de dado volta ao inicial", () => {
  const names = [
    ...Object.keys(SESSION_RESETS),
    ...Object.keys(PERSONAL_RESETS),
  ];
  const stores = Object.fromEntries(names.map((name) => [name, storeOf(name)]));
  // Fotografia ANTES de qualquer sujeira: é contra ela que a limpeza é medida
  const initial = Object.fromEntries(
    names.map((name) => {
      const state = stores[name].getState();
      return [
        name,
        Object.fromEntries(dataKeys(state).map((key) => [key, state[key]])),
      ];
    }),
  );

  const sujar = () => {
    for (const name of names) {
      stores[name].setState(
        Object.fromEntries(
          Object.entries(initial[name]).map(([key, value]) => [
            key,
            dirty(value),
          ]),
        ),
      );
    }
  };

  /** Os campos que não voltaram ao inicial, e os que voltaram. */
  const medir = (name: string) => {
    const state = stores[name].getState();
    const sujos: string[] = [];
    const limpos: string[] = [];
    for (const key of Object.keys(initial[name])) {
      try {
        expect(state[key]).toEqual(initial[name][key]);
        limpos.push(key);
      } catch {
        sujos.push(key);
      }
    }
    return { sujos, limpos };
  };

  describe("depois da saída e da entrada de OUTRA pessoa", () => {
    beforeAll(() => {
      sujar();
      clearSessionData();
      clearPersonalData();
    });

    it.each(names)("%s", (name) => {
      const kept = KEPT_ON_DEVICE[name] ?? [];
      const { sujos, limpos } = medir(name);

      // `sobrou`: campo com dado de quem saiu que o reset não apagou. Ou o
      // reset do store esqueceu dele, ou ele é do aparelho e entra em
      // KEPT_ON_DEVICE com o porquê.
      // `limpoSemPrecisar`: a lista diz que fica e ele foi apagado.
      expect({
        sobrou: sujos.filter((key) => !kept.includes(key)),
        limpoSemPrecisar: limpos.filter((key) => kept.includes(key)),
      }).toEqual({ sobrou: [], limpoSemPrecisar: [] });
    });
  });

  describe("só a saída", () => {
    beforeAll(() => {
      sujar();
      clearSessionData();
    });

    afterAll(() => {
      clearPersonalData();
    });

    it.each(Object.keys(PERSONAL_RESETS))(
      "%s não é tocado: é da pessoa e espera a volta dela",
      (name) => {
        expect(medir(name).limpos).toEqual([]);
      },
    );

    it("o aviso na tela some na saída e fica na entrada", () => {
      // na entrada o Login acabou de mostrar "biometria ativada"
      stores.toastStore.setState({ visible: true, message: "Biometria ativada." });
      clearSessionData("entry");
      expect(stores.toastStore.getState().message).toBe("Biometria ativada.");

      clearSessionData("exit");
      expect(stores.toastStore.getState().visible).toBe(false);
      expect(stores.toastStore.getState().message).toBe("");
    });
  });

  it("uma limpeza que estoura não impede as outras", () => {
    const erro = jest.spyOn(console, "error").mockImplementation(() => {});
    const bank = stores.bankStore;
    const wallet = stores.walletStore;
    const resetOriginal = bank.getState().reset;
    bank.setState({
      reset: () => {
        throw new Error("quebrou");
      },
    });
    wallet.setState({ transactions: [{ id: "de-quem-saiu" }], fetchedAt: 1 });

    expect(() => clearSessionData()).not.toThrow();

    // bankStore vem antes de walletStore no manifesto: a carteira só está
    // limpa se o laço seguiu depois do estouro
    expect(wallet.getState().transactions).toEqual([]);
    expect(wallet.getState().fetchedAt).toBeNull();
    expect(erro).toHaveBeenCalled();

    bank.setState({ reset: resetOriginal });
    erro.mockRestore();
  });
});

/**
 * A limpeza que chega ANTES de o store terminar de ler o disco.
 *
 * O store persistido começa a hidratar quando o módulo é carregado, e a
 * leitura é assíncrona. Aqui a limpeza é justamente quem carrega o módulo (o
 * `require` tardio do manifesto), com o disco ainda cheio do que a pessoa
 * anterior deixou: sem a segunda passada no fim da hidratação, a leitura
 * chegava depois do `reset` e repunha tudo.
 */
describe("limpeza com o store ainda não hidratado", () => {
  type Storage = { getItem: jest.Mock; setItem: jest.Mock };

  /** Sobe módulos novos com o disco preso: `entregar` solta a leitura. */
  function comDiscoPreso(key: string, saved: unknown) {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const storage = require("@react-native-async-storage/async-storage") as Storage;
    let entregar!: () => void;
    storage.getItem.mockImplementation((asked: string) =>
      asked === key
        ? new Promise<string>((resolve) => {
            entregar = () =>
              resolve(JSON.stringify({ state: saved, version: 0 }));
          })
        : Promise.resolve(null),
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const manifest = require("../sessionReset") as typeof import("../sessionReset");
    const ultimoGravado = () => {
      const calls = storage.setItem.mock.calls.filter(([k]) => k === key);
      return String(calls[calls.length - 1]?.[1]);
    };
    return { manifest, entregar: () => entregar(), ultimoGravado };
  }

  const assentar = async () => {
    for (let i = 0; i < 10; i += 1) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
  };

  it("a conversa de quem saiu não volta do disco depois do reset", async () => {
    const { manifest, entregar, ultimoGravado } = comDiscoPreso(
      "@ai_chat_storage",
      {
        messages: [
          { id: "m1", text: "gastei 89,90 — DE-ANA", isUser: true, timestamp: 1 },
        ],
      },
    );

    manifest.clearPersonalData();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAiStore } = require("../aiStore") as typeof import("../aiStore");
    // o cenário só vale se a limpeza realmente chegou antes da leitura
    expect(useAiStore.persist.hasHydrated()).toBe(false);

    entregar();
    await assentar();

    expect(useAiStore.persist.hasHydrated()).toBe(true);
    expect(JSON.stringify(useAiStore.getState().messages)).not.toContain("DE-ANA");
    expect(ultimoGravado()).not.toContain("DE-ANA");
  });

  it("o carrinho de quem saiu também não (cache de sessão)", async () => {
    const { manifest, entregar, ultimoGravado } = comDiscoPreso(
      "@shopping_storage",
      {
        trips: [{ clientId: "c1", storeName: "Mercado DE-ANA", items: [] }],
        priceCache: {},
        lastSyncAt: 1,
        syncFailed: false,
      },
    );

    manifest.clearSessionData();
    const { useShoppingStore } =
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("../shoppingStore") as typeof import("../shoppingStore");
    expect(useShoppingStore.persist.hasHydrated()).toBe(false);

    entregar();
    await assentar();

    expect(useShoppingStore.getState().trips).toEqual([]);
    expect(ultimoGravado()).not.toContain("DE-ANA");
  });

  it("sem limpeza pendente, a hidratação repõe o disco normalmente", async () => {
    // a outra metade: a segunda passada não pode virar "todo store nasce vazio"
    const { entregar } = comDiscoPreso("@ai_chat_storage", {
      messages: [{ id: "m1", text: "DE-ANA", isUser: true, timestamp: 1 }],
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useAiStore } = require("../aiStore") as typeof import("../aiStore");

    entregar();
    await assentar();

    expect(JSON.stringify(useAiStore.getState().messages)).toContain("DE-ANA");
  });
});
