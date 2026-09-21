import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  type PriceSummary,
  type ReconcileCandidate,
  getShoppingPriceHistory,
  getShoppingReconcileCandidates,
  getShoppingTrips,
  reconcileShoppingTrip,
  upsertShoppingTrip,
} from "../services/api";
import { describeRequestFailure } from "../services/requestFailure";
import { useAuthStore } from "./authStore";
import {
  type ItemInput,
  type ShoppingItem,
  type ShoppingTrip,
  afterPush,
  localPriceSummary,
  makeClientId,
  mergeTrip,
  mergeTripLists,
  normalizeItemName,
  nowIso,
  preferNewerSummary,
  sortTrips,
  tripVersion,
  upsertPayloadFrom,
} from "../utils/shopping";

/**
 * O carrinho de compras no aparelho — EC-24x.
 *
 * <p><b>O estado local é a verdade.</b> O dono anota os itens no corredor do
 * mercado, muitas vezes sem sinal. Toda mutação grava `clientUpdatedAt` e
 * marca a compra como suja; `sync()` sobe cada compra suja por `PUT` e funde
 * a resposta; `pull()` traz o que a casa mandou e funde pelo relógio — nunca
 * perdendo um item local mais novo. Falha de rede é silenciosa: a tela mostra
 * "ainda não sincronizado" e a vida continua.
 *
 * <p><b>Sem NetInfo.</b> A regra é tentar e tratar o erro: uma biblioteca de
 * estado de rede acrescentaria um módulo nativo para dizer o que o próprio
 * pedido já diz ao falhar.
 *
 * <p>Persistido por inteiro (compras, cache de preços, hora da última
 * sincronização): fechar o app no meio do mercado não pode custar o carrinho.
 */

/** Quanto tempo o resumo de preço do servidor vale antes de perguntar de novo. */
export const PRICE_CACHE_TTL_MS = 6 * 60 * 60_000;

/** Toda ação que fala com o servidor devolve isto: a tela decide o que dizer. */
export interface ShoppingOutcome {
  ok: boolean;
  message: string;
}

export interface NewTripInput {
  storeName: string;
  budget: number | null;
  shareWithFamily: boolean;
}

interface PriceCacheEntry {
  summary: PriceSummary | null;
  fetchedAt: number;
}

interface ShoppingState {
  trips: ShoppingTrip[];
  /** Resumos de preço já vistos, por nome normalizado. Serve offline. */
  priceCache: Record<string, PriceCacheEntry>;
  /** Epoch ms da última sincronização que deu certo; nulo se nunca houve. */
  lastSyncAt: number | null;
  /** A última tentativa falhou (rede, servidor sem o recurso). */
  syncFailed: boolean;
  isSyncing: boolean;
  hasHydrated: boolean;

  createTrip: (input: NewTripInput) => string;
  updateTrip: (
    clientId: string,
    patch: Partial<Pick<ShoppingTrip, "storeName" | "budget" | "notes" | "shareWithFamily">>,
  ) => void;
  addItem: (tripClientId: string, input: ItemInput) => string;
  updateItem: (
    tripClientId: string,
    itemClientId: string,
    patch: Partial<ItemInput>,
  ) => void;
  toggleItemChecked: (tripClientId: string, itemClientId: string) => void;
  removeItem: (tripClientId: string, itemClientId: string) => void;
  /** Fecha localmente e tenta subir na hora; offline fica na fila. */
  closeTrip: (clientId: string, receiptTotal: number | null) => Promise<void>;
  /** Reabre uma compra fechada por engano. */
  reopenTrip: (clientId: string) => void;
  removeTrip: (clientId: string) => void;
  fetchReconcileCandidates: (clientId: string) => Promise<ReconcileCandidate[]>;
  reconcile: (clientId: string, transactionId: string) => Promise<ShoppingOutcome>;
  /** O que o aparelho já sabe do preço, sem rede: cache do servidor ∪ compras locais. */
  priceSummaryFor: (name: string, excludeTripClientId?: string | null) => PriceSummary | null;
  /** Pergunta ao servidor (respeitando o cache) e devolve o melhor resumo. */
  lookupPrice: (name: string, excludeTripClientId?: string | null) => Promise<PriceSummary | null>;
  sync: () => Promise<boolean>;
  pull: () => Promise<boolean>;
  syncAll: () => Promise<boolean>;
  /** Zera tudo. Chamado no fim da sessão pelo `authStore`. */
  reset: () => void;
}

const EMPTY = {
  trips: [] as ShoppingTrip[],
  priceCache: {} as Record<string, PriceCacheEntry>,
  lastSyncAt: null as number | null,
  syncFailed: false,
  isSyncing: false,
};

function itemFrom(input: ItemInput, now: string): ShoppingItem {
  return {
    clientId: makeClientId(),
    name: input.name.trim(),
    quantity: input.quantity > 0 ? input.quantity : 1,
    unitPrice: input.unitPrice > 0 ? input.unitPrice : 0,
    promoNote: input.promoNote?.trim() ? input.promoNote.trim() : null,
    checked: input.checked ?? true,
    photoRef: input.photoRef ?? null,
    deleted: false,
    addedByName: null,
    clientUpdatedAt: now,
  };
}

