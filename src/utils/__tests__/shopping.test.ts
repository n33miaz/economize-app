import type { ShoppingTripDto } from "../../services/api";
import { formatBRL } from "../money";
import {
  type ShoppingItem,
  type ShoppingTrip,
  afterPush,
  budgetProgress,
  closedTrips,
  currentOpenTrip,
  describeBudget,
  describeItemLine,
  describePriceHint,
  describeReceiptDifference,
  describeTripStatus,
  formatTripDate,
  itemNameSuggestions,
  lastTripDefaults,
  localAhead,
  localPriceSummary,
  makeClientId,
  mergeItems,
  mergeTrip,
  mergeTripLists,
  normalizeItemName,
  normalizeRemoteTrip,
  openTrips,
  parseQuantity,
  preferNewerSummary,
  receiptDifference,
  sortTrips,
  storeSuggestions,
  tripHeadline,
  tripItemCount,
  tripTotal,
  tripUncheckedCount,
  tripVersion,
  upsertPayloadFrom,
} from "../shopping";

const T0 = "2026-09-21T10:00:00.000Z";
const T1 = "2026-09-21T10:01:00.000Z";
const T2 = "2026-09-21T10:02:00.000Z";
const T3 = "2026-09-21T10:03:00.000Z";
const T4 = "2026-09-21T10:04:00.000Z";

const item = (over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  clientId: over.clientId ?? makeClientId(),
  name: "Arroz",
  quantity: 1,
  unitPrice: 10,
  promoNote: null,
  checked: true,
  photoRef: null,
  deleted: false,
  addedByName: null,
  clientUpdatedAt: T1,
  ...over,
});

const trip = (over: Partial<ShoppingTrip> = {}): ShoppingTrip => ({
  clientId: over.clientId ?? makeClientId(),
  storeName: "Carrefour",
  status: "OPEN",
  budget: null,
  startedAt: T0,
  closedAt: null,
  receiptTotal: null,
  notes: null,
  shareWithFamily: false,
  items: [],
  clientUpdatedAt: T0,
  dirty: false,
  mine: true,
  ownerName: null,
  transactionId: null,
  ...over,
});

describe("normalização do nome", () => {
  it("ignora caixa, acento e espaço repetido — ninguém digita igual duas vezes", () => {
    expect(normalizeItemName("  Leite   Integral ")).toBe("leite integral");
    expect(normalizeItemName("AÇÚCAR")).toBe("acucar");
    expect(normalizeItemName("Pão de Queijo")).toBe("pao de queijo");
  });
});

describe("totais", () => {
  it("soma quantidade × preço só dos itens pegos e vivos, em centavos exatos", () => {
    const compra = trip({
      items: [
        item({ quantity: 3, unitPrice: 0.1 }),
        item({ quantity: 2, unitPrice: 5.49 }),
        item({ quantity: 1, unitPrice: 100, checked: false }),
        item({ quantity: 1, unitPrice: 100, deleted: true }),
      ],
    });
    expect(tripTotal(compra)).toBe(11.28);
    expect(tripItemCount(compra)).toBe(2);
    expect(tripUncheckedCount(compra)).toBe(1);
  });

  it("a manchete é a mesma frase na Home e na tela", () => {
    const compra = trip({
      items: [item({ quantity: 1, unitPrice: 100 }), item({ quantity: 2, unitPrice: 106.2 })],
    });
    expect(tripHeadline(compra)).toBe(`${formatBRL(312.4)} · 2 itens`);
    expect(tripHeadline(trip({ items: [item()] }))).toBe(`${formatBRL(10)} · 1 item`);
  });

  it("item sem preço não soma nem some", () => {
    const compra = trip({ items: [item({ unitPrice: 0 }), item({ unitPrice: 4 })] });
    expect(tripTotal(compra)).toBe(4);
    expect(tripItemCount(compra)).toBe(2);
    expect(describeItemLine({ quantity: 2, unitPrice: 0 })).toBe("2 un · sem preço");
    expect(describeItemLine({ quantity: 2, unitPrice: 5.49 })).toBe(`2 × ${formatBRL(5.49)}`);
  });
});

