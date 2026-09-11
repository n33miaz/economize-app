import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { SHEET_PADDING, spacing } from "../ds";

/**
 * O respiro das folhas é cobrado aqui, e não na revisão.
 *
 * O que motivou: o `CustomModal` entrega só a superfície, e quem desenha o
 * conteúdo é que precisa afastá-lo das bordas. Como isso era combinado de
 * cabeça, três telas copiaram o mesmo objeto como constante local — e a folha
 * que não copiou, a oferta de biometria, abria com o texto e os dois botões
 * colados nas laterais. Foi assim que apareceu no aparelho.
 *
 * Não é um teste de aparência: ele não diz quantos pixels a folha merece. Ele
 * diz que uma folha nova não pode nascer sem afastamento nenhum.
 */

const RAIZ = join(__dirname, "..", "..");
const EXTENSOES = [".ts", ".tsx"];

/**
 * Janela em caracteres depois da abertura do `<CustomModal>` onde o respiro
 * tem de aparecer. Cobre o padrão do app — o contêiner é o primeiro filho —
 * com folga para um `{condição ? (` no meio, e ainda é curta o bastante para
 * não aceitar um afastamento que só existe lá no fundo do conteúdo.
 */
const JANELA = 500;

/**
 * Formas aceitas de declarar o afastamento. `{null}` entra porque várias
 * folhas abrem vazias enquanto o dado não chegou — não há o que afastar.
 */
const RESPIRO = [
  /SHEET_PADDING/,
  /padding/,
  // o `contentContainerClassName` do ScrollView entra pelo C maiúsculo
  /[Cc]lassName="[^"]*\bpx?-\d/,
  /\{null\}/,
];

function arquivosDeCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      // o próprio teste escreve `<CustomModal` ao explicar a regra
      return nome === "__tests__" ? [] : arquivosDeCodigo(caminho);
    }
    return EXTENSOES.some((ext) => nome.endsWith(ext)) ? [caminho] : [];
  });
}

function relativo(caminho: string): string {
  return `src/${caminho.slice(RAIZ.length + 1).split("\\").join("/")}`;
}

describe("respiro das folhas", () => {
  const codigo = arquivosDeCodigo(RAIZ).map((caminho) => ({
    arquivo: relativo(caminho),
    conteudo: readFileSync(caminho, "utf8"),
  }));

  it("toda folha do CustomModal afasta o conteúdo das bordas", () => {
    const coladas: string[] = [];

    for (const { arquivo, conteudo } of codigo) {
      if (arquivo === "src/components/CustomModal.tsx") continue;

      for (const achado of conteudo.matchAll(/<CustomModal[\s>]/g)) {
        const inicio = achado.index ?? 0;
        const trecho = conteudo.slice(inicio, inicio + JANELA);
        if (RESPIRO.some((forma) => forma.test(trecho))) continue;
        coladas.push(`${arquivo}:${conteudo.slice(0, inicio).split("\n").length}`);
      }
    }

    expect(coladas).toEqual([]);
  });

  it("ninguém redeclara o respiro por conta própria", () => {
    // Foi assim que a divergência apareceu: três cópias locais idênticas, e a
    // folha que não copiou ficou sem nada
    const copias = codigo
      // o `ds.ts` é quem DECLARA o token; cobrá-lo contra si mesmo é circular
      .filter(({ arquivo }) => arquivo !== "src/theme/ds.ts")
      .filter(({ conteudo }) => /const SHEET_PADDING\s*=/.test(conteudo))
      .map(({ arquivo }) => arquivo);

    expect(copias).toEqual([]);
  });

  it("o token continua sendo feito de degraus declarados da escala", () => {
    const degraus = new Set<number>(Object.values(spacing));
    for (const valor of Object.values(SHEET_PADDING)) {
      expect(degraus.has(valor)).toBe(true);
    }
  });
});
