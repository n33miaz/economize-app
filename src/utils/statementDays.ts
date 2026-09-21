import type { BankTransaction } from "../services/api";
import { formatDayMonthShort, parseIsoDate } from "./cycleWindow";

/**
 * O extrato agrupado por dia, com o total do dia e o saldo corrido.
 *
 * <p>Escolha 8 do dono em 16/09/2026, variante <b>b</b>: <i>"a data sai da
 * linha e vira um cabeçalho fixo por dia, com o total do dia à direita (...) e
 * o cabeçalho do dia carrega também quanto havia em conta naquele dia"</i>. Ele
 * acrescentou: <i>"quero as coisas da opção a também"</i> — daí o total do dia
 * <b>e</b> o saldo, os dois no mesmo cabeçalho.
 *
 * <p>Antes disto a data era repetida em TODA linha, na terceira posição do
 * texto de apoio: vinte linhas do mesmo dia diziam "16 set" vinte vezes, e
 * nenhuma delas dizia quanto aquele dia custou.
 */

/** O mínimo que uma linha precisa ter para ser agrupada. */
type Agrupavel = Pick<BankTransaction, "date" | "amount" | "type">;

export interface DiaDoExtrato<T> {
  /** Chave ISO do dia (`2026-09-16`). Estável, serve de `key` de lista. */
  dia: string;
  /** O que entrou menos o que saiu naquele dia. */
  total: number;
  /**
   * Quanto havia em conta ao FIM daquele dia, ou `null` quando não se sabe.
   *
   * <p>`null` não é falha: é a resposta honesta quando falta o saldo de
   * partida, quando o recorte visível mistura contas ou quando é um cartão.
   * Ver `podeMostrarSaldoCorrido`.
   */
  saldoNoFim: number | null;
  /** As linhas daquele dia, na ordem em que vieram. */
  transacoes: T[];
}

/**
 * O total de um dia, derivado como em `calculateBankMetrics`.
 *
 * <p>Entradas menos saídas, e não a soma do valor assinado. Todo caminho de
 * importação grava débito negativo, então hoje os dois dão o mesmo número —
 * mas uma única linha com o sinal trocado faria o total do dia discordar do
 * "Líquido" do topo da tela, em silêncio. É a mesma armadilha que o comentário
 * de `bankMetrics` descreve, e o total do dia não pode cair nela por fora.
 */
function totalDoDia(transacoes: readonly Agrupavel[]): number {
  return transacoes.reduce((soma, tx) => {
    const valor = Math.abs(tx.amount);
    return tx.type === "CREDIT" ? soma + valor : soma - valor;
  }, 0);
}

/** A chave do dia, sem passar por `Date` — é o que evita deriva de fuso. */
function chaveDoDia(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  const mes = String(parsed.month).padStart(2, "0");
  const dia = String(parsed.day).padStart(2, "0");
  return `${parsed.year}-${mes}-${dia}`;
}

/**
 * Agrupa o extrato por dia, do mais recente para o mais antigo.
 *
 * <p>A ordem de saída é sempre decrescente, independente da ordem de entrada:
 * o saldo corrido só fecha se os dias estiverem em ordem, e depender da
 * ordenação de quem chama seria confiar num detalhe que muda longe daqui (hoje
 * o servidor devolve `order by t.date desc`).
 *
 * <p><b>A conta do saldo corrido.</b> O saldo informado pela conta reflete
 * tudo que já foi lançado, então ele é o saldo ao fim do dia mais recente da
 * lista. Dali para trás, cada dia vale o saldo do dia seguinte MENOS o total
 * do dia seguinte. É a convenção do extrato bancário, de cabeça para baixo.
 *
 * <p>Sem `saldoAtual`, todo `saldoNoFim` sai `null` e o cabeçalho mostra só o
 * total do dia. Inventar um saldo a partir da soma do extrato é exatamente o
 * defeito que o dono apontou na Previsão em 15/09 — os -19 mil vinham de somar
 * o extrato inteiro como se fosse saldo.
 */
