import type { BankTransaction, DailyTotal } from "../services/api";

/**
 * O mês em grade: quanto saiu e quanto entrou em cada dia — EC-235.
 *
 * Pedido do dono depois do tour: *"uma opção para visualizar como se fosse um
 * calendário, mostrando o total gasto (e ganho, se tiver) por dia — parecido
 * com o Pierre"*. É a melhor peça de leitura que o concorrente tem, e a razão
 * é simples: gasto tem ritmo semanal, e nenhuma lista cronológica mostra
 * ritmo. Num calendário, a sexta-feira cara aparece sozinha.
 *
 * **As mesmas exclusões de todas as outras somas.** Um dia de aplicação de
 * R$ 411 não é um dia caro — o dinheiro mudou de gaveta. Se o calendário
 * usasse outra regra, ele viraria mais um número que discorda dos demais, que
 * é exatamente o defeito que o EC-200 acabou de fechar.
 */

/** Um dia da grade. Dias fora do mês existem para a semana fechar. */
export interface CalendarDay {
  /** ISO `YYYY-MM-DD`. */
  date: string;
  /** Dia do mês, 1–31. */
  dayOfMonth: number;
  /** `false` para os dias de preenchimento das pontas. */
  inMonth: boolean;
  /** Soma das saídas do dia, em positivo. Zero quando não houve. */
  spent: number;
  /** Soma das entradas do dia. Zero quando não houve. */
  earned: number;
  /** Quantos lançamentos entraram nas somas deste dia. */
  count: number;
}

export interface SpendingCalendar {
  /** `YYYY-MM` do mês desenhado. */
  month: string;
  /** Semanas de sete dias, domingo a sábado — como o calendário brasileiro. */
  weeks: CalendarDay[][];
  /** Soma das saídas do mês. */
  totalSpent: number;
  /** Soma das entradas do mês. */
  totalEarned: number;
  /** O maior gasto de um único dia — a escala da intensidade da cor. */
  busiestDaySpent: number;
  /** Quantos dias do mês tiveram alguma saída. */
  daysWithSpending: number;
}

/** Rótulos da régua de cabeçalho, na ordem das colunas. */
export const WEEKDAY_LABELS = ["D", "S", "T", "Q", "Q", "S", "S"] as const;

function iso(ano: number, mes: number, dia: number): string {
  const pad = (valor: number) => String(valor).padStart(2, "0");
  return `${ano}-${pad(mes)}-${pad(dia)}`;
}

/**
 * A data de um lançamento como DIA LOCAL do calendário.
 *
 * O servidor grava em UTC e o app desenha em fuso local. Converter com `new
 * Date(iso).getDate()` jogaria uma compra das 22h de 31/08 no dia 1º de
 * setembro (ou o contrário, conforme o fuso) — e o dia errado num calendário
 * é o único erro que ele não pode cometer. O recorte é feito no texto ISO, que
 * é a data que o extrato do banco afirma.
 */
function dayKeyOf(isoDate: string): string {
  return isoDate.slice(0, 10);
}

/**
 * Os totais por dia a partir das LINHAS, para quem já as tem em mão.
 *
 * A Home não tem: lá os totais vêm agregados do servidor
 * (`GET /analytics/daily`), porque baixar 1.688 linhas para somar trinta
 * números custa 92 KB e segundos de espera. Esta função serve as telas que já
 * carregaram o extrato — e é ela que garante que os dois caminhos apliquem
 * exatamente as mesmas exclusões.
 */
export function dailyTotalsFrom(transactions: BankTransaction[]): DailyTotal[] {
  const porDia = new Map<string, DailyTotal>();
  for (const tx of transactions) {
    // As MESMAS exclusões das outras somas: um dia de aplicação não é um dia
    // caro, e um calendário que discorda da Análise é ruído, não leitura
    if (tx.internalTransfer || tx.ignored || tx.refunded) continue;
    const dia = dayKeyOf(tx.date);
    const registro = porDia.get(dia) ?? { date: dia, spent: 0, earned: 0, count: 0 };
    if (tx.amount < 0) registro.spent += Math.abs(tx.amount);
    else registro.earned += tx.amount;
    registro.count += 1;
    porDia.set(dia, registro);
  }
  return [...porDia.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Monta a grade.
 *
 * @param month `YYYY-MM`
 * @param days  totais por dia; dias fora do mês são ignorados
 */
export function buildSpendingCalendar(
  month: string,
  days: DailyTotal[],
): SpendingCalendar {
  const [ano, mes] = month.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  const diasNoMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const comecaEm = primeiro.getUTCDay(); // 0 = domingo

  const porDia = new Map<string, DailyTotal>();
  let totalSpent = 0;
  let totalEarned = 0;

  for (const dia of days) {
    // Dia de outro mês não entra: a grade é mensal, e um número de fora dela
    // é a forma mais fácil de somar errado
    if (!dayKeyOf(dia.date).startsWith(month)) continue;
    porDia.set(dayKeyOf(dia.date), dia);
    totalSpent += dia.spent;
    totalEarned += dia.earned;
  }

  const celulas: CalendarDay[] = [];
  // Preenchimento da primeira semana: os dias do mês anterior existem para a
  // coluna do dia da semana ficar certa, e vêm zerados de propósito — número
  // de outro mês numa grade mensal é a forma mais fácil de somar errado
  for (let i = 0; i < comecaEm; i++) {
    celulas.push(vazio(i - comecaEm));
  }
  for (let dia = 1; dia <= diasNoMes; dia++) {
    const chave = iso(ano, mes, dia);
    const registro = porDia.get(chave);
    celulas.push({
      date: chave,
      dayOfMonth: dia,
      inMonth: true,
      spent: registro?.spent ?? 0,
      earned: registro?.earned ?? 0,
      count: registro?.count ?? 0,
    });
  }
  while (celulas.length % 7 !== 0) {
    celulas.push(vazio(celulas.length));
  }

  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < celulas.length; i += 7) {
    weeks.push(celulas.slice(i, i + 7));
  }

  const gastosDosDias = [...porDia.values()].map((registro) => registro.spent);
  return {
    month,
    weeks,
    totalSpent,
    totalEarned,
    busiestDaySpent: gastosDosDias.length > 0 ? Math.max(...gastosDosDias) : 0,
    daysWithSpending: gastosDosDias.filter((valor) => valor > 0).length,
  };
}

function vazio(indice: number): CalendarDay {
  return {
    date: `fora-${indice}`,
    dayOfMonth: 0,
    inMonth: false,
    spent: 0,
    earned: 0,
    count: 0,
  };
}

/**
 * Quão forte pintar o dia, de 0 a 1.
 *
 * Escala pelo MAIOR gasto do mês, e não por um teto fixo: um mês de R$ 300 e
 * um de R$ 3.000 precisam contar a mesma história sobre o próprio ritmo. Raiz
 * quadrada porque um único dia de R$ 600 num mês de compras de R$ 30 achataria
 * todo o resto para o branco — o que se quer ver é o padrão da semana, não só
 * o pico.
 */
export function intensityOf(day: CalendarDay, busiestDaySpent: number): number {
  if (!day.inMonth || day.spent <= 0 || busiestDaySpent <= 0) return 0;
  return Math.min(1, Math.sqrt(day.spent / busiestDaySpent));
}