describe("orçamento", () => {
  it("sem orçamento não há barra", () => {
    expect(budgetProgress(50, null)).toBeNull();
    expect(budgetProgress(50, 0)).toBeNull();
  });

  it("avisa antes de estourar e diz quanto passou", () => {
    expect(budgetProgress(50, 100)?.tone).toBe("ok");
    expect(budgetProgress(85, 100)?.tone).toBe("warning");
    expect(budgetProgress(120, 100)?.tone).toBe("over");
    expect(describeBudget(budgetProgress(120, 100)!, 100)).toBe(
      `passou ${formatBRL(20)} do orçamento de ${formatBRL(100)}`,
    );
    expect(describeBudget(budgetProgress(60, 100)!, 100)).toBe(
      `faltam ${formatBRL(40)} do orçamento de ${formatBRL(100)}`,
    );
  });
});

describe("quantidade digitada", () => {
  it("aceita inteiro, vírgula e ponto; recusa zero, negativo e lixo", () => {
    expect(parseQuantity("2")).toBe(2);
    expect(parseQuantity("0,5")).toBe(0.5);
    expect(parseQuantity("1.5")).toBe(1.5);
    expect(parseQuantity("0")).toBeNull();
    expect(parseQuantity("-1")).toBeNull();
    expect(parseQuantity("abc")).toBeNull();
  });
});

describe("fusão de itens — quem escreveu por último vence", () => {
  it("o relógio mais novo vence, e o empate fica com o local", () => {
    const local = [
      item({ clientId: "a", name: "Arroz local", clientUpdatedAt: T2 }),
      item({ clientId: "b", name: "Feijão local", clientUpdatedAt: T1 }),
      item({ clientId: "c", name: "Leite local", clientUpdatedAt: T1 }),
    ];
    const remote = [
      item({ clientId: "a", name: "Arroz remoto", clientUpdatedAt: T1 }),
      item({ clientId: "b", name: "Feijão remoto", clientUpdatedAt: T2 }),
      item({ clientId: "c", name: "Leite remoto", clientUpdatedAt: T1 }),
      item({ clientId: "d", name: "Só remoto", clientUpdatedAt: T1 }),
    ];
    const fundidos = mergeItems(local, remote);
    const nome = (id: string) => fundidos.find((i) => i.clientId === id)?.name;
    expect(nome("a")).toBe("Arroz local");
    expect(nome("b")).toBe("Feijão remoto");
    expect(nome("c")).toBe("Leite local");
    expect(nome("d")).toBe("Só remoto");
  });

  it("a foto local sobrevive quando a versão remota vence sem foto", () => {
    const local = [item({ clientId: "a", photoRef: "file:///preco.jpg", clientUpdatedAt: T1 })];
    const remote = [item({ clientId: "a", name: "Arroz 5kg", photoRef: null, clientUpdatedAt: T2 })];
    const [fundido] = mergeItems(local, remote);
    expect(fundido.name).toBe("Arroz 5kg");
    expect(fundido.photoRef).toBe("file:///preco.jpg");
  });

  it("a lápide remota mais nova apaga o item local", () => {
    const local = [item({ clientId: "a", clientUpdatedAt: T1 })];
    const remote = [item({ clientId: "a", deleted: true, clientUpdatedAt: T2 })];
    expect(mergeItems(local, remote)[0].deleted).toBe(true);
  });
});

