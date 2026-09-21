import { useAuthStore } from "../authStore";
import {
  PRICE_CACHE_TTL_MS,
  selectHasPendingSync,
  useShoppingStore,
} from "../shoppingStore";

jest.mock("../../services/api", () => ({
  __esModule: true,
  default: {},
  getShoppingTrips: jest.fn(),
  upsertShoppingTrip: jest.fn(),
  reconcileShoppingTrip: jest.fn(),
  getShoppingReconcileCandidates: jest.fn(),
  getShoppingPriceHistory: jest.fn(),
  getShoppingSummary: jest.fn(),
}));

const api = jest.requireMock("../../services/api");

/** O eco que o servidor devolve a um PUT: a mesma compra, consolidada. */
const ecoDo = (corpo: { clientId: string; items: { clientId: string; clientUpdatedAt: string }[] }) => ({
  clientId: corpo.clientId,
  updatedAt: "2099-01-01T00:00:00.000Z",
  items: corpo.items,
});

beforeEach(() => {
  jest.clearAllMocks();
  useShoppingStore.getState().reset();
  useShoppingStore.setState({ hasHydrated: true });
  useAuthStore.setState({ userName: "Neemias" } as never);
  api.upsertShoppingTrip.mockImplementation(async (corpo: never) => ecoDo(corpo));
  api.getShoppingTrips.mockResolvedValue([]);
});

const abrirCompraComItens = () => {
  const store = useShoppingStore.getState();
  const clientId = store.createTrip({ storeName: "Carrefour", budget: 300, shareWithFamily: false });
  store.addItem(clientId, { name: "Arroz", quantity: 1, unitPrice: 24.9, promoNote: null, photoRef: null });
  store.addItem(clientId, { name: "Feijão", quantity: 2, unitPrice: 8.5, promoNote: "leve 2", photoRef: "file:///p.jpg" });
  store.addItem(clientId, { name: "Sabão", quantity: 1, unitPrice: 0, promoNote: null, photoRef: null });
  return clientId;
};

describe("mutações offline", () => {
  it("criar e adicionar não pedem rede: a compra nasce suja e o total é local", () => {
    const clientId = abrirCompraComItens();
    const compra = useShoppingStore.getState().trips.find((t) => t.clientId === clientId)!;

    expect(compra.dirty).toBe(true);
    expect(compra.mine).toBe(true);
    expect(compra.items).toHaveLength(3);
    expect(compra.items[1].promoNote).toBe("leve 2");
    expect(compra.items[2].unitPrice).toBe(0);
    expect(selectHasPendingSync(useShoppingStore.getState())).toBe(true);
    expect(api.upsertShoppingTrip).not.toHaveBeenCalled();
  });

  it("editar, desmarcar e tirar do carrinho mexem no relógio e deixam lápide", () => {
    const clientId = abrirCompraComItens();
    const store = useShoppingStore.getState();
    const [arroz, feijao] = store.trips.find((t) => t.clientId === clientId)!.items;

    store.updateItem(clientId, arroz.clientId, { unitPrice: 19.9, quantity: 3 });
    store.toggleItemChecked(clientId, feijao.clientId);
    store.removeItem(clientId, feijao.clientId);

    const compra = useShoppingStore.getState().trips.find((t) => t.clientId === clientId)!;
    const arrozDepois = compra.items.find((i) => i.clientId === arroz.clientId)!;
    const feijaoDepois = compra.items.find((i) => i.clientId === feijao.clientId)!;
    expect(arrozDepois.unitPrice).toBe(19.9);
    expect(arrozDepois.quantity).toBe(3);
    expect(arrozDepois.clientUpdatedAt >= arroz.clientUpdatedAt).toBe(true);
    // Lápide, não remoção: outro aparelho não pode ressuscitar o item
    expect(feijaoDepois.deleted).toBe(true);
    expect(feijaoDepois.checked).toBe(false);
    expect(compra.items).toHaveLength(3);
  });
});

