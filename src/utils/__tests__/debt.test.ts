import { debtKindLabel, debtKindMeaning, describeInstallment } from "../debt";

import type { DebtKind } from "../../services/api";

const TIPOS: DebtKind[] = [
  "FINANCING",
  "INSTALLMENT",
  "CONSORTIUM",
  "LOAN",
  "REVOLVING",
];

describe("rótulos de dívida", () => {
  it("cobre todos os tipos com nome e significado", () => {
    for (const kind of TIPOS) {
      expect(debtKindLabel(kind).length).toBeGreaterThan(0);
      // o rótulo sozinho não ensina nada; a frase é a parte que faz a
      // separação valer alguma coisa
      expect(debtKindMeaning(kind).length).toBeGreaterThan(20);
    }
  });

  it("explica o que quase ninguém sabe sobre consórcio e empréstimo", () => {
    expect(debtKindMeaning("CONSORTIUM")).toContain("não é compra");
    expect(debtKindMeaning("LOAN")).toContain("não é receita");
  });
});

describe("describeInstallment", () => {
  it("diz onde estamos e quanto falta", () => {
    expect(
      describeInstallment({ installment: 7, total: 48, remaining: 41 }),
    ).toBe("Parcela 7 de 48 · faltam 41");
  });

  it("concorda o singular", () => {
    expect(
      describeInstallment({ installment: 47, total: 48, remaining: 1 }),
    ).toBe("Parcela 47 de 48 · falta 1");
  });

  it("a última tem frase própria — é a boa notícia da lista", () => {
    expect(
      describeInstallment({ installment: 48, total: 48, remaining: 0 }),
    ).toBe("Parcela 48 de 48 · é a última");
  });

  it("sem posição informada não inventa prazo", () => {
    // inventar a parcela daria a impressão de um prazo que ninguém apurou
    expect(
      describeInstallment({ installment: null, total: null, remaining: null }),
    ).toBeNull();
    expect(
      describeInstallment({ installment: 3, total: null, remaining: null }),
    ).toBeNull();
  });

  it("sem o restante calculado ainda mostra a posição", () => {
    expect(
      describeInstallment({ installment: 3, total: 12, remaining: null }),
    ).toBe("Parcela 3 de 12");
  });
});
