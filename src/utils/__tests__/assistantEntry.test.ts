import fs from "fs";
import path from "path";

import {
  ASSISTANT_ORIGINS,
  assistantLabel,
  assistantSuggestions,
} from "../assistantEntry";

/**
 * EC-201 — o assistente é porta, não aba.
 *
 * O concorrente trata o chat como uma aba: caixa em branco, sem ideia do que
 * estava na tela um segundo antes. Foi assim que ele respondeu "Sem gastos
 * por categoria" com a home mostrando R$ 810,61 em cinco categorias.
 */
describe("Porta do assistente", () => {
  it("cada origem sugere perguntas da PRÓPRIA tela", () => {
    expect(assistantSuggestions("fatura")).toContain(
      "Quanto da minha fatura é parcelamento?",
    );
    expect(assistantSuggestions("recorrencias")).toContain(
      "Quanto eu pago por mês em assinaturas?",
    );
  });

  it("o rótulo diz sobre O QUÊ se vai falar", () => {
    // "Fale com o Nino" em toda parte é o mesmo botão genérico de sempre
    expect(assistantLabel("fatura")).toBe("Pergunte sobre a fatura");
    expect(assistantLabel("analise")).toBe("Pergunte sobre suas categorias");
  });

  it("sem origem, cai no genérico em vez de quebrar", () => {
    expect(assistantLabel(undefined)).toBe("Fale com o Nino");
    expect(assistantSuggestions(undefined).length).toBeGreaterThan(0);
  });

  it("TODA origem tem rótulo e exatamente três sugestões", () => {
    // Três, nunca mais: uma lista longa vira menu, e menu é o contrário de
    // conversa
    for (const origem of ASSISTANT_ORIGINS) {
      expect(assistantLabel(origem)).not.toBe("Fale com o Nino");
      expect(assistantSuggestions(origem)).toHaveLength(3);
    }
  });

  it("nenhuma sugestão é repetida entre telas diferentes", () => {
    // Sugestão repetida denuncia que a origem não mudou nada
    const todas = ASSISTANT_ORIGINS.flatMap((origem) => assistantSuggestions(origem));

    expect(new Set(todas).size).toBe(todas.length);
  });

  it("toda sugestão é uma pergunta ou um pedido, nunca um rótulo solto", () => {
    for (const origem of ASSISTANT_ORIGINS) {
      for (const sugestao of assistantSuggestions(origem)) {
        expect(sugestao).toMatch(/[?.]$/);
        expect(sugestao.length).toBeGreaterThan(15);
      }
    }
  });
});

/**
 * A porta só é porta se estiver em toda parte. Este teste conta as telas que
 * a oferecem — sem ele, uma tela nova nasce sem saída para o assistente e
 * ninguém percebe.
 */
describe("A porta está nas telas", () => {
  const TELAS = path.resolve(__dirname, "..", "..", "screens");

  const comFab = fs
    .readdirSync(TELAS)
    .filter((nome) => nome.endsWith(".tsx"))
    .filter((nome) =>
      fs.readFileSync(path.join(TELAS, nome), "utf8").includes("<AssistantFAB"),
    );

  it("as telas de dinheiro têm a porta", () => {
    expect(comFab.length).toBeGreaterThanOrEqual(4);
  });

  it("quem tem a porta declara de onde ela abre", () => {
    // FAB sem origem é o botão genérico de volta
    const semOrigem = comFab.filter((nome) => {
      const fonte = fs.readFileSync(path.join(TELAS, nome), "utf8");
      // procura cada uso do FAB e exige origin= ou label= explícito
      return [...fonte.matchAll(/<AssistantFAB([^/>]*)\/?>/g)].some(
        (uso) => !uso[1].includes("origin") && !uso[1].includes("label"),
      );
    });

    expect(semOrigem).toEqual([]);
  });
});