describe("fusão de compra — o que ainda precisa subir", () => {
  it("continua sujo quando um item local é mais novo que o do servidor, mesmo com a compra remota 'mais nova' no todo", () => {
    // Outro aparelho escreveu o item B às 10h04; este escreveu A às 10h03 e
    // ainda não subiu. Comparar só o relógio mais novo de cada lado diria
    // que o servidor está à frente — e A nunca subiria
    const local = trip({
      clientId: "t",
      dirty: true,
      items: [item({ clientId: "a", clientUpdatedAt: T3 })],
    });
    const remota = normalizeRemoteTrip({
      clientId: "t",
      items: [{ clientId: "b", clientUpdatedAt: T4 }],
    });
    expect(tripVersion(remota) > tripVersion(local)).toBe(true);
    expect(localAhead(local, remota)).toBe(true);
    const fundida = mergeTrip(local, { clientId: "t", items: [{ clientId: "b", clientUpdatedAt: T4 }] });
    expect(fundida.dirty).toBe(true);
    expect(fundida.items.map((i) => i.clientId).sort()).toEqual(["a", "b"]);
  });

  it("fica limpo quando o servidor confirma tudo o que havia aqui", () => {
    const local = trip({
      clientId: "t",
      dirty: true,
      items: [item({ clientId: "a", clientUpdatedAt: T3 })],
    });
    const fundida = mergeTrip(local, {
      clientId: "t",
      updatedAt: T4,
      items: [{ clientId: "a", clientUpdatedAt: T3 }],
    });
    expect(fundida.dirty).toBe(false);
  });

  it("o cabeçalho remoto mais novo traz a loja; conciliada nunca volta a fechada", () => {
    const local = trip({ clientId: "t", storeName: "Local", status: "CLOSED", clientUpdatedAt: T1 });
    const fundida = mergeTrip(local, {
      clientId: "t",
      storeName: "Remota",
      status: "RECONCILED",
      updatedAt: T2,
      reconciledTransactionId: "tx-1",
    });
    expect(fundida.storeName).toBe("Remota");
    expect(fundida.status).toBe("RECONCILED");
    expect(fundida.transactionId).toBe("tx-1");
  });

  it("a lista fundida não perde a compra que o servidor ainda não viu", () => {
    const soLocal = trip({ clientId: "nova", dirty: true });
    const conhecida = trip({ clientId: "velha" });
    const remotas: ShoppingTripDto[] = [{ clientId: "velha", storeName: "Dia" }, { clientId: "outra" }];
    const lista = mergeTripLists([soLocal, conhecida], remotas);
    expect(lista.map((t) => t.clientId).sort()).toEqual(["nova", "outra", "velha"]);
    expect(lista.find((t) => t.clientId === "nova")?.dirty).toBe(true);
  });
});

describe("depois do PUT", () => {
  it("descarta a lápide que o servidor já viu e mantém a que nasceu em voo", () => {
    const local = trip({
      clientId: "t",
      dirty: true,
      items: [
        item({ clientId: "vista", deleted: true, clientUpdatedAt: T1 }),
        item({ clientId: "emVoo", deleted: true, clientUpdatedAt: T3 }),
        item({ clientId: "viva", clientUpdatedAt: T1 }),
      ],
    });
    const depois = afterPush(local, { clientId: "t", items: [{ clientId: "viva", clientUpdatedAt: T1 }] }, T2);
    expect(depois.items.map((i) => i.clientId).sort()).toEqual(["emVoo", "viva"]);
    // Algo mudou enquanto o pedido estava em voo: continua sujo
    expect(depois.dirty).toBe(true);
  });

  it("nada mudou em voo: limpa", () => {
    const local = trip({ clientId: "t", dirty: true, items: [item({ clientId: "a", clientUpdatedAt: T1 })] });
    const depois = afterPush(local, { clientId: "t", items: [{ clientId: "a", clientUpdatedAt: T1 }] }, T1);
    expect(depois.dirty).toBe(false);
  });
});

describe("corpo do PUT", () => {
  it("não manda foto local nem preço zero", () => {
    const compra = trip({
      clientId: "t",
      items: [
        item({ clientId: "a", unitPrice: 0, photoRef: "data:image/jpeg;base64,xxx" }),
        item({ clientId: "b", unitPrice: 3.5, photoRef: "https://cdn/x.jpg" }),
      ],
    });
    const corpo = upsertPayloadFrom(compra);
    expect(corpo.items[0].unitPrice).toBeNull();
    expect(corpo.items[0].photoRef).toBeNull();
    expect(corpo.items[1].unitPrice).toBe(3.5);
    expect(corpo.items[1].photoRef).toBe("https://cdn/x.jpg");
    expect(corpo).not.toHaveProperty("dirty");
  });
});

