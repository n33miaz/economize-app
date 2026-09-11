import type { DailyTotal } from "../services/api";

/**
 * A semana corrente, tirada dos mesmos dias que o calendário — EC-234.
 *
 * Pedido do dono: *"é importante que eu tenha na tela inicial uma visibilidade
 * mais mensal/semanal de tudo"*. O mês já estava respondido; faltava a semana.
 *
 * **De onde vem o número.** Dos MESMOS totais diários do calendário
 * (`GET /analytics/daily`), e não de uma segunda consulta. Duas fontes para a
 * mesma pergunta é como um app passa a discordar de si mesmo — que é o defeito
 * que o EC-200 fechou e este arquivo não vai reabrir.
 *
 * **A semana começa no domingo**, como o calendário brasileiro e como a grade
 * logo abaixo dela na tela. Semana ISO (segunda) daria um recorte diferente do
 * que o usuário vê desenhado, e dois recortes de "semana" na mesma tela é pior
 * que nenhum.
 */

export interface WeekCut {
  /** `YYYY-MM-DD` do domingo que abre a semana. */
  start: string;
  /** `YYYY-MM-DD` de hoje — a semana corrente é PARCIAL, e isso é dito. */
  today: string;
  spent: number;
  earned: number;
  /** Saídas da semana anterior INTEIRA, para comparar. */
  previousSpent: number;
  /** Dias já corridos desta semana, contando hoje. 1 a 7. */
  daysElapsed: number;
}

function isoOf(data: Date): string {
  const pad = (valor: number) => String(valor).padStart(2, "0");
  return `${data.getFullYear()}-${pad(data.getMonth() + 1)}-${pad(data.getDate())}`;
}

/**
 * @param days  totais diários; podem cobrir mais de um mês
 * @param hoje  o dia de referência, para o teste mandar no relógio
 */
export function currentWeek(days: DailyTotal[], hoje: Date = new Date()): WeekCut {
  const domingo = new Date(hoje);
  domingo.setDate(hoje.getDate() - hoje.getDay());
  const domingoAnterior = new Date(domingo);
  domingoAnterior.setDate(domingo.getDate() - 7);

  const inicio = isoOf(domingo);
  const inicioAnterior = isoOf(domingoAnterior);
  const hojeIso = isoOf(hoje);

  let spent = 0;
  let earned = 0;
  let previousSpent = 0;
  for (const dia of days) {
    const chave = dia.date.slice(0, 10);
    // Comparação de ISO como texto: `YYYY-MM-DD` ordena igual à data, e
    // converter para Date só para comparar abriria porta para fuso
    if (chave >= inicio && chave <= hojeIso) {
      spent += dia.spent;
      earned += dia.earned;
    } else if (chave >= inicioAnterior && chave < inicio) {
      previousSpent += dia.spent;
    }
  }

  return {
    start: inicio,
    today: hojeIso,
    spent,
    earned,
    previousSpent,
    daysElapsed: hoje.getDay() + 1,
  };
}

/**
 * A frase que compara a semana com a anterior.
 *
 * **Só compara o que é comparável.** Uma terça-feira contra uma semana inteira
 * é a comparação que faz todo app parecer otimista na segunda e alarmista no
 * sábado. Por isso a semana anterior entra proporcional aos dias já corridos —
 * e, quando não há semana anterior para comparar, a frase é `null` em vez de
 * um "0% a mais" inventado.
 */
export function weekComparison(semana: WeekCut): string | null {
  if (semana.previousSpent <= 0) return null;
  const proporcional = (semana.previousSpent * semana.daysElapsed) / 7;
  if (proporcional <= 0) return null;
  const variacao = (semana.spent - proporcional) / proporcional;
  const porCento = Math.round(Math.abs(variacao) * 100);
  // Abaixo de 5% a diferença é ruído da própria semana, não notícia
  if (porCento < 5) return "no mesmo ritmo da semana passada";
  return variacao > 0
    ? `${porCento}% acima do ritmo da semana passada`
    : `${porCento}% abaixo do ritmo da semana passada`;
}