describe("sync — subir o que está sujo", () => {
  it("faz um PUT por compra suja, sem foto local nem preço zero, e limpa com a resposta", async () => {
    const clientId = abrirCompraComItens();

    const ok = await useShoppingStore.getState().sync();

    expect(ok).toBe(true);
    expect(api.upsertShoppingTrip).toHaveBeenCalledTimes(1);
    const corpo = api.upsertShoppingTrip.mock.calls[0][0];
    expect(corpo.clientId).toBe(clientId);
    expect(corpo.storeName).toBe("Carrefour");
    expect(corpo.budget).toBe(300);
    expect(corpo.items[1].photoRef).toBeNull();
    expect(corpo.items[2].unitPrice).toBeNull();

    const estado = useShoppingStore.getState();
    const compra = estado.trips.find((t) => t.clientId === clientId)!;
    expect(compra.dirty).toBe(false);
    // A foto local continua aqui mesmo com o servidor devolvendo nada
    expect(compra.items[1].photoRef).toBe("file:///p.jpg");
    expect(estado.lastSyncAt).not.toBeNull();
    expect(estado.syncFailed).toBe(false);
  });

  it("sem rede a falha é silenciosa: continua sujo e marcado como falho", async () => {
    abrirCompraComItens();
    api.upsertShoppingTrip.mockRejectedValue(new Error("Network Error"));

    const ok = await useShoppingStore.getState().sync();

    expect(ok).toBe(false);
    const estado = useShoppingStore.getState();
    expect(estado.trips[0].dirty).toBe(true);
    expect(estado.syncFailed).toBe(true);
    expect(estado.isSyncing).toBe(false);
  });

  it("não sobe nada antes de o disco hidratar", async () => {
    abrirCompraComItens();
    useShoppingStore.setState({ hasHydrated: false });

    expect(await useShoppingStore.getState().sync()).toBe(false);
    expect(api.upsertShoppingTrip).not.toHaveBeenCalled();
  });

  it("uma lápide sobe como deleted e some depois que o servidor a viu", async () => {
    const clientId = abrirCompraComItens();
    const store = useShoppingStore.getState();
    const alvo = store.trips[0].items[0];
    store.removeItem(clientId, alvo.clientId);

    await useShoppingStore.getState().sync();

    const corpo = api.upsertShoppingTrip.mock.calls[0][0];
    expect(corpo.items.find((i: { clientId: string }) => i.clientId === alvo.clientId).deleted).toBe(true);
    const compra = useShoppingStore.getState().trips[0];
    expect(compra.items.find((i) => i.clientId === alvo.clientId)).toBeUndefined();
    expect(compra.items).toHaveLength(2);
  });

  it("duas chamadas simultâneas viram uma só", async () => {
    abrirCompraComItens();
    const store = useShoppingStore.getState();

    await Promise.all([store.sync(), store.sync()]);

    expect(api.upsertShoppingTrip).toHaveBeenCalledTimes(1);
  });
});

describe("pull — descer o que a casa mandou", () => {
  it("funde pelo relógio e nunca perde o item local mais novo", async () => {
    const clientId = abrirCompraComItens();
    const local = useShoppingStore.getState().trips[0].items[0];
    api.getShoppingTrips.mockResolvedValue([
      {
        clientId,
        storeName: "Carrefour",
        updatedAt: "2000-01-01T00:00:00.000Z",
        items: [
          { clientId: local.clientId, name: "Arroz velho", clientUpdatedAt: "2000-01-01T00:00:00.000Z" },
          { clientId: "da-casa", name: "Cerveja", quantity: 6, unitPrice: 4, addedByName: "Ana", clientUpdatedAt: "2099-01-01T00:00:00.000Z" },
        ],
      },
      { clientId: "de-ana", storeName: "Dia", ownerName: "Ana", items: [] },
    ]);

    const ok = await useShoppingStore.getState().pull();

    expect(ok).toBe(true);
    const estado = useShoppingStore.getState();
    const compra = estado.trips.find((t) => t.clientId === clientId)!;
    expect(compra.items.find((i) => i.clientId === local.clientId)?.name).toBe("Arroz");
    expect(compra.items.find((i) => i.clientId === "da-casa")?.addedByName).toBe("Ana");
    // Continua suja: o servidor ainda não tem os itens locais
    expect(compra.dirty).toBe(true);
    const deAna = estado.trips.find((t) => t.clientId === "de-ana")!;
    expect(deAna.mine).toBe(false);
    expect(deAna.ownerName).toBe("Ana");
  });

  it("falha do GET marca como falho sem mexer nas compras", async () => {
    abrirCompraComItens();
    api.getShoppingTrips.mockRejectedValue(new Error("Network Error"));

    expect(await useShoppingStore.getState().pull()).toBe(false);
    expect(useShoppingStore.getState().syncFailed).toBe(true);
    expect(useShoppingStore.getState().trips).toHaveLength(1);
  });

  it("syncAll sobe e depois desce", async () => {
    abrirCompraComItens();

    await useShoppingStore.getState().syncAll();

    expect(api.upsertShoppingTrip).toHaveBeenCalledTimes(1);
    expect(api.getShoppingTrips).toHaveBeenCalledTimes(1);
    expect(useShoppingStore.getState().trips[0].dirty).toBe(false);
  });
});

