import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * EC-220 — uma leitura por pergunta.
 *
 * <p><b>A queixa que originou o ticket</b>, escrita no próprio código antes de
 * mim: <i>"o que se repete é a terceira leitura do mesmo dinheiro"</i>.
 * Finanças tem quatro abas irmãs, e cada uma soma o extrato de um jeito.
 *
 * <p><b>A prova que o ticket pede</b> é esta: <i>nenhum valor com o mesmo
 * rótulo em duas abas do mesmo nível</i>. Quando "Saldo" aparece em duas abas
 * vizinhas com números diferentes, o usuário não descobre qual está certo —
 * ele conclui que o app não sabe, e essa conclusão contamina todos os outros
 * números.
 *
 * <p><b>O que este teste NÃO faz.</b> Ele não reorganiza a navegação: juntar
 * ou separar abas é decisão de produto. Ele trava o que dá para medir — que a
 * duplicação de rótulo, hoje inexistente, não entre amanhã por um card novo
 * copiado de outra tela.
 */

const RAIZ = join(__dirname, "..");

/** As quatro abas irmãs de Finanças, no mesmo nível de navegação. */
const ABAS_IRMAS = [
  "Wallet.tsx",
  "BankIntegration.tsx",
  "Recurrences.tsx",
  "Investments.tsx",
] as const;

/**
 * O vocabulário de rótulo de DINHEIRO.
 *
 * <p>Só termos que nomeiam um total. Palavras de contexto ("neste mês",
 * "categoria") ficam de fora de propósito: elas podem e devem se repetir — o
 * que não pode repetir é o nome de um número.
 */
const ROTULOS_DE_DINHEIRO = [
  "Saldo",
  "Total",
  "Entradas",
  "Saídas",
  "Líquido",
  "Patrimônio",
  "Investido",
  "Aplicado",
  "Resgatado",
  "Rendimentos",
  "Compras",
  "Comprometido",
  "Disponível",
  "Guardado",
];

/**
 * Onde um rótulo pode estar: prop `label`, chave `label:` de um objeto de
 * métrica, ou texto direto entre tags.
 */
function rotulosDe(arquivo: string): Set<string> {
  const fonte = readFileSync(join(RAIZ, arquivo), "utf8")
    // Comentário citando um rótulo é documentação, não tela
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");

  const achados = new Set<string>();
  for (const termo of ROTULOS_DE_DINHEIRO) {
    // Como rótulo: entre aspas logo depois de `label`, ou como texto de um
    // elemento. A borda de palavra evita "Total" casando dentro de "Totalizar"
    const comoRotulo = new RegExp(`label[:=]\\s*"${termo}\\b[^"]*"`);
    const comoTexto = new RegExp(`>\\s*${termo}\\b[^<]{0,24}<`);
    if (comoRotulo.test(fonte) || comoTexto.test(fonte)) achados.add(termo);
  }
  return achados;
}

describe("Uma leitura por pergunta", () => {
  const porAba = new Map(ABAS_IRMAS.map((aba) => [aba, rotulosDe(aba)]));

  it("nenhum rótulo de dinheiro aparece em duas abas irmãs", () => {
    const colisoes: string[] = [];

    for (let i = 0; i < ABAS_IRMAS.length; i++) {
      for (let j = i + 1; j < ABAS_IRMAS.length; j++) {
        const a = ABAS_IRMAS[i];
        const b = ABAS_IRMAS[j];
        for (const termo of porAba.get(a)!) {
          if (porAba.get(b)!.has(termo)) {
            colisoes.push(`"${termo}" em ${a} e ${b}`);
          }
        }
      }
    }

    // Duas abas vizinhas com "Saldo" e números diferentes não fazem o usuário
    // escolher uma: fazem ele concluir que o app não sabe
    expect(colisoes).toEqual([]);
  });

  it("a varredura enxerga rótulo de verdade — senão ela não vale nada", () => {
    // Se a extração parar de funcionar (arquivo renomeado, padrão mudado), o
    // teste acima passaria lendo conjuntos vazios
    const total = [...porAba.values()].reduce((soma, set) => soma + set.size, 0);

    expect(total).toBeGreaterThan(0);
  });

  it("as quatro abas irmãs continuam existindo com esses nomes", () => {
    // Renomear uma aba sem atualizar esta lista faria a guarda vigiar um
    // arquivo que não é mais aba
    for (const aba of ABAS_IRMAS) {
      expect(() => readFileSync(join(RAIZ, aba), "utf8")).not.toThrow();
    }
  });
});
