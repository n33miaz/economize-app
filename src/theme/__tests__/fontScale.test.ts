import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { FONT_SIZES } from "../typography";

/**
 * A escala tipográfica é cobrada aqui, e não no olho de quem revisa.
 *
 * O que motivou: medido em 08/09/2026, o app usava **19 tamanhos de fonte**
 * enquanto o `typography.ts` declarava 11. Ninguém introduziu isso de propósito
 * — cada tela nasceu com o número que parecia certo naquele componente, e a
 * escala virou ficção. Um teste é o único jeito de a vigésima medida não entrar
 * de novo pela mesma porta.
 *
 * Não é um teste de aparência: ele não diz se 13 é melhor que 14. Ele diz que o
 * número usado tem de ser um dos que o time já decidiu.
 */

/**
 * Tamanho preso à GEOMETRIA de um contêiner, e não escolhido numa escala. Entrar
 * aqui exige o motivo escrito ao lado — é a mesma regra da lista de exceções da
 * auditoria de dependência.
 */
const AMARRADOS_A_CAIXA: Record<string, string> = {
  "src/screens/Profile.tsx":
    "iniciais dentro do avatar redondo: o corpo acompanha o diâmetro do círculo, " +
    "não a escala de texto",
  "src/screens/Family.tsx":
    "código do convite com letterSpacing 4: o corpo é o que faz os seis " +
    "caracteres caberem na largura do cartão",
};

const RAIZ = join(__dirname, "..", "..");
const EXTENSOES = [".ts", ".tsx"];

function arquivosDeCodigo(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome);
    if (statSync(caminho).isDirectory()) {
      // o próprio teste cita números fora da escala ao explicar o histórico
      return nome === "__tests__" ? [] : arquivosDeCodigo(caminho);
    }
    return EXTENSOES.some((ext) => nome.endsWith(ext)) ? [caminho] : [];
  });
}

function relativo(caminho: string): string {
  return `src/${caminho.slice(RAIZ.length + 1).split("\\").join("/")}`;
}

describe("escala tipográfica", () => {
  const permitidos = new Set<number>(FONT_SIZES);

  it("todo fontSize literal no app é um degrau da escala", () => {
    const foraDaEscala: string[] = [];

    for (const caminho of arquivosDeCodigo(RAIZ)) {
      const arquivo = relativo(caminho);
      // O tema é quem DECLARA a escala; cobrá-lo contra si mesmo é circular
      if (arquivo === "src/theme/typography.ts") continue;

      const conteudo = readFileSync(caminho, "utf8");
      for (const achado of conteudo.matchAll(/fontSize:\s*(\d+)/g)) {
        const tamanho = Number(achado[1]);
        if (permitidos.has(tamanho)) continue;
        if (AMARRADOS_A_CAIXA[arquivo]) continue;
        foraDaEscala.push(`${arquivo}: fontSize ${tamanho}`);
      }
    }

    expect(foraDaEscala).toEqual([]);
  });

  it("a escala é crescente e sem repetição", () => {
    const ordenada = [...FONT_SIZES].sort((a, b) => a - b);
    expect([...FONT_SIZES]).toEqual(ordenada);
    expect(new Set(FONT_SIZES).size).toBe(FONT_SIZES.length);
  });

  it("cada exceção nomeia um arquivo que existe e diz o porquê", () => {
    // Exceção que sobrevive ao arquivo que a motivou vira licença permanente
    for (const [arquivo, motivo] of Object.entries(AMARRADOS_A_CAIXA)) {
      expect(() => statSync(join(RAIZ, "..", arquivo))).not.toThrow();
      expect(motivo.length).toBeGreaterThan(30);
    }
  });
});