describe("fechar e conciliar", () => {
  it("fechar grava status, data e total da nota, e tenta subir na hora", async () => {
    const clientId = abrirCompraComItens();

    await useShoppingStore.getState().closeTrip(clientId, 45.9);

    const compra = useShoppingStore.getState().trips[0];
    expect(compra.status).toBe("CLOSED");
    expect(compra.closedAt).not.toBeNull();
    expect(compra.receiptTotal).toBe(45.9);
    expect(api.upsertShoppingTrip).toHaveBeenCalledTimes(1);
    expect(api.upsertShoppingTrip.mock.calls[0][0].status).toBe("CLOSED");
  });

  it("os candidatos só são pedidos depois de a compra subir", async () => {
    const clientId = abrirCompraComItens();
    api.getShoppingReconcileCandidates.mockResolvedValue([{ id: "tx", description: "CARREFOUR", amount: -41.9, date: "2026-09-21", accountId: null }]);

    const candidatos = await useShoppingStore.getState().fetchReconcileCandidates(clientId);

    expect(api.upsertShoppingTrip).toHaveBeenCalledTimes(1);
    expect(candidatos).toHaveLength(1);
  });

  it("sem rede não há candidatos — e não há erro", async () => {
    const clientId = abrirCompraComItens();
    api.upsertShoppingTrip.mockRejectedValue(new Error("Network Error"));

    expect(await useShoppingStore.getState().fetchReconcileCandidates(clientId)).toEqual([]);
    expect(api.getShoppingReconcileCandidates).not.toHaveBeenCalled();
  });

  it("conciliar marca a compra e guarda o lançamento", async () => {
    const clientId = abrirCompraComItens();
    api.reconcileShoppingTrip.mockResolvedValue({ clientId, status: "RECONCILED", reconciledTransactionId: "tx" });

    const resultado = await useShoppingStore.getState().reconcile(clientId, "tx");

    expect(resultado.ok).toBe(true);
    const compra = useShoppingStore.getState().trips[0];
    expect(compra.status).toBe("RECONCILED");
    expect(compra.transactionId).toBe("tx");
  });

  it("conciliar com falha devolve a frase e não mexe na compra", async () => {
    const clientId = abrirCompraComItens();
    api.reconcileShoppingTrip.mockRejectedValue({ response: { status: 403 }, isAxiosError: true });

    const resultado = await useShoppingStore.getState().reconcile(clientId, "tx");

    expect(resultado.ok).toBe(false);
    expect(resultado.message.length).toBeGreaterThan(0);
    expect(useShoppingStore.getState().trips[0].status).toBe("OPEN");
  });
});

describe("preço de outras vezes", () => {
  it("pergunta ao servidor uma vez, guarda no cache e respeita o prazo", async () => {
    api.getShoppingPriceHistory.mockResolvedValue({
      history: [],
      summary: { lastPrice: 5.49, lastStore: "Dia", lastDate: "2026-09-10", minPrice: 4.99, maxPrice: 5.49, avgPrice: 5.2, occurrences: 2 },
    });

    const primeiro = await useShoppingStore.getState().lookupPrice("Leite");
    const segundo = await useShoppingStore.getState().lookupPrice("  LEITE ");

    expect(primeiro?.lastPrice).toBe(5.49);
    expect(segundo?.lastPrice).toBe(5.49);
    expect(api.getShoppingPriceHistory).toHaveBeenCalledTimes(1);
    expect(api.getShoppingPriceHistory).toHaveBeenCalledWith({ name: "leite" });

    // Vencido o prazo, pergunta de novo
    useShoppingStore.setState((s) => ({
      priceCache: { leite: { ...s.priceCache.leite, fetchedAt: Date.now() - PRICE_CACHE_TTL_MS - 1 } },
    }));
    await useShoppingStore.getState().lookupPrice("Leite");
    expect(api.getShoppingPriceHistory).toHaveBeenCalledTimes(2);
  });

  it("sem rede responde com as compras do aparelho", async () => {
    api.getShoppingPriceHistory.mockRejectedValue(new Error("Network Error"));
    const store = useShoppingStore.getState();
    const antiga = store.createTrip({ storeName: "Dia", budget: null, shareWithFamily: false });
    store.addItem(antiga, { name: "Leite", quantity: 1, unitPrice: 4.79, promoNote: null, photoRef: null });
    const atual = store.createTrip({ storeName: "Carrefour", budget: null, shareWithFamily: false });

    const resumo = await useShoppingStore.getState().lookupPrice("leite", atual);

    expect(resumo?.lastPrice).toBe(4.79);
    expect(resumo?.lastStore).toBe("Dia");
    expect(useShoppingStore.getState().priceSummaryFor("Leite", atual)?.lastPrice).toBe(4.79);
    expect(useShoppingStore.getState().priceSummaryFor("Pão")).toBeNull();
  });
});

describe("fim de sessão", () => {
  it("reset apaga compras, cache e marcas — o carrinho é da conta", () => {
    abrirCompraComItens();
    useShoppingStore.setState({ lastSyncAt: 1, syncFailed: true, priceCache: { x: { summary: null, fetchedAt: 1 } } });

    useShoppingStore.getState().reset();

    const estado = useShoppingStore.getState();
    expect(estado.trips).toEqual([]);
    expect(estado.priceCache).toEqual({});
    expect(estado.lastSyncAt).toBeNull();
    expect(estado.syncFailed).toBe(false);
  });

  it("o logout zera o carrinho como zera os outros stores por conta", () => {
    abrirCompraComItens();

    useAuthStore.getState().logout();

    expect(useShoppingStore.getState().trips).toEqual([]);
  });
});
