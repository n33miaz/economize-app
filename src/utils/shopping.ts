import type {
  PriceSummary,
  ShoppingItemDto,
  ShoppingTripDto,
  ShoppingTripStatus,
  ShoppingTripUpsert,
} from "../services/api";
import { formatBRL, parseAmount } from "./money";

/**
 * O carrinho de compras — as regras puras, sem tela nem rede.
 *
 * <p><b>O pedido do dono (20/09/2026):</b> <i>"amanhã vou fazer compras
 * [...] uma funcionalidade (totalmente offline e rápida) de carrinho de
 * compras [...] enquanto eu faço a compra eu vou tirando foto dos preços e
 * dizendo quantas unidades eu peguei"</i>. Ele usa no supermercado,
 * possivelmente sem sinal: o estado LOCAL é a verdade, e o servidor é quem se
 * ajusta a ele quando a internet volta.
 *
 * <p>Este módulo é puro de propósito: totais, fusão de versões, sugestões e
 * rótulos vivem aqui para serem testados sem montar store nem componente — e
 * para o store e as duas telas nunca discordarem sobre quanto custa o
 * carrinho.
 */

/** Um item do carrinho, como vive no aparelho. */
export interface ShoppingItem {
  clientId: string;
  name: string;
  quantity: number;
  /** Zero quando a pessoa ainda não olhou o preço — é estado, não erro. */
  unitPrice: number;
  promoNote: string | null;
  /** "Já está no carrinho". Nasce marcado: quem adiciona no mercado pegou. */
  checked: boolean;
  /** URI local da foto (arquivo ou data-URI); o upload é assunto de v2. */
  photoRef: string | null;
  /**
   * Lápide. Apagar de verdade faria outro aparelho ressuscitar o item na
   * próxima fusão; a lápide viaja para o servidor e vence pelo relógio.
   */
  deleted: boolean;
  /** Quem da casa pôs o item; nulo quando fui eu ou o servidor não disse. */
  addedByName: string | null;
  /** ISO. É o relógio do "quem escreveu por último vence". */
  clientUpdatedAt: string;
}

/** Uma ida ao mercado. */
export interface ShoppingTrip {
  clientId: string;
  storeName: string;
  status: ShoppingTripStatus;
  budget: number | null;
  startedAt: string;
  closedAt: string | null;
  /** O total da nota fiscal, digitado ao fechar — para conferir contra o carrinho. */
  receiptTotal: number | null;
  notes: string | null;
  shareWithFamily: boolean;
  items: ShoppingItem[];
  clientUpdatedAt: string;
  /** Mudança local que o servidor ainda não viu. */
  dirty: boolean;
  /** Minha ou de alguém da casa. Quem nasce aqui é minha. */
  mine: boolean;
  ownerName: string | null;
  /** Lançamento do extrato ao qual a compra foi conciliada. */
  transactionId: string | null;
}

/** O que a folha de item entrega ao store. */
export interface ItemInput {
  name: string;
  quantity: number;
  unitPrice: number;
  promoNote: string | null;
  photoRef: string | null;
  checked?: boolean;
}

/** Leitura da barra de orçamento. */
export interface BudgetProgress {
  ratio: number;
  /** `ok` até 85%, `warning` até o teto, `over` depois dele. */
  tone: "ok" | "warning" | "over";
  /** Quanto falta (positivo) ou quanto passou (negativo). */
  remaining: number;
}

/** A partir daqui a barra avisa antes de estourar. */
export const BUDGET_WARNING_RATIO = 0.85;

/** Quantas sugestões de nome a folha mostra. */
export const SUGGESTION_LIMIT = 6;

/** Quantas lojas anteriores a folha de nova compra oferece. */
export const STORE_SUGGESTION_LIMIT = 5;

const EPOCH = "1970-01-01T00:00:00.000Z";

export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Id gerado no aparelho — é ele que torna o `PUT` idempotente: a mesma
 * compra enviada duas vezes (a rede caiu depois de o servidor gravar) não vira
 * duas compras.
 *
 * <p>O Hermes não tem `crypto.randomUUID`; o navegador tem. Sem ele, tempo
 * mais dois blocos aleatórios bastam para nunca colidir no mesmo aparelho.
 */
