import fs from "fs";
import path from "path";

/**
 * EC-230 — o âmbar tem orçamento.
 *
 * O accent é a cor da AÇÃO. Quando tudo é destaque, nada é: uma tela com nove
 * superfícies em âmbar não tem ênfase nenhuma, só barulho — e o olho perde a
 * referência de "onde eu toco".
 *
 * <b>O que se conta, e por que essa escolha.</b> A primeira versão deste teste
 * contava toda menção ao accent e reprovou cinco telas. Estava errado: um
 * botão é ícone + texto + fundo + borda, quatro menções e <b>um</b> elemento.
 * Contar menção pune quem desenha um botão completo.
 *
 * O que shouta é a <b>superfície</b> — o retângulo pintado de âmbar. Por isso
 * a conta é só de {@code backgroundColor} accent e {@code bg-accent}: ela
 * mede blocos, que é a unidade da regra ("no máximo um elemento accent por
 * bloco visível").
 *
 * O sistema visual do concorrente foi medido pixel a pixel no tour e usa o
 * verde-limão `#cfff04` exatamente assim: poucas superfícies, sempre no que
 * se toca.
 */
describe("Orçamento do accent", () => {
  const RAIZ = path.resolve(__dirname, "..", "..");

  /**
   * Teto de superfícies âmbar por tela.
   *
   * Cinco: é onde a distribuição real do app está hoje — a maioria usa duas a
   * quatro. O teto trava o crescimento sem forçar refatoração que ninguém
   * pediu.
   */
  const TETO = 5;

  /**
   * As telas que já nasceram acima do teto, com o número EXATO de hoje.
   *
   * <p>Catraca, não perdão: o número é exato, então acrescentar uma superfície
   * quebra o teste. E baixar também quebra — de propósito, porque quem
   * melhorou a tela tem de vir aqui baixar o número e ver a dívida encolher.
   *
   * <p>São as duas telas mais densas do app, as duas de formulário longo. A
   * dívida está nomeada em vez de escondida atrás de um teto frouxo.
   */
  const CATRACA: Record<string, number> = {
    "screens/Family.tsx": 9,
    "screens/IncomeSettings.tsx": 8,
  };

  /** Onde o accent é definido ou é a própria identidade da marca. */
  const ISENTOS = [
    "components/BrandGradient.tsx",
    "components/Skeleton.tsx",
    "components/AssistantFAB.tsx",
  ];

  const SUPERFICIE = /backgroundColor:\s*t\.accent\.\w+|\bbg-accent\w*\b/g;

  const arquivos: string[] = [];
  const varrer = (dir: string) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const completo = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        if (entrada.name === "__tests__" || entrada.name === "node_modules") continue;
        varrer(completo);
      } else if (/\.tsx?$/.test(entrada.name)) {
        arquivos.push(completo);
      }
    }
  };
  varrer(path.join(RAIZ, "screens"));
  varrer(path.join(RAIZ, "components"));

  const superficiesDe = (arquivo: string) => {
    const fonte = fs
      .readFileSync(arquivo, "utf8")
      // Comentário citando o accent é documentação, não pintura
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/(^|[^:])\/\/.*$/gm, "$1");
    return (fonte.match(SUPERFICIE) ?? []).length;
  };

  const nomeDe = (arquivo: string) =>
    path.relative(RAIZ, arquivo).replace(/\\/g, "/");

  it("nenhuma tela nova vira um paredão âmbar", () => {
    const estourados = arquivos
      .map((arquivo) => ({ nome: nomeDe(arquivo), usos: superficiesDe(arquivo) }))
      .filter((item) => !ISENTOS.includes(item.nome))
      .filter((item) => !(item.nome in CATRACA))
      .filter((item) => item.usos > TETO)
      .map((item) => `${item.nome} (${item.usos} superfícies)`);

    expect(estourados).toEqual([]);
  });

  it("a dívida nomeada não cresce — e quando encolher, encolhe aqui também", () => {
    const fora: string[] = [];
    for (const [nome, esperado] of Object.entries(CATRACA)) {
      const usos = superficiesDe(path.join(RAIZ, nome));
      if (usos !== esperado) fora.push(`${nome}: ${esperado} → ${usos}`);
    }

    expect(fora).toEqual([]);
  });

  it("a catraca é dívida, não teto novo: toda entrada dela está ACIMA do teto", () => {
    // Entrada abaixo do teto é entrada esquecida na lista
    for (const esperado of Object.values(CATRACA)) {
      expect(esperado).toBeGreaterThan(TETO);
    }
  });

  it("a varredura enxerga arquivos de verdade", () => {
    expect(arquivos.length).toBeGreaterThan(40);
  });
});
