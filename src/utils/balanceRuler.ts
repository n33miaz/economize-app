import type { ForecastItem } from "../services/api";
import { parseIsoDate } from "./cycleWindow";

/**
 * A RÉGUA DE SALDO: os próximos 30 dias, dia a dia, só com o que está escrito
 * em algum lugar — e uma parada explícita onde o saber acaba.
 *
 * <p>Escolha 9 do dono em 16/09/2026, variante <b>a</b>: <i>"uma linha do
 * tempo do próximo mês, dia a dia, só com o que está escrito em algum lugar:
 * salário, fatura fechada, recorrência confirmada, parcela. O saldo caminha
 * junto. Quando o conhecido termina, aparece uma faixa dizendo 'daqui para
 * frente eu não sei' — e a tela pára. Nenhum número inventado"</i>. Ele
 * acrescentou: <i>"isso para mais controles, com elementos da opção c e
 * adicione a opção b também"</i> — daí a lista de contratados (c) e os três
 * cenários (b), que moram aqui embaixo.
 *
 * <p><b>O que isto substitui.</b> A tela projetava SEIS MESES, um número por
 * mês. O dono já havia apontado o resultado disso em 15/09 (o saldo de -19 mil
 * que não existia), e a causa daquele número foi corrigida — mas a forma
 * ficou: meio ano à frente, ninguém sabe nada, e um número único por mês
 * apresenta um chute com a mesma cara de um fato.
 */

/** A janela da régua. Trinta dias, como o dono escolheu. */
export const DIAS_DA_REGUA = 30;

export interface EventoDoDia {
  seriesId: string;
  nome: string;
  /** Assinado: entrada positiva, saída negativa. */
  valor: number;
}

export interface DiaDaRegua {
  /** Chave ISO do dia (`2026-09-18`). */
  dia: string;
  /** Quantos dias à frente de hoje, para a tela posicionar sem recontar. */
  passos: number;
  eventos: EventoDoDia[];
  /** O que o dia move, somado. Zero num dia sem evento. */
  movimento: number;
  /** O saldo ao FIM do dia. */
  saldoNoFim: number;
}

export interface Regua {
  dias: DiaDaRegua[];
  saldoInicial: number;
  /**
   * O último dia em que o app sabe de algo. `null` quando não há um único
   * compromisso datado nos 30 dias — e aí a régua não existe, em vez de
   * desenhar trinta dias planos que dariam a impressão de que nada vai
   * acontecer.
   */
  ultimoDiaConhecido: string | null;
  /** O saldo no último dia conhecido. É onde a faixa de "não sei" começa. */
  saldoNoFimDoConhecido: number;
  /** O menor saldo da janela, e em que dia — o que a régua existe para achar. */
  piorDia: { dia: string; saldo: number } | null;
}

const UM_DIA = 86400000;

const emDias = (iso: string): number | null => {
  const p = parseIsoDate(iso);
  if (!p) return null;
  return Date.UTC(p.year, p.month - 1, p.day) / UM_DIA;
};

const diaIso = (numero: number): string => {
  const d = new Date(numero * UM_DIA);
  const mes = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dia = String(d.getUTCDate()).padStart(2, "0");
  return `${d.getUTCFullYear()}-${mes}-${dia}`;
};

/**
 * O valor assinado de um item da previsão.
 *
 * <p>Pelo `flow`, e nunca pelo sinal de `amount`: os dois caminhos que
 * alimentam a previsão (recorrência cadastrada e parcela de cartão) não
 * combinaram sinal, e uma despesa com `amount` positivo somaria como receita.
 * É a mesma armadilha que `bankMetrics` documenta para o extrato.
 */
export function valorAssinado(item: Pick<ForecastItem, "flow" | "amount">) {
  const modulo = Math.abs(Number(item.amount) || 0);
  return item.flow === "INCOME" ? modulo : -modulo;
}

