import fs from "fs";
import path from "path";

import { SHEET_TITLE } from "../ds";

/**
 * O título de uma folha é 18/700, e nada dentro de uma folha é maior que ele.
 *
 * <p>Escolha 11 do comparador de 16/09. Antes dela as folhas tinham títulos
 * de 16, 18 e 20: todas abrem pelo mesmo gesto e se empilham na mesma
 * superfície, então a diferença não lia como hierarquia, lia como descuido.
 *
 * <p>A varredura de fonte é o que impede a volta. Um token só não impede
 * nada: o `SHEET_PADDING` existia e três telas copiaram o objeto à mão, e a
 * que não copiou abriu com o texto colado nas bordas. O que fecha a classe do
 * bug é ninguém conseguir escrever um número maior sem esta suíte reclamar.
 */
const PASTA = path.join(__dirname, "..", "..", "components");

const arquivosDeFolha = () =>
  fs
    .readdirSync(PASTA)
    .filter(
      (nome) =>
        nome.endsWith("Sheet.tsx") ||
        nome === "ConfirmDialog.tsx" ||
        nome === "BiometricPrompt.tsx",
    );

describe("título de folha", () => {
  it("o token é o 18/700 que o dono escolheu", () => {
    expect(SHEET_TITLE).toEqual({
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "700",
    });
  });

  it("existem folhas para varrer", () => {
    // Sem isto, um `readdir` que devolvesse vazio (pasta renomeada) deixaria
    // os testes abaixo verdes sem ter olhado nada
    expect(arquivosDeFolha().length).toBeGreaterThanOrEqual(15);
  });

  it("nenhuma folha escreve texto maior que o título", () => {
    const grandes = arquivosDeFolha().flatMap((nome) => {
      const fonte = fs.readFileSync(path.join(PASTA, nome), "utf8");
      return Array.from(fonte.matchAll(/fontSize: (\d+)/g))
        .map(([, valor]) => Number(valor))
        .filter((valor) => valor > SHEET_TITLE.fontSize)
        .map((valor) => `${nome}: ${valor}`);
    });

    expect(grandes).toEqual([]);
  });

  /**
   * As quatro exceções, e por que são exceções.
   *
   * <p>Três delas (`BudgetSheet`, `InvoiceReserveSheet`,
   * `WishContributionSheet`) são o CAMPO onde a pessoa digita um valor em
   * reais, não um título: 18/700 ali é o tamanho do dinheiro que ela está
   * escrevendo. A quarta (`PremiumOfferSheet`) é o preço, com
   * `tabular-nums`. Trocar o estilo deles pelo token do título deixaria a
   * tela idêntica e a intenção errada — e no dia em que o título mudar de
   * tamanho, o campo de valor iria junto sem ninguém pedir.
   *
   * <p>Estes três campos são a MESMA caixa copiada três vezes (mesmo peso,
   * mesma borda, mesmo raio). Vale um token próprio, mas é outro assunto:
   * não é o que o dono escolheu na tela 11.
   */
  const NAO_SAO_TITULOS = [
    "BudgetSheet.tsx",
    "InvoiceReserveSheet.tsx",
    "WishContributionSheet.tsx",
    "PremiumOfferSheet.tsx",
  ];

  it("nenhuma folha NOVA redesenha o título à mão", () => {
    // Espaços colapsados: o prettier reparte o objeto de estilo em uma ou em
    // cinco linhas dependendo do comprimento, e a busca não pode depender disso
    const copias = arquivosDeFolha()
      .filter((nome) => !NAO_SAO_TITULOS.includes(nome))
      .filter((nome) => {
        const fonte = fs
          .readFileSync(path.join(PASTA, nome), "utf8")
          .replace(/\s+/g, " ");
        return (
          /fontSize: 18, fontWeight: "700"/.test(fonte) ||
          /fontWeight: "700", fontSize: 18/.test(fonte)
        );
      });

    expect(copias).toEqual([]);
  });
});
