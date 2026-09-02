import {
  createFamily,
  createFamilyInvite,
  deleteFamily,
  getFamily,
  getFamilyAnalytics,
  getFamilyTransactions,
  joinFamily,
  removeFamilyMember,
  renameFamily,
  updateFamilySharing,
} from "../../services/api";
import { useFamilyStore } from "../familyStore";

import type {
  FamilyResponse,
  FamilySharing,
  FamilyTransaction,
} from "../../services/api";

jest.mock("../../services/api", () => ({
  getFamily: jest.fn(),
  createFamily: jest.fn(),
  renameFamily: jest.fn(),
  deleteFamily: jest.fn(),
  createFamilyInvite: jest.fn(),
  joinFamily: jest.fn(),
  removeFamilyMember: jest.fn(),
  updateFamilySharing: jest.fn(),
  getFamilyAnalytics: jest.fn(),
  getFamilyTransactions: jest.fn(),
}));

const mock = {
  get: getFamily as jest.MockedFunction<typeof getFamily>,
  create: createFamily as jest.MockedFunction<typeof createFamily>,
  rename: renameFamily as jest.MockedFunction<typeof renameFamily>,
  destroy: deleteFamily as jest.MockedFunction<typeof deleteFamily>,
  invite: createFamilyInvite as jest.MockedFunction<typeof createFamilyInvite>,
  join: joinFamily as jest.MockedFunction<typeof joinFamily>,
  remove: removeFamilyMember as jest.MockedFunction<typeof removeFamilyMember>,
  sharing: updateFamilySharing as jest.MockedFunction<typeof updateFamilySharing>,
  analytics: getFamilyAnalytics as jest.MockedFunction<typeof getFamilyAnalytics>,
  transactions: getFamilyTransactions as jest.MockedFunction<
    typeof getFamilyTransactions
  >,
};

const sharing = (over: Partial<FamilySharing> = {}): FamilySharing =>
  ({
    shareScope: "TOTALS",
    hiddenCategoryIds: [],
    sharedAccountIds: [],
    includeUnassigned: true,
    ...over,
  }) as FamilySharing;

const casa = (over: Partial<FamilyResponse> = {}): FamilyResponse =>
  ({
    id: "g1",
    name: "Casa",
    role: "OWNER",
    members: [
      {
        id: "m1",
        userId: "u1",
        name: "Prova",
        role: "OWNER",
        joinedAt: "2026-09-01T00:00:00Z",
        shareScope: "TOTALS",
        isMe: true,
      },
      {
        id: "m2",
        userId: "u2",
        name: "Parceira",
        role: "MEMBER",
        joinedAt: "2026-09-01T00:00:00Z",
        shareScope: "TOTALS",
        isMe: false,
      },
    ],
    mySharing: sharing(),
    invite: null,
    ...over,
  }) as FamilyResponse;

const linha = (id: string, memberId = "m1"): FamilyTransaction =>
  ({
    id,
    transactionId: `ext-${id}`,
    type: "DEBIT",
    amount: -10,
    description: "Mercado",
    date: "2026-07-10T12:00:00Z",
    categoryId: null,
    accountId: null,
    reviewStatus: "CONFIRMED",
    memberId,
    memberName: "Prova",
  }) as FamilyTransaction;

const MES = { kind: "month", month: "2026-07" } as const;