/**
 * Monta a régua.
 *
 * <p>Itens sem `dueDate` ficam de FORA, e é de propósito: cadência semanal
 * chega com data nula (o comentário de `ForecastItem` explica por quê), e sem
 * data não há dia onde pôr o evento. Colocá-los "no primeiro dia" moveria o
 * saldo num dia em que nada acontece — pior que omitir, porque a régua existe
 * justamente para dizer QUANDO.
 *
 * <p>Itens já conciliados (`settled`) também ficam fora: eles já estão dentro
 * do saldo de partida, e contá-los de novo é o mesmo erro da parcela que era
 * cobrada duas vezes em "a pagar" (corrigido em 16/09).
 */
export function montarRegua(entrada: {
  saldoInicial: number;
  itens: readonly ForecastItem[];
  hoje: string;
  dias?: number;
}): Regua {
  const { saldoInicial, itens, hoje } = entrada;
  const janela = entrada.dias ?? DIAS_DA_REGUA;
  const hojeNum = emDias(hoje);

  const vazia: Regua = {
    dias: [],
    saldoInicial,
    ultimoDiaConhecido: null,
    saldoNoFimDoConhecido: saldoInicial,
    piorDia: null,
  };
  if (hojeNum === null) return vazia;

  const porDia = new Map<number, EventoDoDia[]>();
  for (const item of itens) {
    if (item.settled) continue;
    if (!item.dueDate) continue;
    const quando = emDias(item.dueDate);
    if (quando === null) continue;
    // Passado não entra: a régua é para frente. Um compromisso vencido e não
    // conciliado é assunto de outra tela, e somá-lo aqui mexeria no saldo de
    // hoje sem que nada tenha acontecido hoje
    if (quando < hojeNum) continue;
    if (quando > hojeNum + janela) continue;
    const evento: EventoDoDia = {
      seriesId: item.seriesId,
      nome: item.displayName,
      valor: valorAssinado(item),
    };
    const atual = porDia.get(quando);
    if (atual) atual.push(evento);
    else porDia.set(quando, [evento]);
  }

  if (porDia.size === 0) return vazia;

  const ultimoConhecido = Math.max(...porDia.keys());

  // A régua vai de hoje até o último dia conhecido — não até o 30º dia. Vinte
  // dias vazios depois do último compromisso é justamente a parte que o app
  // não sabe, e desenhá-los como "saldo estável" seria a afirmação que a
  // escolha 9 proíbe
  const dias: DiaDaRegua[] = [];
  let saldo = saldoInicial;
  let pior: { dia: string; saldo: number } | null = null;

  for (let n = hojeNum; n <= ultimoConhecido; n++) {
    const eventos = porDia.get(n) ?? [];
    const movimento = eventos.reduce((soma, e) => soma + e.valor, 0);
    saldo += movimento;
    const dia = diaIso(n);
    dias.push({
      dia,
      passos: n - hojeNum,
      eventos,
      movimento,
      saldoNoFim: saldo,
    });
    if (!pior || saldo < pior.saldo) pior = { dia, saldo };
  }

  return {
    dias,
    saldoInicial,
    ultimoDiaConhecido: diaIso(ultimoConhecido),
    saldoNoFimDoConhecido: saldo,
    piorDia: pior,
  };
}

/**
 * A lista de contratados: cada compromisso com data, valor e o saldo que sobra
 * depois dele (elementos da opção <b>c</b>, que o dono pediu junto).
 *
 * <p>Sai da MESMA régua, e não de uma segunda passada sobre os itens: duas
 * somas independentes sobre o mesmo dado é como a lista e o gráfico começam a
 * discordar em silêncio.
 */
export interface Contratado {
  seriesId: string;
  dia: string;
  nome: string;
  valor: number;
  /** O saldo depois deste compromisso. */
  saldoDepois: number;
}