describe("leitura do servidor", () => {
  it("aceita os dois nomes do compartilhamento e o relógio do servidor", () => {
    const a = normalizeRemoteTrip({ clientId: "a", sharedWithFamily: true, updatedAt: T2 });
    const b = normalizeRemoteTrip({ clientId: "b", shareWithFamily: true });
    expect(a.shareWithFamily).toBe(true);
    expect(a.clientUpdatedAt).toBe(T2);
    expect(b.shareWithFamily).toBe(true);
  });

  it("descobre de quem é pelo nome quando o servidor não diz", () => {
    expect(normalizeRemoteTrip({ clientId: "a", ownerName: "Ana" }, "Neemias").mine).toBe(false);
    expect(normalizeRemoteTrip({ clientId: "a", ownerName: "Neemias" }, "Neemias").mine).toBe(true);
    expect(normalizeRemoteTrip({ clientId: "a", ownerName: "Ana", mine: true }, "Neemias").mine).toBe(true);
    expect(normalizeRemoteTrip({ clientId: "a" }, "Neemias").mine).toBe(true);
  });

  it("status desconhecido cai em aberta, campo faltando não derruba", () => {
    const compra = normalizeRemoteTrip({ clientId: "a", status: "WEIRD", items: [{ clientId: "x" }] });
    expect(compra.status).toBe("OPEN");
    expect(compra.items[0].quantity).toBe(1);
    expect(compra.items[0].checked).toBe(true);
  });
});

describe("ordem e a compra em andamento", () => {
  it("abertas minhas primeiro, depois as da casa, depois as fechadas por data", () => {
    const lista = [
      trip({ clientId: "fechada-nova", status: "CLOSED", startedAt: T3 }),
      trip({ clientId: "casa", mine: false, startedAt: T4 }),
      trip({ clientId: "minha", startedAt: T1 }),
      trip({ clientId: "fechada-velha", status: "CLOSED", startedAt: T0 }),
    ];
    expect(sortTrips(lista).map((t) => t.clientId)).toEqual([
      "minha",
      "casa",
      "fechada-nova",
      "fechada-velha",
    ]);
    expect(openTrips(lista)).toHaveLength(2);
    expect(closedTrips(lista)).toHaveLength(2);
    expect(currentOpenTrip(lista)?.clientId).toBe("minha");
    expect(currentOpenTrip([])).toBeNull();
  });
});

describe("sugestões", () => {
  const historico = [
    trip({
      items: [
        item({ name: "Arroz", clientUpdatedAt: T1 }),
        item({ name: "arroz integral", clientUpdatedAt: T2 }),
        item({ name: "Feijão", clientUpdatedAt: T1 }),
        item({ name: "Arroz", clientUpdatedAt: T3 }),
      ],
    }),
  ];

  it("quem começa pelo digitado vem antes de quem só contém; o exato não é sugestão", () => {
    expect(itemNameSuggestions(historico, "arr")).toEqual(["Arroz", "arroz integral"]);
    expect(itemNameSuggestions(historico, "arroz")).toEqual(["arroz integral"]);
    // Sem acento na busca e na chave: "jão" acha "Feijão"
    expect(itemNameSuggestions(historico, "jão")).toEqual(["Feijão"]);
  });

  it("a resposta do servidor sem um campo não apaga o que está aqui", () => {
    // Uma compra fechada no caixa e um eco enxuto com relógio mais novo:
    // fechada continua fechada, e a loja continua a loja
    const local = trip({ clientId: "t", storeName: "Dia", status: "CLOSED", budget: 200, clientUpdatedAt: T1 });
    const fundida = mergeTrip(local, { clientId: "t", updatedAt: T2, items: [] });
    expect(fundida.status).toBe("CLOSED");
    expect(fundida.storeName).toBe("Dia");
    expect(fundida.budget).toBe(200);
    // Nulo explícito é valor, não ausência
    expect(mergeTrip(local, { clientId: "t", updatedAt: T2, budget: null }).budget).toBeNull();
  });

  it("respeita o teto", () => {
    expect(itemNameSuggestions(historico, "", 1)).toHaveLength(1);
  });

  it("lojas anteriores, a mais recente primeiro e sem repetição", () => {
    const lista = [
      trip({ storeName: "Dia", startedAt: T1 }),
      trip({ storeName: "Carrefour", startedAt: T3 }),
      trip({ storeName: "carrefour ", startedAt: T2 }),
      trip({ storeName: "", startedAt: T4 }),
    ];
    expect(storeSuggestions(lista)).toEqual(["Carrefour", "Dia"]);
  });

  it("a folha de nova compra pré-preenche com a última compra minha", () => {
    const lista = [
      trip({ storeName: "Da casa", budget: 900, mine: false, startedAt: T4 }),
      trip({ storeName: "Dia", budget: 300, startedAt: T2 }),
      trip({ storeName: "Carrefour", budget: null, startedAt: T1 }),
    ];
    expect(lastTripDefaults(lista)).toEqual({ storeName: "Dia", budget: 300 });
    expect(lastTripDefaults([])).toEqual({ storeName: "", budget: null });
  });
});

