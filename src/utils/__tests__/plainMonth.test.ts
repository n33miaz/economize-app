import { plainHeaviest, plainVerdict } from "../plainMonth";

import type { CategorySlice } from "../../services/api";

const fatia = (name: string, expenseTotal: number): CategorySlice => ({
  categoryId: name,
  name,
  groupName: null,
  color: null,
  icon: null,
  systemKey: null,
  parentSystemKey: null,
  system: false,
  expenseTotal,
  incomeTotal: 0,
  txCount: 1,
  previousExpenseTotal: 0,
  expenseDeltaPct: null,
  children: [],
});

// `\s` e não espaço literal: o Intl separa "R$" do número com espaço não
// separável, convenção já adotada em accounts.test.ts
describe("plainVerdict", () => {
  it("diz que sobrou, com a palavra que a pessoa usa", () => {
    expect(plainVerdict(340, false)).toMatch(
      /^Sobrou R\$\s340,00 este mês\.$/,
    );
  });

  it("no vermelho não suaviza nem esconde o número", () => {
    // Poupar o usuário do valor seria decidir por ele que ele não aguenta a
    // informação que veio buscar
    expect(plainVerdict(-210, false)).toMatch(
      /^Faltaram R\$\s210,00 este mês: você gastou mais do que recebeu\.$/,
    );
  });

  it("empate tem frase própria — não é nem sobra nem falta", () => {
    expect(plainVerdict(0, false)).toBe(
      "Você gastou exatamente o que recebeu este mês.",
    );
  });

  it("em modo janela fala de ciclo, porque não é o mês do calendário", () => {
    expect(plainVerdict(340, true)).toMatch(
      /^Sobrou R\$\s340,00 neste ciclo\.$/,
    );
  });
});

describe("plainHeaviest", () => {
  it("aponta a categoria que mais pesou, sem porcentagem", () => {
    const frase = plainHeaviest([
      fatia("Mercado", 1240),
      fatia("Transporte", 380),
    ]);
    expect(frase).toMatch(
      /^O que mais pesou foi Mercado, com R\$\s1\.240,00\.$/,
    );
  });

  it("ignora a ordem em que as fatias chegaram", () => {
    const frase = plainHeaviest([
      fatia("Transporte", 380),
      fatia("Mercado", 1240),
    ]);
    expect(frase).toContain("Mercado");
  });

  it("sem categoria não vira nome de categoria", () => {
    // Antes da revisão a maior fatia é justamente essa; "o que mais pesou foi
    // Sem categoria" não é frase que alguém diz
    const semCategoria = { ...fatia("Sem categoria", 5830), categoryId: null };
    expect(plainHeaviest([semCategoria])).toMatch(
      /^R\$\s5\.830,00 das saídas ainda estão sem categoria\.$/,
    );
  });

  it("mês sem saída não inventa uma campeã", () => {
    expect(plainHeaviest([])).toBeNull();
    expect(plainHeaviest([fatia("Mercado", 0)])).toBeNull();
  });
});