export function agruparPorDia<T extends Agrupavel>(
  transacoes: readonly T[],
  opcoes: { saldoAtual?: number | null } = {},
): DiaDoExtrato<T>[] {
  const porDia = new Map<string, T[]>();
  for (const tx of transacoes) {
    const dia = chaveDoDia(tx.date);
    const atual = porDia.get(dia);
    if (atual) atual.push(tx);
    else porDia.set(dia, [tx]);
  }

  const dias = [...porDia.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([dia, linhas]) => ({
      dia,
      total: totalDoDia(linhas),
      saldoNoFim: null as number | null,
      transacoes: linhas,
    }));

  const { saldoAtual } = opcoes;
  if (saldoAtual === null || saldoAtual === undefined) return dias;

  let saldo = saldoAtual;
  for (const dia of dias) {
    dia.saldoNoFim = saldo;
    // O dia anterior fechou com o saldo deste dia menos o que este dia moveu
    saldo = saldo - dia.total;
  }
  return dias;
}

/**
 * Se o saldo corrido pode ser mostrado neste recorte.
 *
 * <p>Três condições, e nenhuma é decoração:
 *
 * <ul>
 *   <li><b>Uma conta só.</b> Com o filtro em "todas", somar os dias de contas
 *   diferentes daria um saldo que não existe em conta nenhuma.</li>
 *   <li><b>Conta, não cartão.</b> Num cartão um `CREDIT` é estorno ou
 *   pagamento da fatura, e a compra não move o saldo da conta corrente até a
 *   fatura ser paga. Um "saldo do dia" ali seria uma frase sem referente — é a
 *   mesma regra que `statementMetrics` aplica aos números do topo.</li>
 *   <li><b>Nada estreitando a lista.</b> O saldo corrido é uma soma
 *   acumulada: com busca ou recorte de período, as linhas que ficaram de fora
 *   continuam tendo movido o dinheiro, e cada cabeçalho mostraria um saldo que
 *   nunca existiu.</li>
 * </ul>
 */
export function podeMostrarSaldoCorrido(entrada: {
  saldoAtual?: number | null;
  tipoDaConta?: string | null;
  contaUnica: boolean;
  listaEstreitada: boolean;
}): boolean {
  if (entrada.saldoAtual === null || entrada.saldoAtual === undefined) {
    return false;
  }
  if (!entrada.contaUnica) return false;
  if (entrada.tipoDaConta === "CREDIT_CARD") return false;
  if (entrada.listaEstreitada) return false;
  return true;
}

/**
 * O rótulo do cabeçalho do dia.
 *
 * <p>"Hoje" e "Ontem" por nome: num extrato que se olha todo dia, a data
 * absoluta do dia de hoje é a informação menos útil da tela. Do antepenúltimo
 * dia para trás vale a data, porque "há 3 dias" obriga a pessoa a fazer a
 * conta de cabeça para saber qual dia foi.
 */
export function rotuloDoDia(dia: string, hojeIso: string): string {
  const alvo = parseIsoDate(dia);
  const hoje = parseIsoDate(hojeIso);
  if (!alvo || !hoje) return dia;

  const emDias = (d: { year: number; month: number; day: number }) =>
    Date.UTC(d.year, d.month - 1, d.day) / 86400000;
  const diferenca = emDias(hoje) - emDias(alvo);

  if (diferenca === 0) return "Hoje";
  if (diferenca === 1) return "Ontem";

  // `formatDayMonthShort` e não `Intl` direto: o app já escreve "15 set" em
  // toda linha de extrato e em toda folha de detalhe, e o `Intl` de pt-BR
  // devolve "15 de set." — o cabeçalho do dia não pode escrever a data num
  // formato que nenhuma outra tela usa
  const base = formatDayMonthShort(dia);
  // Com o ano corrente o ano fica implícito; de anos anteriores ele é a única
  // coisa que distingue "12 mar" de outro "12 mar"
  return alvo.year === hoje.year ? base : `${base} ${alvo.year}`;
}