describe("familyStore (EC-150)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useFamilyStore.getState().reset();
  });

  // ------------------------------------------------------------ o escopo

  it("sem casa, não deixa a tela ir para o escopo da casa", async () => {
    // "Casa" sem casa seria uma tela em branco sem explicação
    useFamilyStore.getState().setScope("family");

    expect(useFamilyStore.getState().scope).toBe("me");
  });

  it("com casa, a troca de escopo vale", async () => {
    mock.get.mockResolvedValue(casa());
    await useFamilyStore.getState().fetchFamily();

    useFamilyStore.getState().setScope("family");

    expect(useFamilyStore.getState().scope).toBe("family");
  });

  // ------------------------------------------------------------- a busca

  it("sem casa o servidor devolve nulo, e isso é ESTADO, não erro", async () => {
    mock.get.mockResolvedValue(null);

    await useFamilyStore.getState().fetchFamily();

    const state = useFamilyStore.getState();
    expect(state.hasFamily).toBe(false);
    expect(state.error).toBeNull();
    expect(state.hasLoadedOnce).toBe(true);
  });

  it("quem perdeu a casa entre duas buscas volta para o escopo pessoal", async () => {
    mock.get.mockResolvedValueOnce(casa());
    await useFamilyStore.getState().fetchFamily();
    useFamilyStore.getState().setScope("family");

    // o dono apagou a casa enquanto a outra pessoa estava com a tela aberta
    mock.get.mockResolvedValueOnce(null);
    await useFamilyStore.getState().fetchFamily();

    expect(useFamilyStore.getState().scope).toBe("me");
  });

  it("busca antiga não sobrescreve a nova", async () => {
    let liberarAntiga: (v: FamilyResponse | null) => void = () => {};
    mock.get.mockImplementationOnce(
      () => new Promise((resolve) => {
        liberarAntiga = resolve;
      }),
    );
    const antiga = useFamilyStore.getState().fetchFamily();

    mock.get.mockResolvedValueOnce(casa({ name: "Casa nova" }));
    await useFamilyStore.getState().fetchFamily();

    liberarAntiga(casa({ name: "Casa velha" }));
    await antiga;

    expect(useFamilyStore.getState().family?.name).toBe("Casa nova");
  });

  it("falha na busca vira mensagem, sem apagar o que já se sabia", async () => {
    mock.get.mockRejectedValue(new Error("offline"));

    await useFamilyStore.getState().fetchFamily();

    expect(useFamilyStore.getState().error).toMatch(/casa/i);
    expect(useFamilyStore.getState().isLoading).toBe(false);
  });

  // ---------------------------------------------------------- criar e sair

  it("criar já deixa a casa carregada, sem segunda busca", async () => {
    mock.create.mockResolvedValue(casa());

    const outcome = await useFamilyStore.getState().create("Casa");

    expect(outcome.ok).toBe(true);
    expect(useFamilyStore.getState().hasFamily).toBe(true);
    expect(useFamilyStore.getState().hasLoadedOnce).toBe(true);
    expect(mock.get).not.toHaveBeenCalled();
  });

  it("renomear atualiza o nome sem perder os membros", async () => {
    mock.create.mockResolvedValue(casa());
    await useFamilyStore.getState().create("Casa");

    mock.rename.mockResolvedValue(casa({ name: "Nosso lar" }));
    const outcome = await useFamilyStore.getState().rename("Nosso lar");

    expect(outcome.ok).toBe(true);
    expect(useFamilyStore.getState().family?.name).toBe("Nosso lar");
    expect(useFamilyStore.getState().family?.members).toHaveLength(2);
  });

  it("apagar a casa desfaz TUDO que dependia dela", async () => {
    mock.create.mockResolvedValue(casa());
    await useFamilyStore.getState().create("Casa");
    useFamilyStore.getState().setScope("family");
    mock.transactions.mockResolvedValue([linha("t1")]);
    await useFamilyStore.getState().fetchTransactions({ range: MES });

    mock.destroy.mockResolvedValue(undefined as never);
    await useFamilyStore.getState().destroy();

    const state = useFamilyStore.getState();
    expect(state.hasFamily).toBe(false);
    // Deixar a Análise em "Casa" sem casa seria tela em branco sem explicação
    expect(state.scope).toBe("me");
    expect(state.transactions).toEqual([]);
    expect(state.analytics).toBeNull();
  });

  it("sair da casa passa pelo próprio membro e desfaz o mesmo tanto", async () => {
    mock.create.mockResolvedValue(casa({ role: "MEMBER" }));
    await useFamilyStore.getState().create("Casa");
    mock.remove.mockResolvedValue(undefined as never);

    const outcome = await useFamilyStore.getState().leave();

    expect(outcome.ok).toBe(true);
    expect(mock.remove).toHaveBeenCalledWith("me");
    expect(useFamilyStore.getState().hasFamily).toBe(false);
  });

  it("falha em qualquer ação devolve mensagem e não mexe no estado", async () => {
    mock.create.mockResolvedValueOnce(casa());
    await useFamilyStore.getState().create("Casa");

    mock.rename.mockRejectedValue(new Error("offline"));
    const outcome = await useFamilyStore.getState().rename("X");

    expect(outcome.ok).toBe(false);
    expect(outcome.message.length).toBeGreaterThan(0);
    expect(useFamilyStore.getState().family?.name).toBe("Casa");
    expect(useFamilyStore.getState().isSaving).toBe(false);
  });

  // -------------------------------------------------------------- convite

  it("emitir convite guarda o código para a tela mostrar", async () => {
    mock.create.mockResolvedValue(casa());
    await useFamilyStore.getState().create("Casa");
    mock.invite.mockResolvedValue({
      code: "NX7QXKS5",
      expiresAt: "2026-09-09T00:00:00Z",
    } as never);

    const outcome = await useFamilyStore.getState().emitInvite();

    expect(outcome.ok).toBe(true);
    expect(useFamilyStore.getState().lastInvite?.code).toBe("NX7QXKS5");
  });

  it("entrar por código já traz a casa inteira", async () => {
    mock.join.mockResolvedValue(casa({ role: "MEMBER" }));

    const outcome = await useFamilyStore.getState().join("NX7QXKS5");

    expect(outcome.ok).toBe(true);
    expect(useFamilyStore.getState().family?.role).toBe("MEMBER");
  });

  // --------------------------------------------------- o que eu compartilho

  it("salvar o compartilhamento espelha na MINHA linha da lista de membros", async () => {
    mock.create.mockResolvedValue(casa());
    await useFamilyStore.getState().create("Casa");
    mock.sharing.mockResolvedValue(sharing({ shareScope: "NONE" }));

    await useFamilyStore.getState().saveSharing(sharing({ shareScope: "NONE" }));

    const state = useFamilyStore.getState();
    expect(state.family?.mySharing.shareScope).toBe("NONE");
    // Sem espelhar, "mostra só totais" ficaria velho na lista até o refetch
    expect(state.family?.members.find((m) => m.isMe)?.shareScope).toBe("NONE");
    // e a linha da outra pessoa não pode ser tocada
    expect(state.family?.members.find((m) => !m.isMe)?.shareScope).toBe("TOTALS");
  });

  // ----------------------------------------------- análise e extrato da casa

  it("o mesmo recorte pedido duas vezes seguidas só vai uma vez à rede", async () => {
    // A montagem e o foco da tela pedem o mesmo período a um quadro de distância
    let liberar: (v: unknown) => void = () => {};
    mock.analytics.mockImplementation(
      () => new Promise((resolve) => {
        liberar = resolve;
      }) as never,
    );

    const primeira = useFamilyStore.getState().fetchAnalytics(MES);
    await useFamilyStore.getState().fetchAnalytics(MES);
    liberar({ window: {}, members: [], combined: null });
    await primeira;

    expect(mock.analytics).toHaveBeenCalledTimes(1);
  });

  it("recorte DIFERENTE sai, mesmo com outro em voo", async () => {
    mock.analytics.mockResolvedValue({
      window: {},
      members: [],
      combined: null,
    } as never);

    await useFamilyStore.getState().fetchAnalytics(MES);
    await useFamilyStore
      .getState()
      .fetchAnalytics({ kind: "window", start: "2026-07-05", end: "2026-08-04" });

    expect(mock.analytics).toHaveBeenCalledTimes(2);
  });

  it("extrato da casa guarda as linhas e marca que já carregou", async () => {
    mock.transactions.mockResolvedValue([linha("t1"), linha("t2", "m2")]);

    await useFamilyStore.getState().fetchTransactions({ range: MES });

    const state = useFamilyStore.getState();
    expect(state.transactions).toHaveLength(2);
    expect(state.hasLoadedTransactionsOnce).toBe(true);
    expect(state.isTransactionsLoading).toBe(false);
  });

  it("filtro por membro entra na chave do pedido em voo", async () => {
    mock.transactions.mockResolvedValue([]);

    await useFamilyStore.getState().fetchTransactions({ range: MES });
    await useFamilyStore.getState().fetchTransactions({ range: MES, memberId: "m2" });

    // Mesmo período, membro diferente: é outro recorte e precisa ir
    expect(mock.transactions).toHaveBeenCalledTimes(2);
  });

  it("falha no extrato da casa é erro só dele", async () => {
    mock.transactions.mockRejectedValue(new Error("offline"));

    await useFamilyStore.getState().fetchTransactions({ range: MES });

    expect(useFamilyStore.getState().transactionsError).toMatch(/extrato/i);
    expect(useFamilyStore.getState().isTransactionsLoading).toBe(false);
  });

  // ----------------------------------------------------------- fim de sessão

  it("reset apaga a casa e invalida o que estava em voo", async () => {
    let liberar: (v: FamilyResponse | null) => void = () => {};
    mock.get.mockImplementationOnce(
      () => new Promise((resolve) => {
        liberar = resolve;
      }),
    );
    const emVoo = useFamilyStore.getState().fetchFamily();

    useFamilyStore.getState().reset();
    // A casa guarda nome e números de OUTRAS pessoas: a conta seguinte não
    // pode ver nada da anterior, nem por uma resposta atrasada
    liberar(casa());
    await emVoo;

    const state = useFamilyStore.getState();
    expect(state.family).toBeNull();
    expect(state.hasFamily).toBe(false);
    expect(state.hasLoadedOnce).toBe(false);
    expect(state.scope).toBe("me");
  });
});
