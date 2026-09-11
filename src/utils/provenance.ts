import type {
  BankTransaction,
  ConnectorAccount,
  ImportSource,
  ImportSourceKind,
} from "../services/api";

/**
 * De onde veio este número, em uma frase — EC-195.
 *
 * O defeito que isto ataca foi visto no concorrente e é o pior de todos,
 * porque envenena tudo o mais: no tour dele a Análise afirmou *"Sem gastos por
 * categoria"* enquanto a home, no mesmo minuto, mostrava R$ 810,61 em cinco
 * categorias. Não havia nada em tela dizendo de onde qualquer um dos dois
 * números tinha saído — e sem isso o usuário não tem como saber qual acreditar.
 *
 * A regra é curta: **toda linha responde**. Não existe retorno vazio aqui. A
 * pior resposta possível é `"origem não registrada"`, que ainda é uma resposta
 * — e é a verdade sobre o histórico importado antes de a origem existir.
 */

/** As duas metades da resposta, separadas para a tela poder pesá-las. */
export interface Provenance {
  /** "veio da conexão com o Nubank", "veio do arquivo Extrato-....csv". */
  origem: string;
  /** "importado em 08/09/2026 às 14:02"; null quando o servidor não informou. */
  entrada: string | null;
}

function dataHora(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return null;
  const pad = (valor: number) => String(valor).padStart(2, "0");
  return (
    `${pad(data.getDate())}/${pad(data.getMonth() + 1)}/${data.getFullYear()}` +
    ` às ${pad(data.getHours())}:${pad(data.getMinutes())}`
  );
}

/**
 * Nome curto do arquivo. Extrato de banco vem com nome longo
 * ("Extrato-12-08-2024-a-11-08-2026-CSV.csv") e a folha de detalhe tem uma
 * linha; cortar no meio preserva as duas pontas, que é o que identifica o
 * arquivo para quem o enviou.
 */
export function shortFileName(nome: string | null | undefined, teto = 34): string | null {
  if (!nome) return null;
  const limpo = nome.trim();
  if (limpo.length === 0) return null;
  if (limpo.length <= teto) return limpo;
  const cabeca = Math.ceil((teto - 1) / 2);
  const cauda = Math.floor((teto - 1) / 2);
  return `${limpo.slice(0, cabeca)}…${limpo.slice(limpo.length - cauda)}`;
}

/**
 * A frase de procedência de uma linha.
 *
 * @param account  a conta resolvida no mapa; `undefined` é estado normal
 * @param upload   o arquivo resolvido no mapa; `undefined` é estado normal
 */
export function provenanceOf(
  transaction: Pick<BankTransaction, "source" | "importedAt" | "accountId" | "uploadId">,
  account: ConnectorAccount | null | undefined,
  upload: ImportSource | null | undefined,
): Provenance {
  const entrada = dataHora(transaction.importedAt);
  // Servidor mais velho que o app não manda `source`; derivar do que já existe
  // no contrato antigo é melhor do que responder "não sei" por falta de campo
  const tipo: ImportSourceKind =
    transaction.source ??
    (transaction.accountId ? "CONNECTION" : transaction.uploadId ? "FILE" : "UNKNOWN");

  if (tipo === "CONNECTION") {
    const nome = account?.institution ?? account?.name ?? null;
    return {
      origem: nome ? `veio da conexão com ${nome}` : "veio de uma conexão bancária",
      entrada,
    };
  }
  if (tipo === "FILE") {
    const arquivo = shortFileName(upload?.fileName);
    return {
      origem: arquivo ? `veio do arquivo ${arquivo}` : "veio de um arquivo importado",
      entrada,
    };
  }
  // A pior resposta ainda é uma resposta
  return { origem: "origem não registrada", entrada };
}
