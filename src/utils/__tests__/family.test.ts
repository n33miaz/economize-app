import {
  MEMBER_ALL,
  applyMemberFilter,
  describeShareScope,
  familyCategorySlices,
  familyRoleLabel,
  formatInviteCode,
  initialsOf,
  inviteValidityLabel,
  memberColorIndex,
  memberFilterOptions,
  normalizeInviteCode,
  resolveMemberFilter,
  shareScopeLabel,
  shareScopeSummary,
} from "../family";

import type {
  Category,
  FamilyCategoryTotal,
  FamilyShareScope,
  FamilyTransaction,
} from "../../services/api";

const ESCOPOS: FamilyShareScope[] = ["NONE", "TOTALS", "TRANSACTIONS"];

const linha = (memberId: string, memberName: string, id = memberId): FamilyTransaction =>
  ({
    id: `tx-${id}-${Math.random().toString(36).slice(2, 7)}`,
    transactionId: "ext-1",
    type: "DEBIT",
    amount: -10,
    description: "Mercado",
    date: "2026-07-10T12:00:00Z",
    categoryId: null,
    accountId: null,
    reviewStatus: "CONFIRMED",
    memberId,
    memberName,
  }) as FamilyTransaction;

describe("initialsOf", () => {
  it("usa o primeiro e o ÚLTIMO nome, não a preposição do meio", () => {
    expect(initialsOf("Maria da Silva")).toBe("MS");
  });

  it("nome de uma palavra dá uma letra", () => {
    expect(initialsOf("Ana")).toBe("A");
  });

  it("sem nome, o disco não fica em branco", () => {
    expect(initialsOf("")).toBe("?");
    expect(initialsOf(null)).toBe("?");
    expect(initialsOf(undefined)).toBe("?");
    expect(initialsOf("   ")).toBe("?");
  });
});

describe("memberColorIndex", () => {
  it("a cor segue a PESSOA: mesmo id, mesmo tom, sempre", () => {
    const primeiro = memberColorIndex("membro-abc", 6);
    expect(memberColorIndex("membro-abc", 6)).toBe(primeiro);
  });

  it("fica dentro da paleta", () => {
    for (const id of ["a", "bb", "membro-xyz", "0000"]) {
      const index = memberColorIndex(id, 6);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(6);
    }
  });

  it("paleta vazia não estoura", () => {
    expect(memberColorIndex("qualquer", 0)).toBe(0);
  });
});

describe("as três vozes do escopo", () => {
  it("todo escopo tem rótulo, resumo e explicação", () => {
    for (const escopo of ESCOPOS) {
      expect(shareScopeLabel(escopo).length).toBeGreaterThan(0);
      expect(shareScopeSummary(escopo).length).toBeGreaterThan(0);
      // A explicação é o que a pessoa lê ANTES de escolher: precisa dizer o
      // que a casa passa a ver, não repetir o nome da opção
      expect(describeShareScope(escopo).length).toBeGreaterThan(30);
    }
  });

  it("o escopo mais aberto avisa que o esconderijo continua valendo", () => {
    expect(describeShareScope("TRANSACTIONS")).toContain("esconder");
    expect(describeShareScope("NONE")).toContain("não vê");
  });

  it("papel na casa é dito em português", () => {
    expect(familyRoleLabel("OWNER").length).toBeGreaterThan(0);
    expect(familyRoleLabel("MEMBER").length).toBeGreaterThan(0);
  });
});

describe("código do convite", () => {
  it("corrige o que o WhatsApp estraga: caixa, espaço e traço", () => {
    expect(normalizeInviteCode(" abcd-efgh ")).toBe("ABCDEFGH");
  });

  it("0, 1, O e I caem fora: nenhum dos quatro existe no alfabeto", () => {
    // O alfabeto exclui o par ambíguo inteiro justamente para ele nunca
    // aparecer. Converter 0 em O seria trocar um caractere impossível por
    // outro impossível — e não há como adivinhar de qual letra foi o engano
    expect(normalizeInviteCode("N0RQ1KS5")).toBe("NRQKS5");
    expect(normalizeInviteCode("NOIRQKS5")).toBe("NRQKS5");
  });

  it("não passa do tamanho do código", () => {
    expect(normalizeInviteCode("ABCDEFGHJKLM")).toHaveLength(8);
  });

  it("descarta o que não é do alfabeto", () => {
    expect(normalizeInviteCode("AB@CD#EF")).toBe("ABCDEF");
  });

  it("exibe em dois blocos, para ler e ditar sem perder a posição", () => {
    expect(formatInviteCode("ABCDEFGH")).toBe("ABCD EFGH");
    expect(formatInviteCode("ABC")).toBe("ABC");
  });
});

