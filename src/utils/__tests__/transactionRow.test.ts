import type { BankTransaction, ConnectorAccount } from "../../services/api";
import { formatBRL } from "../money";
import {
  SUPPORT_SEPARATOR,
  amountLabel,
  amountTone,
  amountVerb,
  isCredit,
  isDebit,
  isPendingReview,
  rowBadges,
  spokenLabel,
  supportLineParts,
} from "../transactionRow";

/** Fixture completa, como o servidor manda hoje. */
function tx(overrides: Partial<BankTransaction> = {}): BankTransaction {
  return {
    id: "t1",
    transactionId: "bank-1",
    type: "DEBIT",
    amount: -89.9,
    description: "IFOOD",
    originalDescription: "IFOOD *REST",
    displayAlias: null,
    date: "2026-07-28T00:00:00Z",
    categoryId: "cat-food",
    reviewStatus: "CONFIRMED",
    categorizedBy: "KEYWORD",
    confidence: 0.9,
    normalizedDescription: "ifood rest",
    uploadId: null,
    accountId: null,
    internalTransfer: false,
    ignored: false,
    familyTransfer: false,
    refunded: false,
    refundOfId: null,
    ...overrides,
  };
}

/**
 * Fixture MÍNIMA: é assim que os testes de tela montam a linha (sem
 * originalDescription, displayAlias, ignored, refunded, familyTransfer) e é
 * assim que um servidor mais velho responderia. Nada aqui pode derrubar.
 */
const minima = {
  type: "DEBIT",
  amount: -194.99,
  description: "SUPERMERCADO SERO",
  date: "2026-08-10T12:00:00Z",
  categoryId: null,
  accountId: null,
  reviewStatus: "CONFIRMED",
} as unknown as BankTransaction;

const cartao: ConnectorAccount = {
  id: "acc-cartao",
  name: "Ultravioleta ····1234",
  type: "CREDIT_CARD",
  institution: "Nubank",
  statementClosingDay: 10,
  statementDueDay: 17,
  linked: true,
  reportedBalance: null,
  reportedBalanceAt: null,
  creditLimit: null,
  creditLimitSharedWith: null,
};

describe("sinal: uma leitura só para as três telas", () => {
  it("débito é sinal OU tipo — CREDIT com valor negativo lê como saída", () => {
    // A Revisão já unia os dois; Extrato e Fatura olhavam só o tipo, e um
    // servidor que mandasse CREDIT negativo era lido de dois jeitos
    expect(isDebit({ type: "CREDIT", amount: -5 })).toBe(true);
    expect(isDebit({ type: "DEBIT", amount: 5 })).toBe(true);
    expect(isCredit({ type: "CREDIT", amount: 5 })).toBe(true);
    expect(isCredit({ type: "DEBIT", amount: -5 })).toBe(false);
  });

  it("o verbo muda com a conta: saída/entrada no banco, compra/crédito no cartão", () => {
    expect(amountVerb({ type: "DEBIT", amount: -1 }, "bank")).toBe("saída");
    expect(amountVerb({ type: "CREDIT", amount: 1 }, "bank")).toBe("entrada");
    expect(amountVerb({ type: "DEBIT", amount: -1 }, "card")).toBe("compra");
    expect(amountVerb({ type: "CREDIT", amount: 1 }, "card")).toBe("crédito");
  });

  it("o valor sai em módulo com o sinal espaçado, nunca o '-R$' do Intl", () => {
    expect(amountLabel(tx())).toBe(`- ${formatBRL(89.9)}`);
    expect(amountLabel(tx({ type: "CREDIT", amount: 1200 }))).toBe(
      `+ ${formatBRL(1200)}`,
    );
    expect(amountLabel(tx())).not.toContain("-R$");
  });
});

describe("tom do valor", () => {
  it("crédito sobe, débito fica neutro — gastar não é erro", () => {
    expect(amountTone(tx({ type: "CREDIT", amount: 10 }))).toBe("up");
    expect(amountTone(tx())).toBe("neutral");
  });

  it("o que não conta nas somas é rebaixado, mesmo sendo crédito", () => {
    expect(amountTone(tx({ ignored: true }))).toBe("muted");
    expect(amountTone(tx({ internalTransfer: true }))).toBe("muted");
    expect(amountTone(tx({ type: "CREDIT", amount: 4, refunded: true }))).toBe(
      "muted",
    );
  });

  it("fixture sem as marcas lê como não marcada", () => {
    expect(amountTone(minima)).toBe("neutral");
  });
});

describe("pendência de revisão", () => {
  it("só CONFIRMED não pende; ausência de status também não", () => {
    expect(isPendingReview({ reviewStatus: "SUGGESTED" })).toBe(true);
    expect(isPendingReview({ reviewStatus: "UNCATEGORIZED" })).toBe(true);
    expect(isPendingReview({ reviewStatus: "CONFIRMED" })).toBe(false);
    expect(
      isPendingReview({ reviewStatus: undefined as unknown as "CONFIRMED" }),
    ).toBe(false);
  });
});