describe("histórico de preço no aparelho", () => {
  const compras = [
    trip({ clientId: "atual", storeName: "Dia", items: [item({ name: "Leite", unitPrice: 9, clientUpdatedAt: T4 })] }),
    trip({ clientId: "antiga", storeName: "Carrefour", items: [item({ name: "leite", unitPrice: 5.49, clientUpdatedAt: T2 })] }),
    trip({ clientId: "velha", storeName: "Dia", items: [item({ name: "LEITE ", unitPrice: 4.99, clientUpdatedAt: T1 })] }),
    trip({ clientId: "semPreco", items: [item({ name: "Leite", unitPrice: 0, clientUpdatedAt: T3 })] }),
  ];

  it("resume as outras compras e ignora a atual e o sem preço", () => {
    const resumo = localPriceSummary(compras, "Leite", "atual");
    expect(resumo).toEqual({
      lastPrice: 5.49,
      lastStore: "Carrefour",
      lastDate: T2,
      minPrice: 4.99,
      maxPrice: 5.49,
      avgPrice: 5.24,
      occurrences: 2,
    });
    expect(localPriceSummary(compras, "Pão")).toBeNull();
    expect(localPriceSummary(compras, "   ")).toBeNull();
  });

  it("entre servidor e aparelho vale o mais recente", () => {
    const local = localPriceSummary(compras, "Leite", "atual")!;
    const servidor = { ...local, lastPrice: 6, lastDate: T3 };
    expect(preferNewerSummary(local, servidor)?.lastPrice).toBe(6);
    expect(preferNewerSummary(servidor, local)?.lastPrice).toBe(6);
    expect(preferNewerSummary(null, local)).toBe(local);
    expect(preferNewerSummary(local, null)).toBe(local);
  });

  it("a frase diz onde foi e o menor preço quando ele é outro", () => {
    const resumo = localPriceSummary(compras, "Leite", "atual");
    expect(describePriceHint(resumo, "Carrefour")).toBe(
      `da última vez ${formatBRL(5.49)} aqui · menor ${formatBRL(4.99)}`,
    );
    expect(describePriceHint(resumo, "Dia")).toBe(
      `da última vez ${formatBRL(5.49)} no Carrefour · menor ${formatBRL(4.99)}`,
    );
    expect(describePriceHint(null, "Dia")).toBeNull();
  });
});

describe("a nota contra o carrinho", () => {
  it("diz se bateu, se veio acima ou abaixo", () => {
    expect(receiptDifference(100, null)).toBeNull();
    expect(describeReceiptDifference(receiptDifference(100, 100))).toBe("A nota bateu com o carrinho.");
    expect(describeReceiptDifference(receiptDifference(100, 112.5))).toContain(
      `veio ${formatBRL(12.5)} acima`,
    );
    expect(describeReceiptDifference(receiptDifference(100, 90))).toContain(
      `veio ${formatBRL(10)} abaixo`,
    );
    expect(describeReceiptDifference(null)).toBeNull();
  });
});

describe("datas e estado", () => {
  it("hoje, ontem e a data curta", () => {
    const agora = new Date("2026-09-21T15:00:00");
    expect(formatTripDate("2026-09-21T09:00:00", agora)).toBe("hoje");
    expect(formatTripDate("2026-09-20T23:00:00", agora)).toBe("ontem");
    expect(formatTripDate("2026-09-01T10:00:00", agora)).toMatch(/1 de set/);
    expect(formatTripDate("lixo", agora)).toBe("");
  });

  it("descreve o estado da compra", () => {
    expect(describeTripStatus(trip({ status: "RECONCILED" }))).toBe("Conciliada com o extrato");
    expect(describeTripStatus(trip({ status: "CLOSED", closedAt: null }))).toBe("Fechada");
    expect(describeTripStatus(trip({ status: "OPEN", startedAt: new Date().toISOString() }))).toBe(
      "Começou hoje",
    );
  });

  it("ids do aparelho não colidem", () => {
    const ids = new Set(Array.from({ length: 200 }, () => makeClientId()));
    expect(ids.size).toBe(200);
  });
});
