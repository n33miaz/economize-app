import fs from "fs";
import path from "path";

/**
 * O endereço anunciado tem que ser o endereço que o site serve.
 *
 * <p><b>O defeito que isto fecha.</b> O site é uma SPA e o `render.yaml` tem
 * uma reescrita `/* → /index.html` — necessária, senão dar F5 em `/analise`
 * devolveria 404. Só que ela é avaliada ANTES do arquivo estático: `/baixar`
 * devolvia a SPA, ou seja, a TELA DE LOGIN, enquanto a página de download só
 * respondia em `/baixar.html`.
 *
 * <p>E `/baixar` é exatamente o endereço que a API entrega a quem é barrado
 * pela atualização obrigatória. A pessoa era bloqueada, tocava em "Atualizar"
 * e caía num formulário de login — sem arquivo, sem explicação e sem volta.
 * O defeito morava no único caminho de saída de quem já estava travado.
 *
 * <p><b>Por que um teste, e não só a correção.</b> Nada no repositório liga a
 * página que existe em `public/` ao endereço que alguém anuncia: o arquivo
 * está lá, o build passa, a esteira fica verde, e mesmo assim o endereço não
 * responde. Só abrindo a URL se descobre — e por isso o defeito volta calado
 * na próxima página que alguém acrescentar.
 */
describe("Rotas das páginas estáticas no blueprint", () => {
  const RAIZ = path.resolve(__dirname, "..", "..", "..");
  const blueprint = fs.readFileSync(path.join(RAIZ, "render.yaml"), "utf8");

  /**
   * Cada página de `public/`, e se ela precisa responder SEM a extensão.
   *
   * <p>Catraca, não perdão: página nova em `public/` que não esteja aqui
   * reprova o teste, e sair da lista exige dizer por quê. A pergunta que a
   * tabela obriga a responder é "alguém anuncia este endereço?" — e quem
   * anuncia raramente é este repositório.
   */
  const PAGINAS: Record<string, string | null> = {
    // A API entrega este endereço em `economize.app.download-url`, e é para
    // ele que o app manda quem recebe 426. Sem rota, a SPA responde primeiro
    "baixar.html": "/baixar",
    // Chamada sempre com a extensão (`CONNECT_BRIDGE_PAGE`), pelo próprio
    // app. Endereço limpo aqui seria rota que ninguém pede
    "conectar-banco.html": null,
  };

  /**
   * As linhas `source:` na ordem em que o Render as avalia. Leitura por texto
   * de propósito: um parser de YAML seria dependência nova para conferir um
   * arquivo que é nosso e tem doze linhas.
   */
  const fontes = [...blueprint.matchAll(/^\s*source:\s*(\S+)/gm)].map((m) => m[1]);
  const publicos = fs
    .readdirSync(path.join(RAIZ, "public"))
    .filter((f) => f.endsWith(".html") && f !== "index.html");

  it("nenhuma página de public/ ficou fora da tabela", () => {
    expect(publicos.sort()).toEqual(Object.keys(PAGINAS).sort());
  });

  const comEndereco = Object.entries(PAGINAS).filter(([, rota]) => rota !== null) as [
    string,
    string,
  ][];

  it.each(comEndereco)("%s responde em %s", (_arquivo, rota) => {
    expect(fontes).toContain(rota);
  });

  it.each(comEndereco)("a rota de %s vem ANTES da reescrita geral", (_arquivo, rota) => {
    const geral = fontes.indexOf("/*");
    const propria = fontes.indexOf(rota);

    // Depois do `/*` a rota existe e não serve para nada: a reescrita geral
    // já respondeu. É o mesmo defeito, escrito de outro jeito
    expect(geral).toBeGreaterThanOrEqual(0);
    expect(propria).toBeLessThan(geral);
  });

  it("produção e homologação têm a mesma proteção", () => {
    const sites = fontes.filter((f) => f === "/*").length;
    const proprias = fontes.filter((f) => f !== "/*").length;

    // Homologação existe para a tela ser vista antes de chegar ao dono;
    // proteger só a produção faria o defeito estrear justamente no ambiente
    // que deveria pegá-lo
    expect(sites).toBe(2);
    expect(proprias).toBe(comEndereco.length * sites);
  });
});