// Uma sincronização de cada vez: a folha de item, o foco da tela e o botão
// podem pedir juntos, e três `PUT` da mesma compra em voo é o jeito mais
// rápido de o servidor devolver três versões diferentes
let syncInFlight: Promise<boolean> | null = null;

export const useShoppingStore = create(
  persist<ShoppingState>(
    (set, get) => ({
      ...EMPTY,
      hasHydrated: false,

      createTrip: ({ storeName, budget, shareWithFamily }) => {
        const now = nowIso();
        const trip: ShoppingTrip = {
          clientId: makeClientId(),
          storeName: storeName.trim(),
          status: "OPEN",
          budget: budget != null && budget > 0 ? budget : null,
          startedAt: now,
          closedAt: null,
          receiptTotal: null,
          notes: null,
          shareWithFamily,
          items: [],
          clientUpdatedAt: now,
          dirty: true,
          mine: true,
          ownerName: null,
          transactionId: null,
        };
        set((state) => ({ trips: sortTrips([trip, ...state.trips]) }));
        return trip.clientId;
      },

      updateTrip: (clientId, patch) => {
        const now = nowIso();
        set((state) => ({
          trips: state.trips.map((trip) =>
            trip.clientId === clientId
              ? { ...trip, ...patch, clientUpdatedAt: now, dirty: true }
              : trip,
          ),
        }));
      },

      addItem: (tripClientId, input) => {
        const now = nowIso();
        const item = itemFrom(input, now);
        set((state) => ({
          trips: state.trips.map((trip) =>
            trip.clientId === tripClientId
              ? { ...trip, items: [...trip.items, item], dirty: true }
              : trip,
          ),
        }));
        return item.clientId;
      },

      updateItem: (tripClientId, itemClientId, patch) => {
        const now = nowIso();
        set((state) => ({
          trips: state.trips.map((trip) => {
            if (trip.clientId !== tripClientId) return trip;
            return {
              ...trip,
              dirty: true,
              items: trip.items.map((item) => {
                if (item.clientId !== itemClientId) return item;
                const atualizado: ShoppingItem = {
                  ...item,
                  ...(patch.name !== undefined ? { name: patch.name.trim() } : null),
                  ...(patch.quantity !== undefined
                    ? { quantity: patch.quantity > 0 ? patch.quantity : item.quantity }
                    : null),
                  ...(patch.unitPrice !== undefined
                    ? { unitPrice: patch.unitPrice > 0 ? patch.unitPrice : 0 }
                    : null),
                  ...(patch.promoNote !== undefined
                    ? { promoNote: patch.promoNote?.trim() ? patch.promoNote.trim() : null }
                    : null),
                  ...(patch.photoRef !== undefined ? { photoRef: patch.photoRef } : null),
                  ...(patch.checked !== undefined ? { checked: patch.checked } : null),
                  clientUpdatedAt: now,
                };
                return atualizado;
              }),
            };
          }),
        }));
      },

      toggleItemChecked: (tripClientId, itemClientId) => {
        const trip = get().trips.find((t) => t.clientId === tripClientId);
        const item = trip?.items.find((i) => i.clientId === itemClientId);
        if (!item) return;
        get().updateItem(tripClientId, itemClientId, { checked: !item.checked });
      },

      removeItem: (tripClientId, itemClientId) => {
        const now = nowIso();
        set((state) => ({
          trips: state.trips.map((trip) =>
            trip.clientId === tripClientId
              ? {
                  ...trip,
                  dirty: true,
                  // Lápide, não remoção: apagar de verdade faria outro
                  // aparelho ressuscitar o item na próxima fusão
                  items: trip.items.map((item) =>
                    item.clientId === itemClientId
                      ? { ...item, deleted: true, photoRef: null, clientUpdatedAt: now }
                      : item,
                  ),
                }
              : trip,
          ),
        }));
      },

      closeTrip: async (clientId, receiptTotal) => {
        const now = nowIso();
        set((state) => ({
          trips: sortTrips(
            state.trips.map((trip) =>
              trip.clientId === clientId
                ? {
                    ...trip,
                    status: "CLOSED",
                    closedAt: now,
                    receiptTotal:
                      receiptTotal != null && receiptTotal > 0 ? receiptTotal : null,
                    clientUpdatedAt: now,
                    dirty: true,
                  }
                : trip,
            ),
          ),
        }));
        // O `PUT` leva o status fechado e a data: é o mesmo caminho do resto
        // e funciona na fila offline. Sem sinal, sobe na próxima volta
        await get().sync();
      },

      reopenTrip: (clientId) => {
        const now = nowIso();
        set((state) => ({
          trips: sortTrips(
            state.trips.map((trip) =>
              trip.clientId === clientId && trip.status === "CLOSED"
                ? { ...trip, status: "OPEN", closedAt: null, clientUpdatedAt: now, dirty: true }
                : trip,
            ),
          ),
        }));
      },

      removeTrip: (clientId) => {
        // Só compras que o servidor ainda não viu somem de verdade; uma que
        // já subiu voltaria no próximo `pull`. Apagar no servidor é v2
        set((state) => ({
          trips: state.trips.filter((trip) => trip.clientId !== clientId),
        }));
      },

      fetchReconcileCandidates: async (clientId) => {
        // A compra precisa existir lá para ele procurar o lançamento dela
        const trip = get().trips.find((t) => t.clientId === clientId);
        if (!trip) return [];
        if (trip.dirty) {
          const subiu = await get().sync();
          if (!subiu) return [];
        }
        try {
          return await getShoppingReconcileCandidates(clientId);
        } catch {
          return [];
        }
      },

      reconcile: async (clientId, transactionId) => {
        try {
          const dto = await reconcileShoppingTrip(clientId, transactionId);
          const viewer = useAuthStore.getState().userName;
          set((state) => ({
            trips: state.trips.map((trip) =>
              trip.clientId === clientId
                ? {
                    ...mergeTrip(trip, dto, viewer),
                    status: "RECONCILED",
                    transactionId,
                  }
                : trip,
            ),
          }));
          return { ok: true, message: "Compra conciliada com o extrato." };
        } catch (e) {
          return { ok: false, message: describeRequestFailure(e).message };
        }
      },

      priceSummaryFor: (name, excludeTripClientId) => {
        const chave = normalizeItemName(name);
        if (!chave) return null;
        const doServidor = get().priceCache[chave]?.summary ?? null;
        const local = localPriceSummary(get().trips, name, excludeTripClientId);
        return preferNewerSummary(doServidor, local);
      },

      lookupPrice: async (name, excludeTripClientId) => {
        const chave = normalizeItemName(name);
        if (!chave) return null;
        const emCache = get().priceCache[chave];
        const fresco =
          emCache != null && Date.now() - emCache.fetchedAt < PRICE_CACHE_TTL_MS;
        if (!fresco) {
          try {
            const resposta = await getShoppingPriceHistory({ name: chave });
            set((state) => ({
              priceCache: {
                ...state.priceCache,
                [chave]: { summary: resposta?.summary ?? null, fetchedAt: Date.now() },
              },
            }));
          } catch {
            // Sem rede (ou sem o recurso no servidor): o que o aparelho sabe
            // responde sozinho, e a próxima consulta tenta de novo
          }
        }
        return get().priceSummaryFor(name, excludeTripClientId);
      },

      sync: () => {
        if (syncInFlight) return syncInFlight;
        const executar = async (): Promise<boolean> => {
          if (!get().hasHydrated) return false;
          const sujas = get().trips.filter((trip) => trip.dirty);
          if (sujas.length === 0) return true;
          set({ isSyncing: true });
          let tudoCerto = true;
          for (const suja of sujas) {
            const versaoEnviada = tripVersion(suja);
            try {
              const dto = await upsertShoppingTrip(upsertPayloadFrom(suja));
              // Funde com o estado ATUAL da compra, não com a cópia enviada:
              // um item pode ter entrado enquanto o pedido estava em voo
              set((state) => ({
                trips: state.trips.map((trip) =>
                  trip.clientId === suja.clientId
                    ? afterPush(trip, dto, versaoEnviada)
                    : trip,
                ),
              }));
            } catch {
              tudoCerto = false;
            }
          }
          set({
            isSyncing: false,
            syncFailed: !tudoCerto,
            lastSyncAt: tudoCerto ? Date.now() : get().lastSyncAt,
          });
          return tudoCerto;
        };
        syncInFlight = executar().finally(() => {
          syncInFlight = null;
        });
        return syncInFlight;
      },

      pull: async () => {
        if (!get().hasHydrated) return false;
        try {
          const remotas = await getShoppingTrips();
          const viewer = useAuthStore.getState().userName;
          set((state) => ({
            trips: sortTrips(mergeTripLists(state.trips, remotas, viewer)),
            lastSyncAt: Date.now(),
            syncFailed: false,
          }));
          return true;
        } catch {
          set({ syncFailed: true });
          return false;
        }
      },

      syncAll: async () => {
        const subiu = await get().sync();
        const desceu = await get().pull();
        return subiu && desceu;
      },

      reset: () => {
        syncInFlight = null;
        set({ ...EMPTY });
      },
    }),
    {
      name: "@shopping_storage",
      storage: createJSONStorage(() => AsyncStorage),
      // O que é da sessão (em voo, hidratado) não vai para o disco
      partialize: (state) =>
        ({
          trips: state.trips,
          priceCache: state.priceCache,
          lastSyncAt: state.lastSyncAt,
          syncFailed: state.syncFailed,
        }) as ShoppingState,
      onRehydrateStorage: () => () => {
        useShoppingStore.setState({ hasHydrated: true });
      },
    },
  ),
);

/** Há algo neste aparelho que o servidor ainda não viu. */
export function selectHasPendingSync(state: ShoppingState): boolean {
  return state.trips.some((trip) => trip.dirty);
}
