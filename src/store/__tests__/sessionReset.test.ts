// O teste de guarda da limpeza de sessão.
//
// A pergunta que ele responde: "se alguém criar um store novo com dado de
// usuário, ou um campo novo num store que já existe, e esquecer do logout, o
// que quebra?" Antes: nada. O extrato ficou fora do `logout()` sem que teste
// nenhum reclamasse, e duas pessoas usam o mesmo aparelho.
//
// São duas redes, uma por tamanho de esquecimento:
//  1. o ARQUIVO — todo store de `src/store` tem de estar classificado;
//  2. o CAMPO — todo campo de dado de um store limpo volta ao estado inicial,
//     ou está na lista de quem fica de propósito.
import fs from "fs";
import path from "path";

import {
  DEVICE_STORES,
  SESSION_RESETS,
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
  it.each(storeFiles)("%s é limpo no fim da sessão OU fica, com motivo", (name) => {
    const cleared = name in SESSION_RESETS;
    const kept = name in DEVICE_STORES;
    // Falhou aqui? Você criou um store. Se ele guarda qualquer coisa de quem
    // está logado, dê a ele um `reset()` e uma linha em SESSION_RESETS; se é
    // estado de tela ou do aparelho, uma linha em DEVICE_STORES dizendo por quê
    expect({ name, cleared, kept }).toEqual({
      name,
      cleared: !kept,
      kept: !cleared,
    });
    expect(cleared || kept).toBe(true);
  });

  it("o manifesto não cita store que não existe", () => {
    const listed = [
      ...Object.keys(SESSION_RESETS),
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

describe("todo campo de dado volta ao inicial", () => {
  const names = Object.keys(SESSION_RESETS);
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

  beforeAll(() => {
    for (const name of names) {
      const sujeira = Object.fromEntries(
        Object.entries(initial[name]).map(([key, value]) => [key, dirty(value)]),
      );
      stores[name].setState(sujeira);
    }
    clearSessionData();
  });

  it.each(names)("%s", (name) => {
    const kept = KEPT_ON_DEVICE[name] ?? [];
    const state = stores[name].getState();
    const sobrou: string[] = [];
    const limpoSemPrecisar: string[] = [];

    for (const key of Object.keys(initial[name])) {
      const voltou = (() => {
        try {
          expect(state[key]).toEqual(initial[name][key]);
          return true;
        } catch {
          return false;
        }
      })();
      if (!voltou && !kept.includes(key)) sobrou.push(key);
      if (voltou && kept.includes(key)) limpoSemPrecisar.push(key);
    }

    // `sobrou`: campo com dado de quem saiu que o reset não apagou. Ou o
    // reset do store esqueceu dele, ou ele é do aparelho e entra em
    // KEPT_ON_DEVICE com o porquê.
    // `limpoSemPrecisar`: a lista diz que fica e ele foi apagado.
    expect({ sobrou, limpoSemPrecisar }).toEqual({
      sobrou: [],
      limpoSemPrecisar: [],
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
