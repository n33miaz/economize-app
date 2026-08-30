// O mock do AsyncStorage é global, em jest.setup.js
import AsyncStorage from "@react-native-async-storage/async-storage";

import { clearLocalData } from "../localData";
import { useAuthStore } from "../../store/authStore";
import { usePreferencesStore } from "../../store/preferencesStore";
import { useFavoritesStore } from "../../store/favoritesStore";
import { useIndicatorStore } from "../../store/indicatorStore";
import { useAiStore } from "../../store/aiStore";
import { useUserStore } from "../../store/userStore";
import { useAccountsStore } from "../../store/accountsStore";
import { useAiSettingsStore } from "../../store/aiSettingsStore";
import { useBankStore } from "../../store/bankStore";
import { useWalletStore } from "../../store/walletStore";
import { useReportsStore } from "../../store/reportsStore";
import { useCategoriesStore } from "../../store/categoriesStore";
import type { BankTransaction, ConnectorAccount } from "../../services/api";

const cartao: ConnectorAccount = {
  id: "acc-cartao",
  name: "Ultravioleta ····1234",
  type: "CREDIT_CARD",
  institution: "Nubank",
  statementClosingDay: 10,
  statementDueDay: 17,
  linked: true,
};

const lancamento = {
  id: "t1",
  transactionId: "bank-1",
  type: "DEBIT",
  amount: -89.9,
  description: "IFOOD",
  originalDescription: "IFOOD *REST",
  displayAlias: null,
  date: "2026-08-03T00:00:00Z",
  categoryId: null,
  reviewStatus: "CONFIRMED",
  categorizedBy: null,
  confidence: null,
  normalizedDescription: "ifood rest",
  uploadId: null,
  accountId: "acc-cartao",
} as BankTransaction;

