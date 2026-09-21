import type { AccountInvoice, ProviderBill } from "../services/api";
import { formatBRL } from "./money";

/**
 * O que dizer quando a nossa conta e a do banco discordam.
 *
 * <p>O app monta a fatura somando os lançamentos que tem; o emissor manda a
 * fatura que ele fechou. Medido na conta do dono em 21/09/2026: nós
 * somávamos R$ 775,67 num cartão cuja fatura de setembro, no banco, foi de
 * R$ 2.311,49 — e antes disto não havia como saber que faltava alguma coisa.
 *
 * <p>Este módulo não escolhe um número: ele descreve a DISTÂNCIA entre os
 * dois. Substituir o nosso pelo do banco esconderia exatamente o sinal que
 * interessa, que é "o conector não trouxe tudo".
 */

export type BillAgreement = "confere" | "faltando" | "adiantado";

export interface BillComparison {
  agreement: BillAgreement;
  /** Sempre positivo: o tamanho da distância, não o sinal dela. */
  difference: number;
  providerTotal: number;
  headline: string;
  detail: string;
}

/** Abaixo de um centavo é arredondamento, não divergência. */
const TOLERANCIA = 0.01;

export function compareWithProviderBill(
  ourTotal: number,
  bill: ProviderBill | null | undefined,
): BillComparison | null {
  if (!bill || bill.total == null || !isFinite(bill.total)) return null;

  const providerTotal = bill.total;
  const difference = Math.round(Math.abs(providerTotal - ourTotal) * 100) / 100;

  if (difference < TOLERANCIA) {
    return {
      agreement: "confere",
      difference: 0,
      providerTotal,
      headline: "Confere com o banco",
      detail: `O banco fechou esta fatura em ${formatBRL(providerTotal)}, igual ao que está aqui.`,
    };
  }

  if (providerTotal > ourTotal) {
    // O caso que motivou a funcionalidade: o que falta são compras que o
    // conector não trouxe, e o app precisa DIZER isso em vez de mostrar o
    // número menor como se fosse o certo
    return {
      agreement: "faltando",
      difference,
      providerTotal,
      headline: `Faltam ${formatBRL(difference)} aqui`,
      detail:
        `O banco fechou em ${formatBRL(providerTotal)} e eu só enxergo ` +
        `${formatBRL(ourTotal)}. A diferença são compras que ainda não chegaram — ` +
        `reconecte o banco ou importe o extrato do cartão.`,
    };
  }

  // Nós somamos mais do que o banco cobrou. Quase sempre é recorte: o nosso
  // ciclo e o do emissor não começam no mesmo dia, e uma compra da virada cai
  // de um lado só. Dizer "sobrando" seria acusar o banco de erro
  return {
    agreement: "adiantado",
    difference,
    providerTotal,
    headline: `${formatBRL(difference)} a mais do que o banco fechou`,
    detail:
      `O banco fechou em ${formatBRL(providerTotal)}. A diferença costuma ser ` +
      `compra da virada do ciclo, que caiu deste lado e vai para a próxima fatura dele.`,
  };
}

/** "vence 07/10 · mínimo R$ 347,63" — a linha curta da fatura do banco. */
export function describeProviderBill(bill: ProviderBill | null | undefined): string | null {
  if (!bill) return null;
  const partes: string[] = [];
  if (bill.dueDate) {
    const [ano, mes, dia] = bill.dueDate.slice(0, 10).split("-");
    if (ano && mes && dia) partes.push(`vence ${dia}/${mes}`);
  }
  if (bill.minimumPayment != null && bill.minimumPayment > 0) {
    partes.push(`mínimo ${formatBRL(bill.minimumPayment)}`);
  }
  if (bill.financeCharges != null && bill.financeCharges > 0) {
    // Encargo é a informação mais cara da fatura e a que ninguém procura
    partes.push(`encargos ${formatBRL(bill.financeCharges)}`);
  }
  return partes.length > 0 ? partes.join(" · ") : null;
}

/** Atalho para quem já tem a fatura inteira em mãos. */
export function compareInvoice(invoice: AccountInvoice): BillComparison | null {
  return compareWithProviderBill(invoice.total, invoice.providerBill);
}