describe("inviteValidityLabel", () => {
  const agora = new Date("2026-09-01T12:00:00Z");

  it("diz até quando vale", () => {
    expect(inviteValidityLabel("2026-09-08T12:00:00Z", agora)).toMatch(/Vale até/);
  });

  it("convite vencido é dito como vencido, não com data no passado", () => {
    expect(inviteValidityLabel("2026-08-31T12:00:00Z", agora)).toBe("Convite expirado");
  });

  it("data ilegível não vira 'Invalid Date' na tela", () => {
    expect(inviteValidityLabel("nao é data", agora)).toBe("Validade desconhecida");
  });
});

describe("familyCategorySlices", () => {
  const catalogo: Category[] = [
    {
      id: "c1",
      name: "Alimentação",
      groupName: "Casa",
      color: "#ff0000",
      icon: "utensils",
      systemKey: "FOOD",
      parentSystemKey: null,
      system: true,
    } as Category,
  ];
  const total = (over: Partial<FamilyCategoryTotal>): FamilyCategoryTotal =>
    ({
      categoryId: "c1",
      categoryName: "Alimentação",
      income: 0,
      expense: 500,
      txCount: 3,
      ...over,
    }) as FamilyCategoryTotal;

  it("veste a categoria conhecida com a cor e o ícone do catálogo", () => {
    const [slice] = familyCategorySlices([total({})], catalogo);

    expect(slice.color).toBe("#ff0000");
    expect(slice.systemKey).toBe("FOOD");
    expect(slice.expenseTotal).toBe(500);
  });

  it("categoria pessoal de outro membro fica neutra, mas mantém o nome", () => {
    // O nome vem garantido na resposta; o visual não precisa fingir que
    // conhece uma categoria que é da outra pessoa
    const [slice] = familyCategorySlices(
      [total({ categoryId: "outra", categoryName: "Pet do parceiro" })],
      catalogo,
    );

    expect(slice.name).toBe("Pet do parceiro");
    expect(slice.color).toBeNull();
    expect(slice.systemKey).toBeNull();
  });

  it("não inventa comparação com o período anterior", () => {
    // A casa não compara com o ciclo passado nesta versão: delta nulo é o que
    // impede a linha de escrever "novo" ou uma variação que ninguém calculou
    const [slice] = familyCategorySlices([total({})], catalogo);

    expect(slice.previousExpenseTotal).toBe(0);
    expect(slice.expenseDeltaPct).toBeNull();
  });
});

describe("filtro por membro no extrato da casa", () => {
  it("com uma pessoa só, a fileira não existe", () => {
    // Não há o que filtrar: dois chips para a mesma lista seriam decoração
    const opcoes = memberFilterOptions([linha("m1", "Ana"), linha("m1", "Ana", "b")]);

    expect(opcoes).toEqual([]);
  });

  it("um chip por pessoa COM linha, mais Todos, em ordem alfabética", () => {
    const opcoes = memberFilterOptions([
      linha("m2", "Bruno"),
      linha("m1", "Ana"),
      linha("m1", "Ana", "c"),
    ]);

    expect(opcoes.map((o) => o.label)).toEqual(["Todos", "Ana", "Bruno"]);
    expect(opcoes[0].count).toBe(3);
    expect(opcoes.find((o) => o.label === "Ana")?.count).toBe(2);
  });

  it("quem mostra só totais não vira chip", () => {
    // Filtrar por alguém sem linha nenhuma daria lista vazia sem explicação
    const opcoes = memberFilterOptions([linha("m1", "Ana"), linha("m2", "Bruno")]);

    expect(opcoes.some((o) => o.key === "m3")).toBe(false);
  });

  it("Todos não filtra nada; a pessoa filtra só as dela", () => {
    const linhas = [linha("m1", "Ana"), linha("m2", "Bruno")];

    expect(applyMemberFilter(linhas, MEMBER_ALL)).toHaveLength(2);
    expect(applyMemberFilter(linhas, "m1")).toHaveLength(1);
    expect(applyMemberFilter(linhas, "m1")[0].memberName).toBe("Ana");
  });

  it("filtro de quem sumiu da lista volta para Todos", () => {
    // Sem isto a tela ficaria presa numa lista vazia, sem chip marcado
    const opcoes = memberFilterOptions([linha("m1", "Ana"), linha("m2", "Bruno")]);

    expect(resolveMemberFilter("m1", opcoes)).toBe("m1");
    expect(resolveMemberFilter("m9", opcoes)).toBe(MEMBER_ALL);
    expect(resolveMemberFilter(MEMBER_ALL, opcoes)).toBe(MEMBER_ALL);
  });

  it("sem fileira, qualquer filtro guardado vira Todos", () => {
    expect(resolveMemberFilter("m1", [])).toBe(MEMBER_ALL);
  });
});
