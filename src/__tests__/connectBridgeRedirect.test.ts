import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A ponte de conexão bancária só devolve para o próprio app.
 *
 * <p>`redirect` chega pela URL, e URL qualquer pessoa forja. Sem a checagem,
 * um link para `conectar-banco.html#redirect=https://outro-lugar` levaria o
 * id da conexão bancária de quem acabou de autorizar o banco para o endereço
 * que o atacante colou — o CodeQL apontou como redirecionamento aberto.
 *
 * <p>A função vive dentro de um IIFE na página estática, fora do bundle. O
 * teste a extrai do HTML pelo nome e a executa com um `location` falso: se
 * alguém a renomear ou remover, a extração falha e o teste avisa — que é
 * melhor do que a proteção sumir em silêncio.
 */
// Fim de linha normalizado: no Windows o arquivo pode vir com CRLF, e a busca
// pelo fechamento da função abaixo é por LF puro
const HTML = readFileSync(
  join(__dirname, "..", "..", "public", "conectar-banco.html"),
  "utf8",
).replace(/\r\n/g, "\n");

function destinoPermitidoDaPagina(origin: string) {
  const inicio = HTML.indexOf("function destinoPermitido(");
  expect(inicio).toBeGreaterThan(-1);
  // Do `function` até o fechamento do bloco: a função não tem chave aninhada
  // além do try/catch, então o primeiro `\n  }` após o início é o fim dela
  const fim = HTML.indexOf("\n  }\n", inicio);
  const fonte = HTML.slice(inicio, fim + 4);

  const fabrica = new Function(
    "location",
    `${fonte}\n return destinoPermitido;`,
  );
  return fabrica({ href: origin + "/conectar-banco.html", origin }) as (
    bruto: string | null,
  ) => string | null;
}

describe("Destino de volta da ponte bancária", () => {
  const WEB = "https://economize-web.onrender.com";

  it("deep link do app passa", () => {
    const permitido = destinoPermitidoDaPagina(WEB);

    expect(permitido("economize:///")).toBe("economize:///");
    expect(permitido("economize://extrato")).toBe("economize://extrato");
  });

  it("a MESMA origem passa — é a web devolvendo para si mesma", () => {
    const permitido = destinoPermitidoDaPagina(WEB);

    expect(permitido(WEB + "/")).toBe(WEB + "/");
    expect(permitido(WEB + "/extrato?x=1")).toBe(WEB + "/extrato?x=1");
  });

  it("outra origem é recusada — inclusive https", () => {
    const permitido = destinoPermitidoDaPagina(WEB);

    // O id da conexão bancária de quem acabou de autorizar o banco não pode
    // ir para um endereço que alguém colou na URL
    expect(permitido("https://evil.example/pegar")).toBeNull();
    expect(permitido("https://economize-web.onrender.com.evil.example/")).toBeNull();
  });

  it("esquema perigoso é recusado", () => {
    const permitido = destinoPermitidoDaPagina(WEB);

    expect(permitido("javascript:alert(1)")).toBeNull();
    expect(permitido("data:text/html,oi")).toBeNull();
  });

  it("vazio, nulo e lixo caem no caminho seguro", () => {
    const permitido = destinoPermitidoDaPagina(WEB);

    expect(permitido(null)).toBeNull();
    expect(permitido("")).toBeNull();
    // "https://" sem host não é URL: o construtor lança, e a função devolve nulo
    expect(permitido("https://")).toBeNull();
  });

  it("caminho relativo fica — é a própria página se resolvendo", () => {
    const permitido = destinoPermitidoDaPagina(WEB);

    expect(permitido("/extrato")).toBe("/extrato");
    // Protocolo relativo (`//host`) troca a origem por baixo do pano: recusado
    expect(permitido("//evil.example/x")).toBeNull();
  });

  it("no desenvolvimento local, http da mesma origem também passa", () => {
    const permitido = destinoPermitidoDaPagina("http://localhost:8081");

    expect(permitido("http://localhost:8081/")).toBe("http://localhost:8081/");
    expect(permitido("http://localhost:9999/")).toBeNull();
  });
});
