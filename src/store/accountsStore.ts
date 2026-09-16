import { create, type StateCreator } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  AccountInvoices,
  ConnectorAccount,
  getAccountInvoices,
  getAccounts,
  getApiErrorStatus,
} from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";
import { describeInvoiceFailure, indexAccounts } from "../utils/accounts";

/** Estado por cartão: cada um pede a própria fatura e falha sozinho. */
export interface InvoicesSlot {
  data: AccountInvoices | null;
  isLoading: boolean;
  error: string | null;
  /** Janela pedida; guardada para o seletor de meses saber o que está na tela. */
  months: number;
}

export const DEFAULT_INVOICE_MONTHS = 6;

interface AccountsState {
  accounts: ConnectorAccount[];
  byId: Map<string, ConnectorAccount>;
  isLoading: boolean;
  /** Separa "ainda não perguntei" de "perguntei e não tem conta nenhuma". */
  hasLoadedOnce: boolean;
  /**
   * Quando a lista foi lida, em ISO. Persiste JUNTO das contas: enquanto o
   * servidor acorda, a cortina mostra o último saldo informado — e só pode
   * fazê-lo dizendo de quando ele é.
   */
  accountsAt: string | null;
  error: string | null;
  invoices: Record<string, InvoicesSlot>;

  /**
   * Carrega uma vez e casa em memória: o extrato devolve só `accountId`, e
   * repetir a chamada a cada foco de tela seria uma requisição por nada — a
   * lista de contas só muda quando o usuário sincroniza um conector.
   */
  fetchAccounts: (force?: boolean) => Promise<void>;
  fetchInvoices: (accountId: string, months?: number) => Promise<void>;
  /** Zera tudo. Chamado no fim da sessão — ver `reset` abaixo. */
  reset: () => void;
}

// Fábrica, e não constante: o `byId` é um Map, e uma instância compartilhada
// entre o estado inicial e cada reset seria a mesma referência circulando
const emptyState = () => ({
  accounts: [] as ConnectorAccount[],
  byId: new Map<string, ConnectorAccount>(),
  isLoading: false,
  hasLoadedOnce: false,
  accountsAt: null as string | null,
  error: null as string | null,
  invoices: {} as Record<string, InvoicesSlot>,
});

/** Chave do instantâneo das contas no armazenamento local. */
export const ACCOUNTS_SNAPSHOT_KEY = "@accounts_snapshot";

/**
 * O que vai para o disco: a lista e a sua data. As faturas ficam de fora —
 * são o rastro mais pesado e mais sensível do store (cada lançamento de cada
 * cartão), e a cortina do servidor só precisa do saldo informado.
 */
type AccountsSnapshot = Pick<AccountsState, "accounts" | "accountsAt">;

/** Uma conta que não tem cara de conta não volta do disco para a tela. */
function looksLikeAccount(value: unknown): value is ConnectorAccount {
  if (typeof value !== "object" || value === null) return false;
  const account = value as Record<string, unknown>;
  return typeof account.id === "string" && typeof account.type === "string";
}