describe("clearLocalData", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // estado sujo simulando um aparelho em uso real
    useAuthStore.setState({ token: "tok-123", userName: "Ana" });
    usePreferencesStore.setState({
      theme: "light",
      biometricLogin: true,
      biometricChoiceMade: true,
      defaultCurrency: "USD",
      notificationsEnabled: false,
    });
    useFavoritesStore.setState({ favorites: ["USD", "EUR"] });
    useIndicatorStore.setState({
      favoriteSnapshots: [
        {
          id: "id-PETR4",
          type: "stock",
          code: "PETR4",
          name: "Petrobras PN",
          buy: 38.5,
          sell: null,
          variation: 1.2,
        },
      ],
    });
    useUserStore.setState({
      me: {
        id: "u1",
        name: "Ana",
        email: "ana@example.com",
        createdAt: null,
        lastLoginAt: null,
      },
    });

    // Dado financeiro em memória — o rastro que o comentário de `clearLocalData`
    // chama de "o mais sensível de todos" e que nenhum teste cobria
    useBankStore.setState({ transactions: [lancamento] });
    useWalletStore.setState({ transactions: [{ id: "w1" } as never] });
    useReportsStore.setState({ items: [{ id: "r1" } as never] });
    useCategoriesStore.setState({ items: [{ id: "c1" } as never] });
    useAccountsStore.setState({
      accounts: [cartao],
      byId: new Map([[cartao.id, cartao]]),
      hasLoadedOnce: true,
      invoices: {
        "acc-cartao": {
          data: {
            accountId: "acc-cartao",
            accountName: "Ultravioleta ····1234",
            accountType: "CREDIT_CARD",
            institution: "Nubank",
            cycleSource: "PROVIDER_CLOSING_DAY",
            invoices: [],
          },
          isLoading: false,
          error: null,
          months: 6,
        },
      },
    });
  });

  it("clears the entire device storage", async () => {
    await clearLocalData();
    expect(AsyncStorage.clear).toHaveBeenCalledTimes(1);
  });

  it("restores persisted stores to first-install defaults", async () => {
    await clearLocalData();

    const prefs = usePreferencesStore.getState();
    expect(prefs.theme).toBe("dark");
    expect(prefs.biometricLogin).toBe(false);
    // sem dados locais, o modal do login volta a oferecer a biometria
    expect(prefs.biometricChoiceMade).toBe(false);
    expect(prefs.defaultCurrency).toBe("BRL");
    expect(prefs.notificationsEnabled).toBe(true);

    expect(useFavoritesStore.getState().favorites).toEqual([]);
    // sem zerar a memória, o próximo set() do store regravava o retrato
    // apagado de volta no disco (persist parcial do indicatorStore)
    expect(useIndicatorStore.getState().favoriteSnapshots).toEqual([]);
    expect(useUserStore.getState().me).toBeNull();
    expect(useAiStore.getState().messages).toHaveLength(1);
  });

  it("ends the session so navigation falls back to the Login tree", async () => {
    await clearLocalData();

    expect(useAuthStore.getState().token).toBeNull();
    expect(useAuthStore.getState().userName).toBeNull();
  });

  it("apaga TODO dado financeiro em memória, não só o persistido", async () => {
    // Estes quatro já eram limpos e nenhum teste dizia — foi assim que o
    // accountsStore ficou de fora da lista sem ninguém notar
    await clearLocalData();

    expect(useBankStore.getState().transactions).toEqual([]);
    expect(useWalletStore.getState().transactions).toEqual([]);
    expect(useReportsStore.getState().items).toEqual([]);
    expect(useCategoriesStore.getState().items).toEqual([]);
  });

  it("apaga contas e faturas, inclusive o cache que as travava", async () => {
    // Nome do cartão, instituição e cada lançamento de cada fatura. E, sem
    // zerar `hasLoadedOnce`, nem o refetch salvaria: refetch nenhum sairia
    await clearLocalData();

    const contas = useAccountsStore.getState();
    expect(contas.accounts).toEqual([]);
    expect(contas.byId.size).toBe(0);
    expect(contas.invoices).toEqual({});
    expect(contas.hasLoadedOnce).toBe(false);
  });

  it("apaga as opções de IA, inclusive os 4 dígitos da chave do dono", async () => {
    // Não é a chave inteira, mas é rastro do dono anterior — e o
    // `hasLoadedOnce` impediria a tela de perguntar de novo à API
    useAiSettingsStore.setState({
      settings: {
        source: "USER",
        provider: "OPENROUTER",
        model: "openai/gpt-4o-mini",
        keyLast4: "a3c6",
        keyStatus: "OK",
        byokAvailable: true,
        updatedAt: "2026-08-29T00:00:00Z",
      },
      hasLoadedOnce: true,
    });

    await clearLocalData();

    const ia = useAiSettingsStore.getState();
    expect(ia.settings).toBeNull();
    expect(ia.catalog).toBeNull();
    expect(ia.hasLoadedOnce).toBe(false);
  });
});

describe("logout — as saídas que não passam pelo clearLocalData", () => {
  it("sair pelo Perfil também zera contas e faturas", () => {
    // Perfil, biometria e o 401 do interceptor chamam `logout()` direto. Sem o
    // reset ali, o cache permanente do accountsStore mostraria os cartões da
    // conta anterior para quem logasse em seguida
    useAccountsStore.setState({
      accounts: [cartao],
      byId: new Map([[cartao.id, cartao]]),
      hasLoadedOnce: true,
    });

    useAuthStore.getState().logout();

    expect(useAccountsStore.getState().accounts).toEqual([]);
    expect(useAccountsStore.getState().byId.size).toBe(0);
    expect(useAccountsStore.getState().hasLoadedOnce).toBe(false);
  });

  it("sair pelo Perfil também zera as opções de IA", () => {
    useAiSettingsStore.setState({
      settings: {
        source: "USER",
        provider: "ANTHROPIC",
        model: "claude-haiku-4-5",
        keyLast4: "9f2a",
        keyStatus: "OK",
        byokAvailable: true,
        updatedAt: "2026-08-29T00:00:00Z",
      },
      hasLoadedOnce: true,
    });

    useAuthStore.getState().logout();

    expect(useAiSettingsStore.getState().settings).toBeNull();
    expect(useAiSettingsStore.getState().hasLoadedOnce).toBe(false);
  });
});
