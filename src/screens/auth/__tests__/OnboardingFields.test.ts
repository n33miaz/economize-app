import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * EC-211 — nenhum campo novo antes da primeira tela útil.
 *
 * <p>Hoje o cadastro pede nome, e-mail, senha e a confirmação dela. É assim
 * que já era; o que não existia era o que impede de deixar de ser.
 *
 * <p><b>Por que esta guarda.</b> Campo de cadastro é a coisa mais fácil do
 * mundo de acrescentar — alguém precisa de CPF para uma integração, põe um
 * campo "só para quem for usar", e seis meses depois ele é obrigatório para
 * todo mundo porque ninguém lembra por que era opcional. O custo aparece do
 * outro lado, em quem desiste antes de ver uma tela útil.
 *
 * <p><b>Não é um teste de aparência.</b> Ele não diz como o formulário deve
 * ser desenhado. Ele diz que um dado novo na porta de entrada é uma decisão de
 * produto — e decisão de produto se toma de propósito, não numa tarde.
 */

const RAIZ = join(__dirname, "..");

/** O que a porta de entrada pode pedir. */
const PERMITIDOS = ["Nome Completo", "E-mail", "Senha", "Confirmar senha"];

/**
 * Os dados que só podem ser pedidos QUANDO a função que precisa deles for
 * usada — CPF quando houver Open Finance, banco quando a pessoa quiser
 * conectar um. Nada disso para quem só quer arrastar um CSV.
 */
const PROIBIDOS = [
  "cpf",
  "cnpj",
  "documento",
  "telefone",
  "celular",
  "nascimento",
  "endereço",
  "endereco",
  "cep",
  "renda",
  "banco",
];

const fonte = readFileSync(join(RAIZ, "Register.tsx"), "utf8");

/** Os `label` do formulário, que é o que a pessoa efetivamente preenche. */
function rotulos(): string[] {
  return [...fonte.matchAll(/\blabel="([^"]+)"/g)].map((m) => m[1]);
}

describe("A porta de entrada", () => {
  it("pede exatamente os quatro campos, e nenhum a mais", () => {
    expect(rotulos().sort()).toEqual([...PERMITIDOS].sort());
  });

  it("não pede documento, contato, endereço nem banco", () => {
    const ofensores = rotulos().filter((rotulo) =>
      PROIBIDOS.some((proibido) => rotulo.toLowerCase().includes(proibido)),
    );

    expect(ofensores).toEqual([]);
  });

  it("a guarda enxerga um campo proibido — senão ela não vale nada", () => {
    const falsos = ["CPF", "Telefone celular", "Data de nascimento", "Seu banco", "CEP"];

    for (const rotulo of falsos) {
      const pego = PROIBIDOS.some((p) => rotulo.toLowerCase().includes(p));
      expect(pego).toBe(true);
    }
  });

  it("a varredura está lendo o arquivo certo", () => {
    // Sem isto, um `Register.tsx` renomeado faria os três testes acima passarem
    // lendo zero rótulos
    expect(rotulos().length).toBeGreaterThan(0);
    expect(fonte).toContain("Cadastrar");
  });
});
