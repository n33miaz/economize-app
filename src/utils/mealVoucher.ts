import { daysInMonth, isoDate, parseIsoDate } from "./cycleWindow";

import type { IncomeSource } from "../services/api";

/**
 * O pedido ativo de extrato na data provável do VR (EC-137).
 *
 * <p>O cenário é o do dono: fim de mês, o salário não caiu, mas o vale-refeição
 * já caiu e já foi gasto. O app não deve descobrir isso depois — deve perguntar
 * no momento em que a compra provavelmente aconteceu.
 *
 * <p>Vale-refeição e vale-alimentação vêm em cartão próprio e quase nunca
 * aparecem no extrato bancário. É justamente por isso que só o usuário pode
 * fechar essa lacuna, e por isso que perguntar é a única saída honesta.
 */

/**
 * Por quantos dias depois da queda ainda faz sentido perguntar. Passada essa
 * janela a pessoa não lembra mais da compra, e o aviso que não é útil vira
 * ruído — o que ensina a ignorar o próximo, que talvez fosse.
 */
const JANELA_DIAS = 10;

const EM_CARTAO_PROPRIO: IncomeSource["kind"][] = [
  "MEAL_VOUCHER",
  "FOOD_VOUCHER",
];

export interface MealVoucherAsk {
  sourceId: string;
  sourceName: string;
  /** O dia em que a fonte provavelmente caiu, em ISO. */
  landedOn: string;
  daysAgo: number;
  /**
   * Valor esperado, e só quando a fonte está CONFIRMADA: o que o motor de
   * recorrência ainda não teve confirmado é estimativa, e estimativa exibida
   * como fato é o começo de toda desconfiança do usuário.
   */
  amount: number | null;
}

/** Diferença em dias entre duas datas ISO (b menos a). */
function diasEntre(a: string, b: string): number | null {
  const de = parseIsoDate(a);
  const ate = parseIsoDate(b);
  if (!de || !ate) return null;
  const ms =
    Date.UTC(ate.year, ate.month - 1, ate.day) -
    Date.UTC(de.year, de.month - 1, de.day);
  return Math.round(ms / 86400000);
}

/**
 * A última queda da âncora em ou antes de `today`.
 *
 * <p>Mês que não tem o dia da âncora (31 em fevereiro) usa o último dia: é
 * onde o pagamento realmente acontece, e procurar o dia 31 literalmente
 * responderia "nunca caiu" em todo fevereiro.
 */
export function lastLanding(anchorDay: number, today: string): string | null {
  const hoje = parseIsoDate(today);
  if (!hoje || anchorDay < 1 || anchorDay > 31) return null;

  const diaNoMes = (year: number, month: number) =>
    Math.min(anchorDay, daysInMonth(year, month));

  const desteMes = diaNoMes(hoje.year, hoje.month);
  if (hoje.day >= desteMes) return isoDate(hoje.year, hoje.month, desteMes);

  const mesAnterior = hoje.month === 1 ? 12 : hoje.month - 1;
  const ano = hoje.month === 1 ? hoje.year - 1 : hoje.year;
  return isoDate(ano, mesAnterior, diaNoMes(ano, mesAnterior));
}

export function mealVoucherAsk(params: {
  sources: IncomeSource[];
  today: string;
  /**
   * Até que dia o extrato do usuário alcança. `undefined` é servidor mais
   * velho que o app, e aí a resposta é perguntar: não saber não é o mesmo que
   * saber que já chegou.
   */
  lastTransactionDate: string | null | undefined;
  /** A queda que o usuário já dispensou — só aquela, nunca a próxima. */
  dismissedFor: string | null;
}): MealVoucherAsk | null {
  const candidatos: MealVoucherAsk[] = [];

  for (const source of params.sources) {
    if (!source.active) continue;
    if (!EM_CARTAO_PROPRIO.includes(source.kind)) continue;
    if (source.anchorDay == null) continue;

    const landedOn = lastLanding(source.anchorDay, params.today);
    if (landedOn === null) continue;

    const daysAgo = diasEntre(landedOn, params.today);
    if (daysAgo === null || daysAgo < 0 || daysAgo > JANELA_DIAS) continue;

    // Comparação de ISO como texto: `YYYY-MM-DD` ordena igual à data, e
    // converter para Date só para comparar abriria porta para fuso
    if (params.lastTransactionDate && params.lastTransactionDate >= landedOn) {
      continue;
    }
    if (params.dismissedFor === landedOn) continue;

    candidatos.push({
      sourceId: source.id,
      sourceName: source.name,
      landedOn,
      daysAgo,
      amount: source.confirmed ? source.expectedAmount : null,
    });
  }

  // Duas fontes podem estar na janela ao mesmo tempo (VR dia 25, VA dia 1).
  // Pergunta-se pela mais recente: é a compra que a pessoa ainda lembra
  candidatos.sort((a, b) => (a.landedOn < b.landedOn ? 1 : -1));
  return candidatos[0] ?? null;
}

/** "Entrou hoje" / "Entrou ontem" / "Entrou há 3 dias". */
export function describeLanding(daysAgo: number): string {
  if (daysAgo <= 0) return "Entrou hoje";
  if (daysAgo === 1) return "Entrou ontem";
  return `Entrou há ${daysAgo} dias`;
}
