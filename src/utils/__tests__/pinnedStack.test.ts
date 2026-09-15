import fs from "fs";
import path from "path";

/**
 * A pilha frágil é declarada em versão EXATA, e o instalado bate com ela.
 *
 * <p><b>O defeito que isto fecha, com data.</b> Em 09/09/2026 as abas de cima
 * (Mercado e Finanças) foram consertadas: o `react-native-tab-view` media a
 * cena depois do primeiro quadro, e até a medida chegar a tela abria em branco
 * com a régua de abas solta no meio. O conserto foi o `initialLayout`.
 *
 * <p>Em 11/09 o commit `694daec`, chamado "close the transitive advisories",
 * mexeu <b>somente no `package-lock.json`</b> — e levou o
 * `@react-navigation/material-top-tabs` de <b>7.4.13 para 7.6.17</b> e o
 * `react-native-tab-view` de <b>4.2.2 para 4.3.2</b>. Ninguém decidiu isso: o
 * `package.json` dizia `^7.4.9`, e o acento circunflexo bastou. As telas
 * voltaram a abrir em branco, e o APK de 14/09 saiu com o defeito.
 *
 * <p>Medido depois: a auditoria dá <b>o mesmo número</b> com as duas versões.
 * O salto na navegação não fechava aviso nenhum — veio de carona.
 *
 * <p><b>Por que um teste e não só o pin.</b> No mesmo dia 11/09 o PR do
 * Dependabot que propunha exatamente esse salto foi <b>deliberadamente
 * recusado</b>. A decisão existia e não valeu nada, porque a faixa com `^`
 * deixava o mesmo pacote entrar por outra porta. Pin sem guarda é uma decisão
 * que a próxima instalação apaga.
 *
 * <p>A regra vale para esta lista e não para o `package.json` inteiro: fixar
 * tudo obrigaria a mexer à mão em pacote que não tem histórico de quebrar, e
 * catraca que incomoda sem motivo é catraca que alguém desliga.
 */
describe("Versões travadas da pilha frágil", () => {
  const RAIZ = path.resolve(__dirname, "..", "..", "..");
  const pkg = JSON.parse(fs.readFileSync(path.join(RAIZ, "package.json"), "utf8"));

  /**
   * Os pacotes que já quebraram o app ao subirem sozinhos, com o porquê.
   *
   * <p>Sair desta lista exige dizer o motivo; entrar exige um defeito real.
   */
  const TRAVADOS: Record<string, string> = {
    "@react-navigation/material-top-tabs":
      "7.6.17 abriu Mercado e Finanças em branco com a régua de abas solta no meio",
    "@react-navigation/bottom-tabs": "a barra de baixo é a navegação principal do app",
    "@react-navigation/native": "o núcleo: um salto aqui move todos os navegadores juntos",
    "@react-navigation/native-stack": "a pilha que abre todas as telas de detalhe",
  };

  const declarado = (nome: string): string =>
    pkg.dependencies?.[nome] ?? pkg.devDependencies?.[nome] ?? "";

  const instalado = (nome: string): string =>
    JSON.parse(
      fs.readFileSync(path.join(RAIZ, "node_modules", nome, "package.json"), "utf8"),
    ).version;

  const nomes = Object.keys(TRAVADOS);

  it.each(nomes)("%s está declarado sem faixa", (nome) => {
    const faixa = declarado(nome);

    expect(faixa).not.toBe("");
    // `^` e `~` são a fresta por onde o defeito entrou: com eles, "não vamos
    // subir" é opinião, e a próxima instalação decide por conta própria
    expect(faixa).not.toMatch(/[\^~*x]|\s-\s|\|\|/);
  });

  it.each(nomes)("%s instalado é exatamente o declarado", (nome) => {
    expect(instalado(nome)).toBe(declarado(nome));
  });

  /**
   * Travar o pai não basta, e foi isto que quase me escapou: o
   * `material-top-tabs@7.4.13` pede `react-native-tab-view: ^4.2.2` na própria
   * dependência dele. Sem o override, o 4.3.2 — que é metade do defeito —
   * voltaria pela porta de dentro.
   */
  it("react-native-tab-view está preso por override, não pela faixa do pai", () => {
    expect(pkg.overrides?.["react-native-tab-view"]).toBe("4.2.2");
    expect(instalado("react-native-tab-view")).toBe("4.2.2");
  });

  it("o pager fica na versão que o SDK 52 fixa", () => {
    // Não é caso de override: já está sem faixa, e é a versão que o Expo testa
    expect(declarado("react-native-pager-view")).toBe("6.5.1");
    expect(instalado("react-native-pager-view")).toBe("6.5.1");
  });
});
