import type { DebtEntry, DebtKind } from "../services/api";

/**
 * Os nomes e os significados de cada tipo de dívida (EC-139).
 *
 * <p>O rótulo sozinho não ensina nada: quase ninguém sabe por que consórcio não
 * é compra, ou por que a entrada de um empréstimo não é receita. A frase de
 * apoio é a parte que faz a separação valer alguma coisa.
 */

export function debtKindLabel(kind: DebtKind): string {
  switch (kind) {
    case "FINANCING":
      return "Financiamento";
    case "INSTALLMENT":
      return "Compras parceladas";
    case "CONSORTIUM":
      return "Consórcio";
    case "LOAN":
      return "Empréstimo";
    case "REVOLVING":
      return "Rotativo do cartão";
  }
}

export function debtKindMeaning(kind: DebtKind): string {
  switch (kind) {
    case "FINANCING":
      return "O bem já é seu, a dívida também. A parcela tem juros e amortização.";
    case "INSTALLMENT":
      return "Sem juros aparentes, mas compromete os próximos meses.";
    case "CONSORTIUM":
      return "Ainda não é compra: é poupança forçada com taxa, até a contemplação.";
    case "LOAN":
      return "O dinheiro que entrou não é receita — e a saída não é gasto novo.";
    case "REVOLVING":
      return "O juro mais caro do país. Quitar isso rende mais que qualquer economia.";
  }
}

/**
 * "Parcela 7 de 48 · faltam 41".
 *
 * <p>`null` quando o extrato não informou onde estamos: inventar a posição
 * daria a impressão de um prazo que ninguém apurou.
 */
export function describeInstallment(entry: {
  installment: DebtEntry["installment"];
  total: DebtEntry["total"];
  remaining: DebtEntry["remaining"];
}): string | null {
  if (entry.installment == null || entry.total == null) return null;
  const base = `Parcela ${entry.installment} de ${entry.total}`;
  if (entry.remaining == null) return base;
  if (entry.remaining === 0) return `${base} · é a última`;
  return `${base} · ${
    entry.remaining === 1 ? "falta 1" : `faltam ${entry.remaining}`
  }`;
}
