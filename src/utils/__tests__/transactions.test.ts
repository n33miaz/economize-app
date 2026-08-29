import type { BankTransaction, ReviewGroup } from "../../services/api";
import {
  TRANSACTION_ALIAS_MAX_LENGTH,
  aliasChanged,
  applyTransactionToGroups,
  categorizedByLabel,
  describeAliasFailure,
  isRenamed,
  replaceTransaction,
  reviewGroupKey,
  sanitizeTransactionAlias,
  transactionDisplayName,
  transactionOriginalName,
  validateTransactionAlias,
} from "../transactions";

const tx = (overrides: Partial<BankTransaction> = {}): BankTransaction => ({
  id: "t1",
  transactionId: "bank-1",
  type: "DEBIT",
  amount: -99.9,
  description: "SMARTFIT ACADEMIA 01/03",
  originalDescription: "SMARTFIT ACADEMIA 01/03",
  displayAlias: null,
  date: "2026-08-12T00:00:00Z",
  categoryId: null,
  reviewStatus: "SUGGESTED",
  categorizedBy: "KEYWORD",
  confidence: 0.8,
  normalizedDescription: "smartfit academia",
  uploadId: "u1",
  accountId: null,
  ...overrides,
});

const group = (overrides: Partial<ReviewGroup> = {}): ReviewGroup => ({
  normalizedDescription: "smartfit academia",
  sampleDescription: "SMARTFIT ACADEMIA 01/03",
  suggestedCategoryId: "cat-1",
  categorizedBy: "KEYWORD",
  confidence: 0.8,
  totalAmount: -99.9,
  transactions: [tx()],
  ...overrides,
});

describe("sanitizeTransactionAlias", () => {
  it("mantém texto normal intacto", () => {
    expect(sanitizeTransactionAlias("Academia")).toBe("Academia");
  });

  it("null e vazio limpam o apelido", () => {
    expect(sanitizeTransactionAlias(null)).toBeNull();
    expect(sanitizeTransactionAlias(undefined)).toBeNull();
    expect(sanitizeTransactionAlias("")).toBeNull();
    expect(sanitizeTransactionAlias("    ")).toBeNull();
  });

  it("achata quebras de linha e tabulações em espaço", () => {
    expect(sanitizeTransactionAlias("Aca\ndemia\tdo\rbairro")).toBe(
      "Aca demia do bairro",
    );
  });

  it("troca NUL e controles por espaço", () => {
    const nul = String.fromCharCode(0);
    const unitSeparator = String.fromCharCode(0x1f);
    expect(sanitizeTransactionAlias(`Aca${nul}demia`)).toBe("Aca demia");
    expect(sanitizeTransactionAlias(`Aca${unitSeparator}demia`)).toBe(
      "Aca demia",
    );
  });

  it("apaga invisíveis de largura zero em vez de virar espaço", () => {
    const zeroWidth = String.fromCharCode(0x200b);
    const bom = String.fromCharCode(0xfeff);
    const softHyphen = String.fromCharCode(0x00ad);
    expect(sanitizeTransactionAlias(`Aca${zeroWidth}demia`)).toBe("Academia");
    expect(sanitizeTransactionAlias(`${bom}Academia`)).toBe("Academia");
    expect(sanitizeTransactionAlias(`Aca${softHyphen}demia`)).toBe("Academia");
  });

  it("colapsa espaços repetidos e apara as pontas", () => {
    const nbsp = String.fromCharCode(0x00a0);
    expect(sanitizeTransactionAlias("  Academia    do   bairro  ")).toBe(
      "Academia do bairro",
    );
    expect(sanitizeTransactionAlias(`Academia${nbsp}${nbsp}bairro`)).toBe(
      "Academia bairro",
    );
  });

  it("texto que só tinha invisível vira null (limpa o apelido)", () => {
    expect(
      sanitizeTransactionAlias(String.fromCharCode(0x200b, 0x200b)),
    ).toBeNull();
  });
});

describe("validateTransactionAlias", () => {
  it("aceita até o limite do contrato", () => {
    const alias = "a".repeat(TRANSACTION_ALIAS_MAX_LENGTH);
    expect(validateTransactionAlias(alias)).toEqual({ ok: true, value: alias });
  });

  it("recusa acima do limite medindo o texto CRU, como o @Size do servidor", () => {
    // 82 crus que saneariam para 78: o servidor recusa assim mesmo, porque
    // valida antes de sanear — o cliente precisa recusar igual
    const raw = "a".repeat(78) + String.fromCharCode(0x200b, 0x200b) + "  ";
    expect(raw.length).toBeGreaterThan(TRANSACTION_ALIAS_MAX_LENGTH);
    const result = validateTransactionAlias(raw);
    expect(result.ok).toBe(false);
  });

  it("devolve null quando o texto sobra em branco", () => {
    expect(validateTransactionAlias("   ")).toEqual({ ok: true, value: null });
  });
});

describe("aliasChanged", () => {
  it("detecta troca e ignora repetição", () => {
    expect(aliasChanged(null, "Academia")).toBe(true);
    expect(aliasChanged("Academia", null)).toBe(true);
    expect(aliasChanged("Academia", "Academia")).toBe(false);
    expect(aliasChanged(null, null)).toBe(false);
  });
});

