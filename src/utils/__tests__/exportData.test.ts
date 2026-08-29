import {
  buildExportPayload,
  exportFileName,
  serializeExportPayload,
  type ExportSources,
} from "../exportData";
import type { BankTransaction, Category, UserMe } from "../../services/api";
import type { Transaction as WalletTransaction } from "../../store/walletStore";

const me: UserMe = {
  id: "u1",
  name: "Ana Souza",
  email: "ana@example.com",
  createdAt: "2026-01-10T12:00:00Z",
  lastLoginAt: "2026-08-14T09:30:00Z",
};

const bankTx: BankTransaction = {
  id: "b1",
  transactionId: "tx-001",
  type: "DEBIT",
  amount: 42.5,
  description: "Mercado",
  originalDescription: "SUPERMERCADO XYZ LTDA",
  displayAlias: null,
  date: "2026-08-01",
  categoryId: "c1",
  reviewStatus: "CONFIRMED",
  categorizedBy: null,
  confidence: null,
  normalizedDescription: null,
  uploadId: null,
  accountId: null,
};

const walletTx: WalletTransaction = {
  id: "w1",
  assetCode: "PETR4",
  type: "BUY",
  quantity: 10,
  priceAtTransaction: 35.2,
  transactionDate: "2026-07-15T00:00:00Z",
};

function makeCategory(overrides: Partial<Category>): Category {
  return {
    id: "c1",
    name: "Mercado",
    slug: "mercado",
    groupName: null,
    flow: "EXPENSE",
    color: null,
    icon: null,
    systemKey: null,
    parentId: null,
    parentName: null,
    parentSystemKey: null,
    system: false,
    archived: false,
    ...overrides,
  };
}

function makeSources(overrides?: Partial<ExportSources>): ExportSources {
  return {
    me,
    fallbackName: "Ana do Auth",
    preferences: {
      theme: "dark",
      defaultCurrency: "BRL",
      language: "pt-BR",
      notificationsEnabled: true,
      biometricLogin: false,
      hideBalance: false,
      cycleAnchorDay: 12,
    },
    bankTransactions: [bankTx],
    walletTransactions: [walletTx],
    categories: [
      makeCategory({ id: "custom-1", name: "Pets", system: false }),
      makeCategory({ id: "system-1", name: "Moradia", system: true }),
    ],
    now: new Date("2026-08-15T10:00:00Z"),
    ...overrides,
  };
}

describe("buildExportPayload", () => {
  it("builds the full package from the loaded sources", () => {
    const payload = buildExportPayload(makeSources());

    expect(payload.app).toBe("Economize!");
    expect(payload.schema).toBe("economize.export.v1");
    expect(payload.exportedAt).toBe("2026-08-15T10:00:00.000Z");
    expect(payload.profile).toEqual({
      name: "Ana Souza",
      email: "ana@example.com",
      memberSince: "2026-01-10T12:00:00Z",
      lastAccessAt: "2026-08-14T09:30:00Z",
    });
    expect(payload.preferences.defaultCurrency).toBe("BRL");
    expect(payload.bankTransactions.count).toBe(1);
    expect(payload.bankTransactions.items[0]).toEqual(bankTx);
    expect(payload.walletTransactions.count).toBe(1);
    expect(payload.walletTransactions.items[0]).toEqual(walletTx);
  });

  it("leva a âncora do ciclo — é a preferência que só existe neste aparelho", () => {
    const payload = buildExportPayload(makeSources());

    expect(payload.preferences.cycleAnchorDay).toBe(12);
  });

  it("exports only categories created by the user", () => {
    const payload = buildExportPayload(makeSources());

    expect(payload.customCategories.count).toBe(1);
    expect(payload.customCategories.items).toEqual([
      {
        id: "custom-1",
        name: "Pets",
        groupName: null,
        flow: "EXPENSE",
        color: null,
        icon: null,
        parentId: null,
        archived: false,
      },
    ]);
  });

  it("falls back to the auth name when the profile has not loaded", () => {
    const payload = buildExportPayload(makeSources({ me: null }));

    expect(payload.profile.name).toBe("Ana do Auth");
    expect(payload.profile.email).toBeNull();
    expect(payload.profile.memberSince).toBeNull();
  });

  it("handles completely empty sources without throwing", () => {
    const payload = buildExportPayload(
      makeSources({
        me: null,
        fallbackName: null,
        bankTransactions: [],
        walletTransactions: [],
        categories: [],
      }),
    );

    expect(payload.profile.name).toBeNull();
    expect(payload.bankTransactions.count).toBe(0);
    expect(payload.walletTransactions.count).toBe(0);
    expect(payload.customCategories.count).toBe(0);
  });
});

describe("serializeExportPayload", () => {
  it("produces indented JSON that parses back to the payload", () => {
    const payload = buildExportPayload(makeSources());
    const json = serializeExportPayload(payload);

    expect(json).toContain("\n  ");
    expect(JSON.parse(json)).toEqual(payload);
  });
});

describe("exportFileName", () => {
  it("names the file with the local date as YYYY-MM-DD", () => {
    // meio-dia local: evita virada de dia por fuso na conversão
    const name = exportFileName(new Date(2026, 7, 15, 12, 0, 0));
    expect(name).toBe("economize-dados-2026-08-15.json");
  });
});
