import { tripTotal, tripUncheckedCount } from "../../utils/shopping";
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

describe("a lista de compras", () => {
  const compraComLista = () => {
    const store = useShoppingStore.getState();
    const clientId = store.createTrip({
      storeName: "Carrefour",
      budget: null,
      shareWithFamily: false,
    });
    store.addListItems(clientId, ["Arroz", "Feijão", "Café"]);
    return clientId;
  };

  const compraDe = (clientId: string) =>
    useShoppingStore.getState().trips.find((t) => t.clientId === clientId)!;

  it("a lista nasce desmarcada, sem preço e sem custar nada", () => {
    const clientId = compraComLista();
    const compra = compraDe(clientId);

    expect(compra.items).toHaveLength(3);
    expect(compra.items.every((i) => !i.checked)).toBe(true);
    // item desmarcado é "não peguei": ele não pode entrar no total nem na
    // barra de orçamento só por estar escrito
    expect(tripTotal(compra)).toBe(0);
    expect(tripUncheckedCount(compra)).toBe(3);
  });

  it("anotar no corredor DÁ CHECK no item da lista, sem duplicar a linha", () => {
    const clientId = compraComLista();
    const antes = compraDe(clientId).items.find((i) => i.name === "Café")!;

    const id = useShoppingStore.getState().addItem(clientId, {
      name: "café",
      quantity: 2,
      unitPrice: 19.9,
      promoNote: "leve 2",
      photoRef: "file:///etiqueta.jpg",
    });

    const compra = compraDe(clientId);
    // é o MESMO item: uma segunda linha faria a pessoa achar que ainda falta
    // pegar o que já está no carrinho — o oposto do que a lista serve
    expect(id).toBe(antes.clientId);
    expect(compra.items).toHaveLength(3);
    const cafe = compra.items.find((i) => i.clientId === antes.clientId)!;
    expect(cafe.checked).toBe(true);
    expect(cafe.quantity).toBe(2);
    expect(cafe.unitPrice).toBe(19.9);
    expect(cafe.promoNote).toBe("leve 2");
    expect(cafe.photoRef).toBe("file:///etiqueta.jpg");
    // quem está com o produto na mão leu a embalagem; quem escreveu a lista, não
    expect(cafe.name).toBe("café");
    expect(tripUncheckedCount(compra)).toBe(2);
  });

  it("continuar escrevendo a lista não marca nada", () => {
    const clientId = compraComLista();

    useShoppingStore.getState().addListItems(clientId, ["arroz", "Macarrão"]);

    const compra = compraDe(clientId);
    // "arroz" já estava: não entra de novo nem vira pego
    expect(compra.items).toHaveLength(4);
    expect(tripUncheckedCount(compra)).toBe(4);
  });

  it("produto fora da lista entra como linha nova, já no carrinho", () => {
    const clientId = compraComLista();

    useShoppingStore.getState().addItem(clientId, {
      name: "Chocolate",
      quantity: 1,
      unitPrice: 12,
      promoNote: null,
      photoRef: null,
    });

    const compra = compraDe(clientId);
    expect(compra.items).toHaveLength(4);
    expect(compra.items.find((i) => i.name === "Chocolate")!.checked).toBe(true);
    expect(tripUncheckedCount(compra)).toBe(3);
  });

  it("o segundo pacote do mesmo produto vira linha própria", () => {
    const clientId = compraComLista();
    const store = useShoppingStore.getState();
    store.addItem(clientId, { name: "Arroz", quantity: 1, unitPrice: 24.9, promoNote: null, photoRef: null });

    store.addItem(clientId, { name: "Arroz", quantity: 1, unitPrice: 31.5, promoNote: null, photoRef: null });

    const compra = compraDe(clientId);
    // o primeiro cumpriu a lista; o segundo não tem mais o que cumprir e não
    // pode sobrescrever o preço do que já está no carrinho
    expect(compra.items.filter((i) => i.name === "Arroz")).toHaveLength(2);
  });

  it("escrever a lista deixa a compra suja para sincronizar com a casa", () => {
    const clientId = compraComLista();

    // a lista é do mesmo tipo do item, então ela sobe no mesmo PUT — nenhuma
    // rota nova precisou existir para a casa ver o que falta pegar
    expect(compraDe(clientId).dirty).toBe(true);
  });

  it("pedido vazio não suja a compra à toa", () => {
    const clientId = compraComLista();
    useShoppingStore.setState({
      trips: useShoppingStore.getState().trips.map((t) => ({ ...t, dirty: false })),
    });

    const quantos = useShoppingStore.getState().addListItems(clientId, ["arroz"]);

    expect(quantos).toBe(0);
    expect(compraDe(clientId).dirty).toBe(false);
  });

  it("compra que não existe não quebra nem inventa", () => {
    expect(useShoppingStore.getState().addListItems("nao-existe", ["Arroz"])).toBe(0);
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

  it("compra que ainda não subiu é enviada ANTES de conciliar", async () => {
    // O servidor só concilia o que ele conhece; sem isto a compra criada
    // pelo extrato levava "não encontrada" na cara
    const clientId = abrirCompraComItens();
    api.reconcileShoppingTrip.mockResolvedValue({ clientId, status: "RECONCILED" });

    await useShoppingStore.getState().reconcile(clientId, "tx");

    expect(api.upsertShoppingTrip).toHaveBeenCalled();
  });
});

describe("anexar a nota partindo do extrato", () => {
  const LANCAMENTO = {
    transactionId: "tx-600",
    storeName: "FLASH APP",
    amount: -600,
    date: "2026-09-20T12:00:00.000Z",
    receiptKey: "35260912345678000195650010001234561123456788",
  };

  it("cria a compra do dia do lançamento, com o valor do banco e a nota, e liga", async () => {
    api.reconcileShoppingTrip.mockImplementation(async (clientId: string) => ({
      clientId,
      status: "RECONCILED",
    }));

    const resultado = await useShoppingStore
      .getState()
      .attachReceiptToTransaction(LANCAMENTO);

    expect(resultado.ok).toBe(true);
    const compra = useShoppingStore.getState().trips[0];
    expect(compra.storeName).toBe("FLASH APP");
    expect(compra.receiptTotal).toBe(600);
    expect(compra.receiptKey).toBe(LANCAMENTO.receiptKey);
    // A data é a da ida ao mercado, não a de agora
    expect(compra.startedAt).toBe(LANCAMENTO.date);
    expect(compra.closedAt).toBe(LANCAMENTO.date);
    expect(compra.status).toBe("RECONCILED");
    expect(api.reconcileShoppingTrip).toHaveBeenCalledWith(resultado.clientId, "tx-600");
  });

  it("sem rede a nota fica guardada no aparelho — e diz isso, sem inventar sucesso", async () => {
    api.upsertShoppingTrip.mockRejectedValue(new Error("Network Error"));

    const resultado = await useShoppingStore
      .getState()
      .attachReceiptToTransaction(LANCAMENTO);

    expect(resultado.ok).toBe(false);
    expect(resultado.message).toMatch(/internet/i);
    expect(api.reconcileShoppingTrip).not.toHaveBeenCalled();
    // mas a compra existe aqui, com a nota: nada se perdeu
    const compra = useShoppingStore.getState().trips[0];
    expect(compra.receiptKey).toBe(LANCAMENTO.receiptKey);
    expect(compra.dirty).toBe(true);
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
