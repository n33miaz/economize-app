import type { BankTransaction, Category, UserMe } from "../services/api";
import type { Transaction as WalletTransaction } from "../store/walletStore";
import type { Currency, Language, ThemeMode } from "../store/preferencesStore";

// Recorte das preferências que faz sentido sair no pacote: só o que o usuário
// escolheu de fato — flags internas (choiceMade, lastSeenVersion) ficam de fora
export interface ExportPreferences {
  theme: ThemeMode;
  defaultCurrency: Currency;
  language: Language;
  notificationsEnabled: boolean;
  biometricLogin: boolean;
  hideBalance: boolean;
  /**
   * Dia em que o mês financeiro vira (EC-092). Entra no pacote porque é escolha
   * do usuário como qualquer outra — e é a única que só existe neste aparelho,
   * então o export é o único lugar de onde ela pode ser recuperada.
   */
  cycleAnchorDay: number;
}

export interface ExportSources {
  me: UserMe | null;
  /** Nome do authStore para quando o perfil ainda não carregou do servidor */
  fallbackName: string | null;
  preferences: ExportPreferences;
  bankTransactions: BankTransaction[];
  walletTransactions: WalletTransaction[];
  categories: Category[];
  /** Injetável para teste determinístico; em produção usa o relógio real */
  now?: Date;
}

// Montagem pura do pacote de exportação (EC-104): recebe os dados já
// carregados e devolve um objeto serializável — sem tocar em store, API ou
// plataforma, para ser testável e reusável em qualquer canal de entrega
export function buildExportPayload(sources: ExportSources) {
  const {
    me,
    fallbackName,
    preferences,
    bankTransactions,
    walletTransactions,
    categories,
    now,
  } = sources;

  // categorias do sistema não são dado do usuário — só as criadas por ele
  const customCategories = categories
    .filter((category) => !category.system)
    .map((category) => ({
      id: category.id,
      name: category.name,
      groupName: category.groupName,
      flow: category.flow,
      color: category.color,
      icon: category.icon,
      parentId: category.parentId,
      archived: category.archived,
    }));

  return {
    app: "Economize!",
    schema: "economize.export.v1",
    exportedAt: (now ?? new Date()).toISOString(),
    profile: {
      name: me?.name ?? fallbackName ?? null,
      email: me?.email ?? null,
      memberSince: me?.createdAt ?? null,
      lastAccessAt: me?.lastLoginAt ?? null,
    },
    preferences,
    bankTransactions: {
      count: bankTransactions.length,
      items: bankTransactions,
    },
    walletTransactions: {
      count: walletTransactions.length,
      items: walletTransactions,
    },
    customCategories: {
      count: customCategories.length,
      items: customCategories,
    },
  };
}

export type ExportPayload = ReturnType<typeof buildExportPayload>;

export function serializeExportPayload(payload: ExportPayload): string {
  // identado: o arquivo é para o usuário ler, não só para máquina
  return JSON.stringify(payload, null, 2);
}

export function exportFileName(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `economize-dados-${year}-${month}-${day}.json`;
}