describe("linha de apoio: categoria → conta → data", () => {
  it("junta as três partes nessa ordem", () => {
    const partes = supportLineParts({
      tx: tx(),
      categoryName: "Alimentação",
      account: cartao,
      showOrigin: true,
    });
    expect(partes).toEqual(["Alimentação", "Ultravioleta ····1234", "28 jul"]);
    expect(partes.join(SUPPORT_SEPARATOR)).toBe(
      "Alimentação · Ultravioleta ····1234 · 28 jul",
    );
  });

  it("sem categoria a resposta é escrita, não um buraco", () => {
    expect(supportLineParts({ tx: tx() })).toEqual(["Sem categoria", "28 jul"]);
    expect(supportLineParts({ tx: tx(), categoryName: "   " })[0]).toBe(
      "Sem categoria",
    );
  });

  it("a categoria sai quando já está no contêiner (chip do grupo)", () => {
    expect(supportLineParts({ tx: tx(), showCategory: false })).toEqual([
      "28 jul",
    ]);
  });

  it("a conta só entra quando a tela mostra origem E a conta foi resolvida", () => {
    // Sem conta mapeada a origem vira selo, não texto — 1.600 linhas
    // repetindo "Origem não informada" diriam a mesma coisa 1.600 vezes
    expect(
      supportLineParts({ tx: tx(), categoryName: "Lazer", account: cartao }),
    ).toEqual(["Lazer", "28 jul"]);
    expect(
      supportLineParts({ tx: tx(), categoryName: "Lazer", showOrigin: true }),
    ).toEqual(["Lazer", "28 jul"]);
  });
});

describe("selos da linha", () => {
  it("fixture mínima não tem selo nenhum", () => {
    expect(rowBadges(minima)).toEqual([]);
  });

  it("o que pede ação vem primeiro e é o único em aviso; as marcas são neutras", () => {
    const selos = rowBadges(
      tx({
        reviewStatus: "SUGGESTED",
        ignored: true,
        internalTransfer: true,
        familyTransfer: true,
        refunded: true,
      }),
    );
    expect(selos.map((s) => s.key)).toEqual([
      "pending",
      "ignored",
      "internal",
      "family",
      "refunded",
    ]);
    expect(selos.map((s) => s.label)).toEqual([
      "Revisar",
      "Ignorada",
      "Entre contas",
      "Na casa",
      "Estornada",
    ]);
    expect(selos.filter((s) => s.tone === "warning").map((s) => s.key)).toEqual([
      "pending",
    ]);
  });

  it("cada selo sabe como é falado", () => {
    const [pendente] = rowBadges(tx({ reviewStatus: "UNCATEGORIZED" }));
    expect(pendente.spoken).toBe("aguardando revisão");
  });
});

describe("o que o leitor de tela ouve", () => {
  it("preserva as frases que as três telas já falavam, numa ordem só", () => {
    const fala = spokenLabel({
      tx: tx({
        displayAlias: "Delivery",
        reviewStatus: "SUGGESTED",
        accountId: cartao.id,
      }),
      categoryName: "Alimentação",
      account: cartao,
      showOrigin: true,
      member: { memberName: "Ana", isMe: false },
    });

    expect(fala).toBe(
      `Delivery, no banco: IFOOD *REST, 28 jul, saída de ${formatBRL(89.9)}, Alimentação, origem Ultravioleta ····1234, aguardando revisão, lançamento de Ana. Abrir detalhes e apelido`,
    );
  });

  it("a voz do cartão diz compra, e a linha do próprio dono diz 'seu'", () => {
    const fala = spokenLabel({
      tx: tx(),
      voice: "card",
      member: { memberName: "Eu", isMe: true },
    });
    expect(fala).toContain(`compra de ${formatBRL(89.9)}`);
    expect(fala).toContain("lançamento seu");
  });

  it("sem categoria e sem origem, as ausências são ditas em vez de caladas", () => {
    const fala = spokenLabel({ tx: tx(), showOrigin: true });
    expect(fala).toContain("sem categoria");
    expect(fala).toContain("origem não informada");
  });

  it("linha de outra pessoa não promete abrir detalhes", () => {
    const fala = spokenLabel({ tx: tx(), interactive: false });
    expect(fala).not.toContain("Abrir detalhes");
    expect(fala.endsWith("Sem categoria") || fala.endsWith("sem categoria")).toBe(
      true,
    );
  });

  it("fixture mínima fala sem quebrar", () => {
    expect(spokenLabel({ tx: minima })).toBe(
      `SUPERMERCADO SERO, 10 ago, saída de ${formatBRL(194.99)}, sem categoria. Abrir detalhes e apelido`,
    );
  });
});