const createAccountsState: StateCreator<AccountsState> = (set, get) => ({
  ...emptyState(),

  /**
   * Fim de sessão zera o store (EC-113).
   *
   * Este é o store com o rastro mais sensível da entrega: nome e instituição
   * de cada cartão e, em `invoices`, as faturas inteiras com todos os
   * lançamentos. E ele é o único com cache permanente — `hasLoadedOnce` faz
   * `fetchAccounts()` devolver na hora, então, ao contrário do extrato (que
   * refaz o fetch a cada foco), o mapa da conta ANTERIOR sobreviveria a um
   * login com outra conta até o app reiniciar, com os nomes dos cartões dela
   * já desenhados nos chips. Sem zerar `hasLoadedOnce`, nada disso se corrige
   * sozinho.
   */
  reset: () => set(emptyState()),

  fetchAccounts: async (force = false) => {
    const state = get();
    // Sem `force`, a segunda tela que precisa do mapa reaproveita o que a
    // primeira já trouxe; a sincronização do conector passa `true`
    if (state.isLoading) return;
    if (state.hasLoadedOnce && !force) return;

    set({ isLoading: true, error: null });
    try {
      const data = await getAccounts();
      set({
        accounts: data,
        byId: indexAccounts(data),
        isLoading: false,
        hasLoadedOnce: true,
        // "Quando este aparelho leu": é o que a legenda de dado velho carimba
        accountsAt: new Date().toISOString(),
      });
    } catch (e) {
      // `hasLoadedOnce` fica FALSO de propósito: marcá-lo aqui transformava um
      // 500 de dois segundos no cold start em recurso desligado pelo resto da
      // sessão — toda tela que pede o mapa no foco batia na guarda de cache e
      // voltava sem tentar, e no celular não sobrava caminho para o retry
      // manual. Falha não é resposta; o próximo foco tenta de novo.
      set({
        error: describeLoadFailure(
          e,
          "Não foi possível carregar suas contas agora.",
        ),
        isLoading: false,
      });
    }
  },

  fetchInvoices: async (accountId, months = DEFAULT_INVOICE_MONTHS) => {
    const current = get().invoices[accountId];
    // Repetir o pedido IDÊNTICO que já está em voo não faz nada. Mas o pedido
    // de OUTRA janela precisa sair: descartá-lo (o que a guarda antiga fazia)
    // deixava o seletor em "12 meses" com a lista de 6 na tela, sem sinal
    // nenhum e sem se corrigir — as deps do efeito da tela já não mudavam
    // mais. Quem resolve o desempate é a checagem de janela no retorno.
    if (current?.isLoading && current.months === months) return;

    set((state) => ({
      invoices: {
        ...state.invoices,
        [accountId]: {
          // O que já está na tela continua visível enquanto a nova janela
          // carrega — trocar 6 por 12 meses não deve piscar a lista inteira
          data: current?.data ?? null,
          isLoading: true,
          error: null,
          months,
        },
      },
    }));

    try {
      const data = await getAccountInvoices(accountId, months);
      // A janela pedida pode ter mudado enquanto a resposta vinha: gravar aqui
      // encheria a tela com o recorte que o usuário já abandonou, e faria a
      // ordem de chegada das respostas decidir o que ele vê
      if (!isWindowStillWanted(get(), accountId, months)) return;
      set((state) => ({
        invoices: {
          ...state.invoices,
          [accountId]: { data, isLoading: false, error: null, months },
        },
      }));
    } catch (e) {
      // Mesma regra do sucesso: o erro da janela abandonada não pode apagar o
      // carregamento da janela que o usuário está esperando
      if (!isWindowStillWanted(get(), accountId, months)) return;
      set((state) => ({
        invoices: {
          ...state.invoices,
          [accountId]: {
            data: state.invoices[accountId]?.data ?? null,
            isLoading: false,
            error: describeInvoiceFailure(getApiErrorStatus(e)),
            months,
          },
        },
      }));
    }
  },
});

export const useAccountsStore = create<AccountsState>()(
  persist(createAccountsState, {
    name: ACCOUNTS_SNAPSHOT_KEY,
    storage: createJSONStorage(() => AsyncStorage),
    partialize: (state): AccountsSnapshot => ({
      accounts: state.accounts,
      accountsAt: state.accountsAt,
    }),
    // O `byId` é um Map e não sobrevive ao JSON: é refeito da lista ao voltar
    // do disco. `hasLoadedOnce` NÃO volta: continua falso para o primeiro
    // foco buscar de novo — o que reidratou é o que se sabia, não resposta
    merge: (persisted, current) => {
      const snapshot = persisted as Partial<AccountsSnapshot> | undefined;
      const accounts = Array.isArray(snapshot?.accounts)
        ? snapshot.accounts.filter(looksLikeAccount)
        : [];
      return {
        ...current,
        accounts,
        byId: indexAccounts(accounts),
        accountsAt:
          accounts.length > 0 && typeof snapshot?.accountsAt === "string"
            ? snapshot.accountsAt
            : null,
      };
    },
  }),
);

/** A resposta que chegou ainda é a janela que a tela está pedindo? */
function isWindowStillWanted(
  state: AccountsState,
  accountId: string,
  months: number,
): boolean {
  return state.invoices[accountId]?.months === months;
}
