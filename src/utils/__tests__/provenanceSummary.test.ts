import type { BankTransaction, ConnectorAccount, ImportSource } from "../../services/api";
import {
  describeProvenanceLine,
  describeProvenanceTotal,
  summarizeProvenance,
} from "../provenanceSummary";

type Linha = Pick<BankTransaction, "source" | "accountId" | "uploadId">;

const daConexao = (accountId: string): Linha => ({
  source: "CONNECTION",
  accountId,
  uploadId: null,
});
const doArquivo = (uploadId: string): Linha => ({
  source: "FILE",
  accountId: null,
  uploadId,
});
const semOrigem = (): Linha => ({ source: "UNKNOWN", accountId: null, uploadId: null });

const CONTAS = new Map<string, ConnectorAccount>([
  ["a1", { id: "a1", institution: "Inter", name: "Inter ····2750" } as ConnectorAccount],
  ["a2", { id: "a2", institution: null, name: "Conta antiga" } as ConnectorAccount],
]);

const ARQUIVOS = new Map<string, ImportSource>([
  [
    "u1",
    {
      id: "u1",
      fileName: "Extrato-12-08-2024-a-11-08-2026-CSV.csv",
    } as ImportSource,
  ],
]);

/**
 * EC-225 — de onde um NÚMERO veio.
 *
 * O que se prova aqui é a regra que o card carrega: as contagens sempre fecham
 * com o total, inclusive quando parte do extrato não tem procedência.
 */
describe("Resumo de procedência", () => {
  it("agrupa por fonte e conta quantas linhas cada uma trouxe", () => {
    const resumo = summarizeProvenance(
      [daConexao("a1"), daConexao("a1"), doArquivo("u1")],
      CONTAS,
      ARQUIVOS,
    );

    expect(resumo.total).toBe(3);
    expect(resumo.lines).toHaveLength(2);
    expect(resumo.lines[0]).toMatchObject({ count: 2, label: "conexão com Inter" });
  });

  it("a fonte que mais contribuiu vem primeiro", () => {
    const resumo = summarizeProvenance(
      [doArquivo("u1"), daConexao("a1"), daConexao("a1"), daConexao("a1")],
      CONTAS,
      ARQUIVOS,
    );

    expect(resumo.lines.map((l) => l.count)).toEqual([3, 1]);
  });

  it("as contagens SEMPRE fecham com o total", () => {
    const linhas = [
      daConexao("a1"),
      doArquivo("u1"),
      semOrigem(),
      semOrigem(),
      daConexao("a2"),
    ];

    const resumo = summarizeProvenance(linhas, CONTAS, ARQUIVOS);

    const somadas = resumo.lines.reduce((acc, l) => acc + l.count, 0);
    expect(somadas).toBe(resumo.total);
    expect(somadas).toBe(linhas.length);
  });

  it("o histórico sem procedência aparece, em vez de sumir da conta", () => {
    const resumo = summarizeProvenance([semOrigem(), semOrigem()], CONTAS, ARQUIVOS);

    expect(resumo.lines[0]).toMatchObject({
      label: "origem não registrada",
      count: 2,
    });
  });

  it("conta sem instituição cai no nome dela, e não num UUID", () => {
    const resumo = summarizeProvenance([daConexao("a2")], CONTAS, ARQUIVOS);

    expect(resumo.lines[0].label).toBe("conexão com Conta antiga");
  });

  it("conta que o mapa não conhece não vira id na tela", () => {
    const resumo = summarizeProvenance([daConexao("sumida")], CONTAS, ARQUIVOS);

    expect(resumo.lines[0].label).toBe("uma conexão bancária");
    expect(resumo.lines[0].label).not.toContain("sumida");
  });

  it("nome de arquivo longo é encurtado pelas pontas", () => {
    const resumo = summarizeProvenance([doArquivo("u1")], CONTAS, ARQUIVOS);

    expect(resumo.lines[0].label).toMatch(/^arquivo Extrato-.*….*csv$/);
    expect(resumo.lines[0].label.length).toBeLessThan(40);
  });

  it("contrato antigo sem `source` é derivado do que existe", () => {
    const antigo = { accountId: "a1", uploadId: null } as Linha;

    expect(summarizeProvenance([antigo], CONTAS, ARQUIVOS).lines[0].label).toBe(
      "conexão com Inter",
    );
  });

  it("sem linha nenhuma, o resumo diz isso em vez de mentir um total", () => {
    const resumo = summarizeProvenance([], CONTAS, ARQUIVOS);

    expect(resumo.total).toBe(0);
    expect(resumo.lines).toEqual([]);
    expect(describeProvenanceTotal(resumo)).toBe("Nenhum lançamento entrou nesta conta.");
  });

  it("singular e plural nas duas frases", () => {
    const uma = summarizeProvenance([daConexao("a1")], CONTAS, ARQUIVOS);

    expect(describeProvenanceTotal(uma)).toBe("Somado de 1 lançamento.");
    expect(describeProvenanceLine(uma.lines[0])).toBe("1 lançamento · conexão com Inter");

    const duas = summarizeProvenance([daConexao("a1"), daConexao("a1")], CONTAS, ARQUIVOS);
    expect(describeProvenanceTotal(duas)).toBe("Somado de 2 lançamentos.");
    expect(describeProvenanceLine(duas.lines[0])).toBe("2 lançamentos · conexão com Inter");
  });

  it("empate de contagem não muda de ordem entre renders", () => {
    const linhas = [daConexao("a1"), daConexao("a2")];

    const primeiro = summarizeProvenance(linhas, CONTAS, ARQUIVOS);
    const segundo = summarizeProvenance([...linhas].reverse(), CONTAS, ARQUIVOS);

    expect(primeiro.lines.map((l) => l.label)).toEqual(
      segundo.lines.map((l) => l.label),
    );
  });
});