describe("nomes", () => {
  it("exibe o apelido quando existe e o texto do banco quando não", () => {
    expect(transactionDisplayName(tx())).toBe("SMARTFIT ACADEMIA 01/03");
    expect(
      transactionDisplayName(
        tx({ description: "Academia", displayAlias: "Academia" }),
      ),
    ).toBe("Academia");
  });

  it("o texto do banco sobrevive ao apelido", () => {
    const renamed = tx({ description: "Academia", displayAlias: "Academia" });
    expect(transactionOriginalName(renamed)).toBe("SMARTFIT ACADEMIA 01/03");
    expect(isRenamed(renamed)).toBe(true);
    expect(isRenamed(tx())).toBe(false);
  });

  it("apelido só de espaços não conta como renomeada", () => {
    expect(isRenamed(tx({ displayAlias: "   " }))).toBe(false);
  });
});

describe("reviewGroupKey", () => {
  it("usa a descrição normalizada mais a categoria sugerida", () => {
    expect(reviewGroupKey(group())).toBe("smartfit academia|cat-1");
  });

  it("separa grupos da mesma loja com sugestões diferentes", () => {
    expect(reviewGroupKey(group({ suggestedCategoryId: "cat-2" }))).not.toBe(
      reviewGroupKey(group()),
    );
  });

  it("NÃO muda quando o usuário apelida a transação", () => {
    const antes = reviewGroupKey(group({ normalizedDescription: null }));
    const depois = reviewGroupKey(
      group({
        normalizedDescription: null,
        // o servidor devolve o texto de exibição aqui — ele não pode virar chave
        sampleDescription: "Academia",
        transactions: [tx({ description: "Academia", displayAlias: "Academia" })],
      }),
    );
    expect(depois).toBe(antes);
  });

  it("cai no id da transação quando não há descrição alguma", () => {
    const key = reviewGroupKey(
      group({
        normalizedDescription: null,
        sampleDescription: null,
        transactions: [
          tx({ id: "t9", description: "", originalDescription: "" }),
        ],
      }),
    );
    expect(key).toBe("Sem descrição|cat-1");
  });
});

describe("replaceTransaction", () => {
  it("troca só a transação alvo e preserva a ordem", () => {
    const list = [tx({ id: "a" }), tx({ id: "b" }), tx({ id: "c" })];
    const updated = tx({ id: "b", displayAlias: "Academia" });
    const next = replaceTransaction(list, updated);
    expect(next.map((item) => item.id)).toEqual(["a", "b", "c"]);
    expect(next[1].displayAlias).toBe("Academia");
  });

  it("devolve a mesma lista quando o id não está nela (sem re-render à toa)", () => {
    const list = [tx({ id: "a" })];
    expect(replaceTransaction(list, tx({ id: "z" }))).toBe(list);
  });
});

describe("applyTransactionToGroups", () => {
  it("atualiza o título do grupo quando a renomeada é a primeira", () => {
    const groups = [group({ transactions: [tx({ id: "a" }), tx({ id: "b" })] })];
    const updated = tx({
      id: "a",
      description: "Academia",
      displayAlias: "Academia",
    });
    const next = applyTransactionToGroups(groups, updated);
    expect(next[0].sampleDescription).toBe("Academia");
    expect(next[0].transactions[0].displayAlias).toBe("Academia");
  });

  it("não mexe no título quando a renomeada não é a primeira", () => {
    const groups = [group({ transactions: [tx({ id: "a" }), tx({ id: "b" })] })];
    const next = applyTransactionToGroups(
      groups,
      tx({ id: "b", description: "Academia", displayAlias: "Academia" }),
    );
    expect(next[0].sampleDescription).toBe("SMARTFIT ACADEMIA 01/03");
    expect(next[0].transactions[1].displayAlias).toBe("Academia");
  });

  it("a chave do grupo continua a mesma depois do rename", () => {
    const groups = [group()];
    const next = applyTransactionToGroups(
      groups,
      tx({ id: "t1", description: "Academia", displayAlias: "Academia" }),
    );
    expect(reviewGroupKey(next[0])).toBe(reviewGroupKey(groups[0]));
  });

  it("devolve a mesma lista quando nada casou", () => {
    const groups = [group()];
    expect(applyTransactionToGroups(groups, tx({ id: "zzz" }))).toBe(groups);
  });
});

describe("describeAliasFailure", () => {
  it("400 fala do teto em português, sem vazar o nome do campo da API", () => {
    const message = describeAliasFailure(400);
    expect(message).toContain("80");
    // O servidor devolve "displayAlias: ..." no detail; isso é vocabulário de
    // API e não pode chegar à tela
    expect(message).not.toContain("displayAlias");
  });

  it("404 não inventa 'sem permissão' — a API não vaza existência", () => {
    const message = describeAliasFailure(404);
    expect(message).toContain("Não encontramos");
    expect(message.toLowerCase()).not.toContain("permiss");
  });

  it("401 e 403 falam de sessão", () => {
    expect(describeAliasFailure(401)).toContain("sessão");
    expect(describeAliasFailure(403)).toContain("sessão");
  });

  it("falha sem resposta cai na mensagem genérica, nunca em silêncio", () => {
    expect(describeAliasFailure(null)).toContain("Não foi possível");
  });
});

describe("categorizedByLabel", () => {
  it("nomeia cada origem do motor", () => {
    expect(categorizedByLabel("USER")).toContain("você");
    expect(categorizedByLabel("LEARNED_RULE")).toBe("regra sua");
    expect(categorizedByLabel("AI")).toContain("IA");
    expect(categorizedByLabel(null)).toBe("sem origem registrada");
  });
});
