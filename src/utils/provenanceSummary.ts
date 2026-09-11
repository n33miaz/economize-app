import type {
  BankTransaction,
  ConnectorAccount,
  ImportSource,
  ImportSourceKind,
} from "../services/api";
import { shortFileName } from "./provenance";

/**
 * De onde veio um NÚMERO — EC-225.
 *
 * <p>O EC-195 respondeu por linha: "esta compra veio do arquivo tal". Mas o
 * que o usuário desconfia não é de uma linha, é de um <b>total</b>. "Saí
 * R$ 3.421 este mês" é a frase que ele lê e questiona, e até aqui nada no app
 * sabia dizer de onde aquele número tinha sido somado.
 *
 * <p><b>O que este resumo responde, e nessa ordem:</b> quantos lançamentos
 * entraram na conta, e de que fontes. Nada mais. A tentação é despejar
 * também o período, o filtro e as exclusões — e aí o verso do card vira um
 * relatório que ninguém lê. Quem quiser o detalhe abre o extrato, e o verso
 * tem o botão para isso.
 *
 * <p><b>Fonte com mais linhas primeiro.</b> Quem conferir um total quer saber
 * de onde veio a maior parte dele; listar em ordem alfabética faria a pessoa
 * caçar.
 */

export interface ProvenanceLine {
  /** Chave estável para a lista — o id da conta, do arquivo, ou o tipo. */
  key: string;
  /** "conexão com o Nubank", "arquivo Extrato-….csv", "origem não registrada". */
  label: string;
  count: number;
}

export interface ProvenanceSummary {
  /** Quantos lançamentos entraram na soma. */
  total: number;
  /** As fontes, da que mais contribuiu para a que menos. */
  lines: ProvenanceLine[];
}

function tipoDe(tx: Pick<BankTransaction, "source" | "accountId" | "uploadId">): ImportSourceKind {
  // Servidor mais velho não manda `source`; derivar do contrato antigo é
  // melhor do que responder "não sei" por falta de campo
  return tx.source ?? (tx.accountId ? "CONNECTION" : tx.uploadId ? "FILE" : "UNKNOWN");
}

/**
 * Resume a procedência do conjunto que formou um número.
 *
 * @param transactions exatamente as linhas que entraram na soma — não o
 *                     extrato inteiro. Resumir um conjunto maior que o somado
 *                     seria descrever outro número
 */
export function summarizeProvenance(
  transactions: Pick<BankTransaction, "source" | "accountId" | "uploadId">[],
  accounts: Map<string, ConnectorAccount>,
  uploads: Map<string, ImportSource>,
): ProvenanceSummary {
  const contagem = new Map<string, ProvenanceLine>();

  for (const tx of transactions) {
    const tipo = tipoDe(tx);
    let key: string;
    let label: string;

    if (tipo === "CONNECTION") {
      const conta = tx.accountId ? accounts.get(tx.accountId) : undefined;
      key = tx.accountId ?? "conexao";
      const nome = conta?.institution ?? conta?.name ?? null;
      label = nome ? `conexão com ${nome}` : "uma conexão bancária";
    } else if (tipo === "FILE") {
      const arquivo = tx.uploadId ? uploads.get(tx.uploadId) : undefined;
      key = tx.uploadId ?? "arquivo";
      const nome = shortFileName(arquivo?.fileName, 26);
      label = nome ? `arquivo ${nome}` : "um arquivo importado";
    } else {
      key = "desconhecida";
      label = "origem não registrada";
    }

    const atual = contagem.get(key);
    if (atual) atual.count += 1;
    else contagem.set(key, { key, label, count: 1 });
  }

  const lines = [...contagem.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    // Empate resolvido pelo rótulo, para a ordem não variar entre renders
    return a.label.localeCompare(b.label, "pt-BR");
  });

  return { total: transactions.length, lines };
}

/**
 * A frase de uma linha do resumo: "96 lançamentos · conexão com o Inter".
 *
 * O número vem antes do rótulo porque é ele que responde a pergunta — o
 * rótulo só qualifica.
 */
export function describeProvenanceLine(line: ProvenanceLine): string {
  const quantos = line.count === 1 ? "1 lançamento" : `${line.count} lançamentos`;
  return `${quantos} · ${line.label}`;
}

/** O cabeçalho do verso: "somado de 148 lançamentos". */
export function describeProvenanceTotal(summary: ProvenanceSummary): string {
  if (summary.total === 0) return "Nenhum lançamento entrou nesta conta.";
  return summary.total === 1
    ? "Somado de 1 lançamento."
    : `Somado de ${summary.total} lançamentos.`;
}