export function contratados(regua: Regua): Contratado[] {
  const lista: Contratado[] = [];
  let saldo = regua.saldoInicial;
  for (const dia of regua.dias) {
    for (const evento of dia.eventos) {
      saldo += evento.valor;
      lista.push({
        seriesId: evento.seriesId,
        dia: dia.dia,
        nome: evento.nome,
        valor: evento.valor,
        saldoDepois: saldo,
      });
    }
  }
  return lista;
}

/**
 * Os três cenários (opção <b>b</b>).
 *
 * <p><b>Só a despesa muda entre eles.</b> A receita é a contratada nos três —
 * inventar receita otimista é a forma mais rápida de um app de finanças mentir
 * para quem confia nele. O que separa os cenários é quanto a pessoa gasta
 * ALÉM do que está contratado:
 *
 * <ul>
 *   <li><b>Folgado</b>: só o contratado. É o teto honesto — e o único dos três
 *   que não é estimativa.</li>
 *   <li><b>Esperado</b>: a média dos últimos três meses.</li>
 *   <li><b>Apertado</b>: o pior mês recente.</li>
 * </ul>
 *
 * <p><b>A guarda que impede contradição.</b> Se a média (ou o pior mês) for
 * MENOR que a despesa já contratada, o cenário "esperado" apareceria mais
 * folgado que o "folgado" — e a tela mostraria três números fora de ordem,
 * cada um contradizendo o vizinho. Nesse caso a despesa estimada é elevada ao
 * piso do que está contratado: o que está assinado não deixa de ser devido só
 * porque o histórico é curto.
 */
export type ChaveDeCenario = "folgado" | "esperado" | "apertado";

export interface Cenario {
  chave: ChaveDeCenario;
  rotulo: string;
  /** O saldo ao fim da janela neste cenário. */
  saldo: number;
  /** De onde o número saiu, para a tela poder escrever isso. */
  base: string;
  /** Falso só no "folgado": os outros dois são estimativa. */
  estimativa: boolean;
}

export function tresCenarios(entrada: {
  saldoInicial: number;
  /** Receitas contratadas na janela (positivo). */
  receitaContratada: number;
  /** Despesas contratadas na janela (positivo). */
  despesaContratada: number;
  /** Média de despesa dos últimos meses (positivo), ou null sem histórico. */
  despesaMedia: number | null;
  /** Despesa do pior mês recente (positivo), ou null sem histórico. */
  despesaPiorMes: number | null;
}): Cenario[] {
  const { saldoInicial, receitaContratada, despesaContratada } = entrada;
  const base = saldoInicial + receitaContratada;

  const cenarios: Cenario[] = [
    {
      chave: "folgado",
      rotulo: "Folgado",
      saldo: base - despesaContratada,
      base: "só o que está contratado",
      estimativa: false,
    },
  ];

  // O piso: o que está assinado não deixa de ser devido porque o histórico é
  // curto. Sem ele os três números saíam fora de ordem
  const comPiso = (valor: number) => Math.max(valor, despesaContratada);

  if (entrada.despesaMedia !== null) {
    cenarios.push({
      chave: "esperado",
      rotulo: "Esperado",
      saldo: base - comPiso(Math.abs(entrada.despesaMedia)),
      base: "média dos últimos meses",
      estimativa: true,
    });
  }

  if (entrada.despesaPiorMes !== null) {
    cenarios.push({
      chave: "apertado",
      rotulo: "Apertado",
      saldo: base - comPiso(Math.abs(entrada.despesaPiorMes)),
      base: "gastando como no pior mês recente",
      estimativa: true,
    });
  }

  return cenarios;
}

/** As duas somas contratadas da janela, tiradas da própria régua. */
export function somasContratadas(regua: Regua): {
  receita: number;
  despesa: number;
} {
  let receita = 0;
  let despesa = 0;
  for (const dia of regua.dias) {
    for (const evento of dia.eventos) {
      if (evento.valor >= 0) receita += evento.valor;
      else despesa += -evento.valor;
    }
  }
  return { receita, despesa };
}
