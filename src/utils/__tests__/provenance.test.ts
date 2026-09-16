import { provenanceOf, shortFileName } from "../provenance";
import type {
  BankTransaction,
  ConnectorAccount,
  ImportSource,
} from "../../services/api";

const CONTA: ConnectorAccount = {
  id: "c1",
  name: "Conta Corrente ····2750",
  type: "BANK",
  institution: "Banco Inter",
  statementClosingDay: null,
  statementDueDay: null,
  linked: true,
  reportedBalance: null,
  reportedBalanceAt: null,
  creditLimit: null,
  creditLimitSharedWith: null,
};

const ARQUIVO: ImportSource = {
  id: "u1",
  fileName: "Extrato-12-08-2024-a-11-08-2026-CSV.csv",
  format: "CSV",
  importedCount: 1682,
  importedAt: "2026-09-08T14:02:00Z",
};

type Linha = Pick<
  BankTransaction,
  "source" | "importedAt" | "accountId" | "uploadId"
>;

const linha = (patch: Partial<Linha> = {}): Linha => ({
  source: null,
  importedAt: null,
  accountId: null,
  uploadId: null,
  ...patch,
});

describe("De onde veio este número", () => {
  it("conexão: diz a instituição, não o nome interno da conta", () => {
    const { origem } = provenanceOf(
      linha({ source: "CONNECTION", accountId: "c1" }),
      CONTA,
      null,
    );

    expect(origem).toBe("veio da conexão com Banco Inter");
  });

  it("conexão sem a conta no mapa ainda responde", () => {
    // Mapa ainda carregando é estado normal, não falha
    const { origem } = provenanceOf(
      linha({ source: "CONNECTION", accountId: "c1" }),
      undefined,
      null,
    );

    expect(origem).toBe("veio de uma conexão bancária");
  });

  it("arquivo: diz o nome, encurtado pelas duas pontas", () => {
    const { origem } = provenanceOf(
      linha({ source: "FILE", uploadId: "u1" }),
      null,
      ARQUIVO,
    );

    expect(origem).toBe("veio do arquivo Extrato-12-08-202…-08-2026-CSV.csv");
  });

  it("sem origem registrada, a resposta ainda é uma resposta", () => {
    // É o histórico anterior ao EC-113, e é a maioria do extrato de quem
    // sempre importou arquivo na mão
    expect(provenanceOf(linha(), null, null).origem).toBe("origem não registrada");
  });

  it("servidor mais velho que o app: deriva do que o contrato antigo já tinha", () => {
    // `source` ausente não pode virar "não sei" quando accountId responde
    expect(provenanceOf(linha({ accountId: "c1" }), CONTA, null).origem).toBe(
      "veio da conexão com Banco Inter",
    );
    expect(provenanceOf(linha({ uploadId: "u1" }), null, ARQUIVO).origem).toBe(
      "veio do arquivo Extrato-12-08-202…-08-2026-CSV.csv",
    );
  });

  it("NENHUMA combinação fica sem frase — a prova do EC-195", () => {
    for (const source of ["CONNECTION", "FILE", "UNKNOWN", null, undefined] as const) {
      for (const accountId of ["c1", null]) {
        for (const uploadId of ["u1", null]) {
          const { origem } = provenanceOf(
            linha({ source, accountId, uploadId }),
            null,
            null,
          );

          expect(origem.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it("a hora da importação vem legível, e é outra coisa que a data da compra", () => {
    const { entrada } = provenanceOf(
      linha({ source: "FILE", uploadId: "u1", importedAt: "2026-09-08T14:02:00Z" }),
      null,
      ARQUIVO,
    );

    expect(entrada).toMatch(/^08\/09\/2026 às \d{2}:\d{2}$/);
  });

  it("sem hora de importação, o campo é nulo em vez de inventado", () => {
    expect(provenanceOf(linha(), null, null).entrada).toBeNull();
    expect(provenanceOf(linha({ importedAt: "não é data" }), null, null).entrada).toBeNull();
  });
});

describe("Nome de arquivo encurtado", () => {
  it("nome curto passa inteiro", () => {
    expect(shortFileName("NU_339700777.csv")).toBe("NU_339700777.csv");
  });

  it("nome longo perde o meio, nunca as pontas", () => {
    // As duas pontas são o que identifica o arquivo para quem o enviou
    const curto = shortFileName("Extrato-12-08-2024-a-11-08-2026-CSV.csv");

    expect(curto).toContain("Extrato-12-08");
    expect(curto).toContain("CSV.csv");
    expect(curto).toHaveLength(34);
  });

  it("vazio e nulo devolvem nulo, não string vazia", () => {
    expect(shortFileName(null)).toBeNull();
    expect(shortFileName(undefined)).toBeNull();
    expect(shortFileName("   ")).toBeNull();
  });
});