export function makeClientId(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } })
    .crypto;
  if (cripto && typeof cripto.randomUUID === "function") {
    return cripto.randomUUID();
  }
  const bloco = () => Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${bloco()}-${bloco()}`;
}

/**
 * "Leite Integral " e "leite integral" são o mesmo produto para o histórico
 * de preços e para as sugestões. Sem acento e sem espaço duplicado, porque
 * ninguém digita igual duas vezes no corredor do mercado.
 */
export function normalizeItemName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Centavos exatos: 3 × 0,10 em ponto flutuante dá 0,30000000000000004. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function itemSubtotal(
  item: Pick<ShoppingItem, "quantity" | "unitPrice">,
): number {
  return roundMoney(item.quantity * item.unitPrice);
}

/** Os itens vivos — a lápide fica de fora de toda conta e de toda lista. */
export function activeItems(trip: Pick<ShoppingTrip, "items">): ShoppingItem[] {
  return trip.items.filter((item) => !item.deleted);
}

/** Só o que está no carrinho conta: item desmarcado é "não peguei". */
export function tripTotal(trip: Pick<ShoppingTrip, "items">): number {
  return roundMoney(
    activeItems(trip)
      .filter((item) => item.checked)
      .reduce((soma, item) => soma + itemSubtotal(item), 0),
  );
}

/** Linhas do carrinho (produtos), não unidades: "14 itens" é o que se lê na nota. */
export function tripItemCount(trip: Pick<ShoppingTrip, "items">): number {
  return activeItems(trip).filter((item) => item.checked).length;
}

/** Quantos itens ainda não foram marcados como pegos. */
export function tripUncheckedCount(trip: Pick<ShoppingTrip, "items">): number {
  return activeItems(trip).filter((item) => !item.checked).length;
}

export function itemCountLabel(count: number): string {
  return count === 1 ? "1 item" : `${count} itens`;
}

/** "R$ 312,40 · 14 itens" — a manchete da compra, igual na Home e na tela. */
export function tripHeadline(trip: Pick<ShoppingTrip, "items">): string {
  return `${formatBRL(tripTotal(trip))} · ${itemCountLabel(tripItemCount(trip))}`;
}

/** Nulo sem orçamento: a barra some em vez de desenhar um teto inventado. */
export function budgetProgress(
  total: number,
  budget: number | null,
): BudgetProgress | null {
  if (budget == null || budget <= 0) return null;
  const ratio = total / budget;
  const tone =
    ratio >= 1 ? "over" : ratio >= BUDGET_WARNING_RATIO ? "warning" : "ok";
  return { ratio, tone, remaining: roundMoney(budget - total) };
}

export function describeBudget(progress: BudgetProgress, budget: number): string {
  if (progress.tone === "over") {
    return `passou ${formatBRL(Math.abs(progress.remaining))} do orçamento de ${formatBRL(budget)}`;
  }
  return `faltam ${formatBRL(progress.remaining)} do orçamento de ${formatBRL(budget)}`;
}

/**
 * Quantidade digitada: aceita "2", "0,5" e "1.5" (peso no açougue), recusa
 * zero, negativo e lixo. Nulo é "não entendi", e a folha decide a frase.
 */
export function parseQuantity(raw: string): number | null {
  const value = parseAmount(raw);
  if (value == null || value <= 0) return null;
  return Math.round(value * 1000) / 1000;
}

export function formatQuantity(quantity: number): string {
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString("pt-BR", { maximumFractionDigits: 3 });
}

/** "2 × R$ 5,49", ou "2 un · sem preço" enquanto o preço não foi olhado. */
export function describeItemLine(
  item: Pick<ShoppingItem, "quantity" | "unitPrice">,
): string {
  if (item.unitPrice <= 0) return `${formatQuantity(item.quantity)} un · sem preço`;
  return `${formatQuantity(item.quantity)} × ${formatBRL(item.unitPrice)}`;
}

/**
 * Referência que só existe neste aparelho. O servidor nunca a recebe (seria
 * mandar um caminho de arquivo que ele não lê, ou um data-URI de dezenas de
 * KB) — e na fusão ela é preservada mesmo quando o servidor devolve nulo.
 */
export function isLocalPhotoRef(ref: string | null | undefined): boolean {
  if (!ref) return false;
  return /^(file:|data:|content:|ph:|assets-library:|blob:)/i.test(ref);
}

/** Positivo quando `a` é mais novo que `b`. Data ilegível conta como zero. */
export function compareUpdatedAt(a: string, b: string): number {
  const ta = Date.parse(a) || 0;
  const tb = Date.parse(b) || 0;
  return ta - tb;
}

/** O relógio mais novo da compra inteira — a "versão" que o servidor viu ou não. */
export function tripVersion(
  trip: Pick<ShoppingTrip, "clientUpdatedAt" | "items">,
): string {
  return trip.items.reduce(
    (maior, item) =>
      compareUpdatedAt(item.clientUpdatedAt, maior) > 0
        ? item.clientUpdatedAt
        : maior,
    trip.clientUpdatedAt,
  );
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asText(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** O item como o servidor manda, com os buracos tapados: campo faltando não derruba a fusão. */
export function normalizeRemoteItem(dto: ShoppingItemDto): ShoppingItem {
  return {
    clientId: String(dto.clientId),
    name: typeof dto.name === "string" ? dto.name : "",
    quantity: asNumber(dto.quantity, 1),
    unitPrice: asNumber(dto.unitPrice, 0),
    promoNote: asText(dto.promoNote),
    checked: dto.checked !== false,
    photoRef: asText(dto.photoRef),
    deleted: dto.deleted === true,
    addedByName: asText(dto.addedByName),
    clientUpdatedAt: asText(dto.clientUpdatedAt) ?? EPOCH,
  };
}

const STATUSES: ShoppingTripStatus[] = ["OPEN", "CLOSED", "RECONCILED"];

/**
 * De quem é a compra que veio do servidor. Ele pode dizer (`mine`); quando
 * não diz, o dono é quem tem o mesmo nome que a pessoa logada — e sem nome
 * nenhum a lista é a do usuário, então é minha.
 */
function resolveMine(dto: ShoppingTripDto, viewerName?: string | null): boolean {
  if (typeof dto.mine === "boolean") return dto.mine;
  if (typeof dto.isMine === "boolean") return dto.isMine;
  const dono = asText(dto.ownerName);
  if (!dono) return true;
  if (!viewerName) return true;
  return normalizeItemName(dono) === normalizeItemName(viewerName);
}

export function normalizeRemoteTrip(
  dto: ShoppingTripDto,
  viewerName?: string | null,
): ShoppingTrip {
  const status = STATUSES.includes(dto.status as ShoppingTripStatus)
    ? (dto.status as ShoppingTripStatus)
    : "OPEN";
  return {
    clientId: String(dto.clientId),
    storeName: typeof dto.storeName === "string" ? dto.storeName : "",
    status,
    budget: asNullableNumber(dto.budget),
    startedAt: asText(dto.startedAt) ?? EPOCH,
    closedAt: asText(dto.closedAt),
    receiptTotal: asNullableNumber(dto.receiptTotal),
    notes: asText(dto.notes),
    shareWithFamily: (dto.sharedWithFamily ?? dto.shareWithFamily) === true,
    items: (dto.items ?? []).map(normalizeRemoteItem),
    // O cabeçalho usa o relógio do servidor quando o cliente não mandou um:
    // é ele que decide, na fusão, se a loja/orçamento de lá é mais nova
    clientUpdatedAt:
      asText(dto.clientUpdatedAt) ?? asText(dto.updatedAt) ?? EPOCH,
    dirty: false,
    mine: resolveMine(dto, viewerName),
    ownerName: asText(dto.ownerName),
    transactionId:
      asText(dto.reconciledTransactionId) ?? asText(dto.transactionId),
  };
}

/**
 * Fusão de itens: união por `clientId`, e no par vence o relógio mais novo.
 * Empate fica com o LOCAL — é o que preserva a foto que só existe aqui, e o
 * conteúdo é o mesmo de qualquer jeito.
 */
export function mergeItems(
  local: ShoppingItem[],
  remote: ShoppingItem[],
): ShoppingItem[] {
  const porId = new Map<string, ShoppingItem>();
  local.forEach((item) => porId.set(item.clientId, item));
  remote.forEach((item) => {
    const meu = porId.get(item.clientId);
    if (!meu) {
      porId.set(item.clientId, item);
      return;
    }
    if (compareUpdatedAt(item.clientUpdatedAt, meu.clientUpdatedAt) > 0) {
      porId.set(item.clientId, {
        ...item,
        // A foto local sobrevive à versão remota: o servidor não a tem, e
        // "nulo" vindo de lá é ausência, não decisão de apagar
        photoRef:
          item.photoRef ?? (isLocalPhotoRef(meu.photoRef) ? meu.photoRef : null),
        addedByName: item.addedByName ?? meu.addedByName,
      });
    }
  });
  return Array.from(porId.values());
}

/**
 * Há algo LOCAL que o servidor ainda não tem: o cabeçalho mais novo, um item
 * que ele não conhece ou um item cujo relógio aqui é mais recente.
 *
 * <p>Comparar só o relógio mais novo das duas compras não basta: outro
 * aparelho pode ter escrito um item às 10h05 enquanto este escreveu outro às
 * 10h04 — a "versão" remota seria maior e o item das 10h04 nunca subiria.
 */
export function localAhead(
  local: Pick<ShoppingTrip, "clientUpdatedAt" | "items">,
  remote: Pick<ShoppingTrip, "clientUpdatedAt" | "items">,
): boolean {
  if (compareUpdatedAt(local.clientUpdatedAt, remote.clientUpdatedAt) > 0) {
    return true;
  }
  const remotos = new Map(remote.items.map((item) => [item.clientId, item]));
  return local.items.some((item) => {
    const deLa = remotos.get(item.clientId);
    return !deLa || compareUpdatedAt(item.clientUpdatedAt, deLa.clientUpdatedAt) > 0;
  });
}

/**
 * Só os campos de cabeçalho que o servidor DE FATO mandou.
 *
 * <p>Quando a versão remota vence, ela sobrepõe a local campo a campo — e um
 * campo ausente na resposta é "não sei", não "é o padrão". Sem isto, uma
 * resposta enxuta (ou de um servidor ainda em construção) com `updatedAt`
 * mais novo apagaria a loja, o orçamento e até reabriria uma compra fechada
 * no caixa. `null` explícito continua valendo como valor.
 */
function remoteHeaderOverlay(
  dto: ShoppingTripDto,
  remote: ShoppingTrip,
): Partial<ShoppingTrip> {
  const overlay: Partial<ShoppingTrip> = {
    clientUpdatedAt: remote.clientUpdatedAt,
  };
  if (typeof dto.storeName === "string") overlay.storeName = remote.storeName;
  if (STATUSES.includes(dto.status as ShoppingTripStatus)) {
    overlay.status = remote.status;
  }
  if (dto.budget !== undefined) overlay.budget = remote.budget;
  if (dto.startedAt !== undefined) overlay.startedAt = remote.startedAt;
  if (dto.closedAt !== undefined) overlay.closedAt = remote.closedAt;
  if (dto.receiptTotal !== undefined) overlay.receiptTotal = remote.receiptTotal;
  if (dto.notes !== undefined) overlay.notes = remote.notes;
  if (dto.sharedWithFamily !== undefined || dto.shareWithFamily !== undefined) {
    overlay.shareWithFamily = remote.shareWithFamily;
  }
  return overlay;
}

/**
 * Fusão de uma compra: cabeçalho pelo relógio da compra, itens item a item.
 * Sem versão local, a remota entra como está (e limpa).
 *
 * <p>`dirty` só continua verdadeiro quando ainda há algo local que o
 * servidor não conhece — é o que faz o indicador "não sincronizado" apagar
 * sozinho quando a resposta confirma tudo.
 */
export function mergeTrip(
  local: ShoppingTrip | undefined,
  remoteDto: ShoppingTripDto,
  viewerName?: string | null,
): ShoppingTrip {
  const remote = normalizeRemoteTrip(remoteDto, viewerName);
  if (!local) return remote;

  const remotoMaisNovo =
    compareUpdatedAt(remote.clientUpdatedAt, local.clientUpdatedAt) > 0;
  const cabecalho: ShoppingTrip = remotoMaisNovo
    ? { ...local, ...remoteHeaderOverlay(remoteDto, remote) }
    : local;
  const items = mergeItems(local.items, remote.items);
  const fundida: ShoppingTrip = {
    ...cabecalho,
    items,
    // Conciliação é decisão do servidor: uma vez conciliada, nenhum relógio
    // local pode voltar a compra para "fechada"
    status:
      remote.status === "RECONCILED" || local.status === "RECONCILED"
        ? "RECONCILED"
        : cabecalho.status,
    transactionId: remote.transactionId ?? local.transactionId,
    mine: local.mine,
    ownerName: remote.ownerName ?? local.ownerName,
    dirty: local.dirty && localAhead(local, remote),
  };
  return fundida;
}

/**
 * Fusão da lista inteira (o `GET /trips`). O que o servidor não devolveu
 * continua aqui: pode ser uma compra que ainda não subiu — apagar seria
 * perder o carrinho de quem estava sem sinal.
 */
export function mergeTripLists(
  local: ShoppingTrip[],
  remote: ShoppingTripDto[],
  viewerName?: string | null,
): ShoppingTrip[] {
  const porId = new Map(local.map((trip) => [trip.clientId, trip]));
  remote.forEach((dto) => {
    const id = String(dto.clientId);
    porId.set(id, mergeTrip(porId.get(id), dto, viewerName));
  });
  return Array.from(porId.values());
}

/**
 * Depois de um `PUT` que deu certo: a resposta consolidada entra pela fusão,
 * a compra fica limpa se nada mudou enquanto o pedido estava em voo, e as
 * lápides que o servidor já viu deixam de ocupar espaço.
 *
 * <p>A resposta é o RECIBO do que foi enviado: tudo até `sentVersion` está
 * reconhecido, mesmo que o servidor tenha ecoado menos campos do que
 * recebeu. Só o que mudou aqui enquanto o pedido viajava continua sujo — é
 * o `pull` quem usa a comparação item a item, porque lá a resposta não é
 * recibo de nada.
 */
export function afterPush(
  local: ShoppingTrip,
  remoteDto: ShoppingTripDto,
  sentVersion: string,
): ShoppingTrip {
  const fundida = mergeTrip(local, remoteDto);
  const mudouEmVoo = compareUpdatedAt(tripVersion(local), sentVersion) > 0;
  return {
    ...fundida,
    dirty: mudouEmVoo,
    items: fundida.items.filter(
      (item) =>
        !item.deleted || compareUpdatedAt(item.clientUpdatedAt, sentVersion) > 0,
    ),
  };
}

/** O corpo do `PUT`, sem o que é só do aparelho (foto local, `dirty`, dono). */
export function upsertPayloadFrom(trip: ShoppingTrip): ShoppingTripUpsert {
  return {
    clientId: trip.clientId,
    storeName: trip.storeName,
    status: trip.status,
    budget: trip.budget,
    startedAt: trip.startedAt,
    closedAt: trip.closedAt,
    receiptTotal: trip.receiptTotal,
    notes: trip.notes,
    shareWithFamily: trip.shareWithFamily,
    clientUpdatedAt: trip.clientUpdatedAt,
    items: trip.items.map((item) => ({
      clientId: item.clientId,
      name: item.name,
      quantity: item.quantity,
      // Sem preço é nulo, não zero: zero entraria no histórico como "custou
      // nada" e derrubaria o menor preço de todo produto
      unitPrice: item.unitPrice > 0 ? item.unitPrice : null,
      promoNote: item.promoNote,
      checked: item.checked,
      photoRef: isLocalPhotoRef(item.photoRef) ? null : item.photoRef,
      deleted: item.deleted,
      clientUpdatedAt: item.clientUpdatedAt,
    })),
  };
}

/** Abertas primeiro (as minhas antes das da casa), depois pela data, mais recente no topo. */
export function sortTrips(trips: ShoppingTrip[]): ShoppingTrip[] {
  const peso = (trip: ShoppingTrip) =>
    trip.status === "OPEN" ? (trip.mine ? 0 : 1) : 2;
  return [...trips].sort((a, b) => {
    const diferenca = peso(a) - peso(b);
    if (diferenca !== 0) return diferenca;
    return compareUpdatedAt(b.startedAt, a.startedAt);
  });
}

export function openTrips(trips: ShoppingTrip[]): ShoppingTrip[] {
  return sortTrips(trips).filter((trip) => trip.status === "OPEN");
}

export function closedTrips(trips: ShoppingTrip[]): ShoppingTrip[] {
  return sortTrips(trips).filter((trip) => trip.status !== "OPEN");
}

/** A compra aberta que a Home anuncia: a minha, ou a da casa se a minha não existe. */
export function currentOpenTrip(trips: ShoppingTrip[]): ShoppingTrip | null {
  return openTrips(trips)[0] ?? null;
}

/**
 * Nomes já usados, para a folha completar enquanto se digita. Quem começa
 * pelo que foi digitado vem antes de quem só contém; entre iguais, o mais
 * frequente. Distintos pelo nome normalizado, exibidos com a grafia mais
 * recente — é a que a pessoa acabou de usar.
 */
export function itemNameSuggestions(
  trips: ShoppingTrip[],
  query: string,
  limit = SUGGESTION_LIMIT,
): string[] {
  const alvo = normalizeItemName(query);
  const contagem = new Map<
    string,
    { display: string; count: number; lastAt: string }
  >();
  trips.forEach((trip) => {
    activeItems(trip).forEach((item) => {
      const chave = normalizeItemName(item.name);
      if (!chave) return;
      const atual = contagem.get(chave);
      if (!atual) {
        contagem.set(chave, {
          display: item.name.trim(),
          count: 1,
          lastAt: item.clientUpdatedAt,
        });
        return;
      }
      atual.count += 1;
      if (compareUpdatedAt(item.clientUpdatedAt, atual.lastAt) > 0) {
        atual.lastAt = item.clientUpdatedAt;
        atual.display = item.name.trim();
      }
    });
  });

  const candidatos = Array.from(contagem.entries())
    .filter(([chave]) => alvo.length === 0 || chave.includes(alvo))
    // O que a pessoa já escreveu por inteiro não é sugestão
    .filter(([chave]) => chave !== alvo)
    .map(([chave, info]) => ({
      ...info,
      rank: alvo.length > 0 && chave.startsWith(alvo) ? 0 : 1,
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.count - a.count ||
        compareUpdatedAt(b.lastAt, a.lastAt),
    );

  return candidatos.slice(0, limit).map((c) => c.display);
}

/**
 * As lojas das compras anteriores, a mais recente primeiro, sem repetição.
 * É o que a folha de nova compra oferece em um toque: o dono vai ao mesmo
 * mercado quase sempre.
 */
export function storeSuggestions(
  trips: ShoppingTrip[],
  limit = STORE_SUGGESTION_LIMIT,
): string[] {
  const vistas = new Set<string>();
  const lojas: string[] = [];
  [...trips]
    .sort((a, b) => compareUpdatedAt(b.startedAt, a.startedAt))
    .forEach((trip) => {
      const nome = trip.storeName.trim();
      const chave = normalizeItemName(nome);
      if (!chave || vistas.has(chave)) return;
      vistas.add(chave);
      lojas.push(nome);
    });
  return lojas.slice(0, limit);
}

/** Loja e orçamento da compra mais recente: o que a folha de nova compra pré-preenche. */
export function lastTripDefaults(
  trips: ShoppingTrip[],
): { storeName: string; budget: number | null } {
  const minhas = trips.filter((trip) => trip.mine);
  const ultima = [...minhas].sort((a, b) =>
    compareUpdatedAt(b.startedAt, a.startedAt),
  )[0];
  return {
    storeName: ultima?.storeName ?? "",
    budget: ultima?.budget ?? null,
  };
}

/**
 * O histórico de preço de um produto, feito só do que está no aparelho —
 * é o que responde quando não há sinal. As compras próprias e as da casa
 * entram; a compra em curso fica de fora, porque "da última vez" é sobre as
 * outras vezes.
 */
export function localPriceSummary(
  trips: ShoppingTrip[],
  name: string,
  excludeTripClientId?: string | null,
): PriceSummary | null {
  const chave = normalizeItemName(name);
  if (!chave) return null;
  const ocorrencias: { price: number; store: string | null; at: string }[] = [];
  trips.forEach((trip) => {
    if (excludeTripClientId && trip.clientId === excludeTripClientId) return;
    activeItems(trip).forEach((item) => {
      if (item.unitPrice <= 0) return;
      if (normalizeItemName(item.name) !== chave) return;
      ocorrencias.push({
        price: item.unitPrice,
        store: trip.storeName.trim() || null,
        at: item.clientUpdatedAt,
      });
    });
  });
  if (ocorrencias.length === 0) return null;
  ocorrencias.sort((a, b) => compareUpdatedAt(b.at, a.at));
  const precos = ocorrencias.map((o) => o.price);
  return {
    lastPrice: ocorrencias[0].price,
    lastStore: ocorrencias[0].store,
    lastDate: ocorrencias[0].at,
    minPrice: Math.min(...precos),
    maxPrice: Math.max(...precos),
    avgPrice: roundMoney(precos.reduce((s, p) => s + p, 0) / precos.length),
    occurrences: ocorrencias.length,
  };
}

/**
 * Entre o resumo do servidor e o local, vale o que tem a compra mais
 * recente: sem sinal, o aparelho pode saber de uma ida ao mercado que o
 * servidor ainda não viu — e o contrário também.
 */
export function preferNewerSummary(
  a: PriceSummary | null,
  b: PriceSummary | null,
): PriceSummary | null {
  if (!a) return b;
  if (!b) return a;
  return compareUpdatedAt(b.lastDate ?? "", a.lastDate ?? "") > 0 ? b : a;
}

/**
 * "da última vez R$ 5,49 no Carrefour" — a linha que compara o preço de hoje
 * com o histórico. `aqui` quando a loja é a mesma da compra atual.
 */
export function describePriceHint(
  summary: PriceSummary | null | undefined,
  currentStore: string,
): string | null {
  if (!summary || summary.lastPrice == null || summary.lastPrice <= 0) return null;
  const mesmaLoja =
    !!summary.lastStore &&
    normalizeItemName(summary.lastStore) === normalizeItemName(currentStore);
  const onde = mesmaLoja
    ? "aqui"
    : summary.lastStore
      ? `no ${summary.lastStore}`
      : "";
  let frase = `da última vez ${formatBRL(summary.lastPrice)}${onde ? ` ${onde}` : ""}`;
  if (
    summary.minPrice != null &&
    summary.minPrice > 0 &&
    summary.minPrice < summary.lastPrice
  ) {
    frase += ` · menor ${formatBRL(summary.minPrice)}`;
  }
  return frase;
}

/** "hoje", "ontem" ou "20 de set." — a data de uma compra na lista. */
export function formatTripDate(iso: string, now: Date = new Date()): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return "";
  const mesmoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (mesmoDia(data, now)) return "hoje";
  const ontem = new Date(now);
  ontem.setDate(now.getDate() - 1);
  if (mesmoDia(data, ontem)) return "ontem";
  return data.toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
}

/** "14:32" — quando a última sincronização deu certo. */
export function formatSyncTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** O que a nota diz a mais (positivo) ou a menos que o carrinho. */
export function receiptDifference(
  cartTotal: number,
  receiptTotal: number | null,
): number | null {
  if (receiptTotal == null) return null;
  return roundMoney(receiptTotal - cartTotal);
}

export function describeReceiptDifference(difference: number | null): string | null {
  if (difference == null) return null;
  if (Math.abs(difference) < 0.005) return "A nota bateu com o carrinho.";
  if (difference > 0) {
    return `A nota veio ${formatBRL(difference)} acima do carrinho — algo ficou sem anotar?`;
  }
  return `A nota veio ${formatBRL(Math.abs(difference))} abaixo do carrinho — alguma promoção que a etiqueta não dizia?`;
}

/** O que a tela diz do estado da compra, abaixo do nome da loja. */
export function describeTripStatus(trip: ShoppingTrip): string {
  if (trip.status === "RECONCILED") return "Conciliada com o extrato";
  if (trip.status === "CLOSED") {
    return trip.closedAt ? `Fechada ${formatTripDate(trip.closedAt)}` : "Fechada";
  }
  return `Começou ${formatTripDate(trip.startedAt)}`;
}
