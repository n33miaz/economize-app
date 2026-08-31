import { readProblem } from "./recurrence";
import { formatBRL } from "./money";

import type {
  IncomeSourceKind,
  Wish,
  WishBaseline,
  WishGap,
  WishProjection,
  WishStatus,
} from "../services/api";

/**
 * A camada que transforma os números do servidor em frases que doem — ou que
 * animam.
 *
 * <p>"R$ 18.000" não diz nada a ninguém. "Quatro meses do seu ano" diz. Toda a
 * razão de existir dos Desejos está nessa tradução, e por isso ela mora em
 * funções puras, testáveis, e não espalhada dentro de JSX.
 */

/** Horas de trabalho, no formato que a tela mostra em destaque. */
export function formatHours(hours: number | null): string | null {
  if (hours == null) return null;
  // Acima de cem horas a casa decimal só polui: "709 h" e "709,1 h" informam
  // o mesmo, e o número redondo é mais fácil de guardar de cabeça
  if (hours >= 100) return `${Math.round(hours).toLocaleString("pt-BR")} h`;
  return `${hours.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

export function formatWorkDays(days: number | null): string | null {
  if (days == null) return null;
  const rounded = days >= 100 ? Math.round(days) : days;
  const label = rounded.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
  return `${label} ${rounded === 1 ? "dia" : "dias"} de trabalho`;
}

/**
 * A frase que dá o baque: o preço medido em pedaço de vida.
 *
 * <p>Só aparece a partir de meio mês de trabalho — abaixo disso "0,2 meses do
 * seu ano" é mais confuso do que os dias, que a pessoa já entende.
 */
export function describeLifeCost(
  hours: number | null,
  hoursPerMonth: number | null,
): string | null {
  if (hours == null || !hoursPerMonth || hoursPerMonth <= 0) return null;
  const months = hours / hoursPerMonth;
  if (months < 0.5) return null;
  if (months < 12) {
    return `${months.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} meses do seu ano`;
  }
  const years = months / 12;
  return `${years.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos de trabalho`;
}

/** Quanto do desejo já está guardado, de 0 a 1. */
export function wishProgress(wish: Wish): number {
  if (wish.targetAmount <= 0) return 0;
  const ratio = wish.savedAmount / wish.targetAmount;
  return Math.max(0, Math.min(1, ratio));
}

export function statusLabel(status: WishStatus): string {
  switch (status) {
    case "WISH":
      return "Quero";
    case "GOAL":
      return "Guardando";
    case "PURCHASED":
      return "Comprado";
    case "ARCHIVED":
      return "Arquivado";
  }
}

export function incomeKindLabel(kind: IncomeSourceKind): string {
  switch (kind) {
    case "SALARY":
      return "Salário";
    case "MEAL_VOUCHER":
      return "Vale-refeição";
    case "FOOD_VOUCHER":
      return "Vale-alimentação";
    case "ADVANCE":
      return "Adiantamento";
    case "OTHER":
      return "Outra renda";
  }
}

export interface GapPrompt {
  /** O que falta, na voz de quem usa. */
  title: string;
  /** Por que isso muda o resultado — sem isso o pedido parece burocracia. */
  reason: string;
  /** Rótulo do botão que resolve. */
  action: string;
}

/**
 * Cada lacuna vira um convite acionável, nunca um erro.
 *
 * <p>Faltar dado é o estado NORMAL de quem acabou de instalar o app. Tratar
 * isso como falha ensina a pessoa a ignorar a tela.
 */
export function gapPrompt(gap: WishGap): GapPrompt {
  switch (gap) {
    case "WORK_PROFILE":
      return {
        title: "Quantas horas você trabalha?",
        reason:
          "Sem a sua jornada não dá para dizer quanto um desejo custa em horas de vida.",
        action: "Informar jornada",
      };
    case "CONFIRMED_INCOME":
      return {
        title: "Confirme o quanto você recebe",
        reason:
          "O valor da sua hora sai daí. Preferimos não calcular a calcular por cima de um palpite.",
        action: "Confirmar renda",
      };
    case "HISTORY":
      return {
        title: "Importe um extrato",
        reason:
          "É do seu histórico que sai a sobra típica do mês — e é ela que diz em quanto tempo o desejo chega.",
        action: "Importar extrato",
      };
    case "NO_LEFTOVER":
      return {
        title: "Seus meses estão fechando no vermelho",
        reason:
          "Sem sobra não há prazo. Os cenários de corte abaixo mostram o que mudaria isso.",
        action: "Ver para onde foi",
      };
  }
}

/**
 * A leitura curta da projeção — o que o cartão do desejo mostra sob o nome.
 *
 * <p>Devolve `null` quando não há prazo: a tela mostra a lacuna no lugar, que
 * é mais útil do que "prazo indisponível".
 */
export function describePace(projection: WishProjection): string | null {
  if (projection.achieved) return "Você já tem o valor completo";
  if (projection.monthsToAfford == null || projection.maxInstallment == null) {
    return null;
  }
  const months = projection.monthsToAfford;
  const parcela = formatBRL(projection.maxInstallment);
  if (months === 1) return `Fecha neste mês, guardando ${parcela}`;
  return `${months} meses guardando ${parcela} por mês`;
}

/**
 * O cenário de corte, em uma frase.
 *
 * <p>Fala em reais, e não em porcentagem: ninguém corta 12% do mês, mas todo
 * mundo entende cortar R$ 150.
 */
export function describeWhatIf(whatIf: {
  monthlyCut: number;
  months: number | null;
  monthsEarlier: number | null;
}): string {
  const cut = formatBRL(whatIf.monthlyCut);
  if (whatIf.monthsEarlier != null && whatIf.monthsEarlier > 0) {
    const plural = whatIf.monthsEarlier === 1 ? "mês antes" : "meses antes";
    return `Cortando ${cut} por mês, chega ${whatIf.monthsEarlier} ${plural}`;
  }
  if (whatIf.months != null) {
    return `Cortando ${cut} por mês, chega em ${whatIf.months} meses`;
  }
  return `Cortando ${cut} por mês`;
}

/**
 * A frase do topo da tela: quanto vale uma hora da pessoa.
 * `null` enquanto faltar renda confirmada ou jornada — e aí quem fala é a lacuna.
 */
export function describeHourlyRate(baseline: WishBaseline): string | null {
  if (baseline.hourlyRate == null) return null;
  return `Sua hora vale ${formatBRL(baseline.hourlyRate)}`;
}

const ERROR_TRANSLATIONS: { match: RegExp; message: string }[] = [
  {
    match: /Valor já guardado não pode ser maior/i,
    message: "O quanto você já guardou não pode passar do valor do desejo.",
  },
  {
    match: /Limite de \d+ desejos/i,
    message: "Você chegou ao limite de desejos. Arquive algum para criar outro.",
  },
  {
    match: /Data da compra não pode estar no futuro/i,
    message: "A data da compra não pode estar no futuro.",
  },
  {
    match: /Categoria não encontrada/i,
    message: "Essa categoria não existe mais. Escolha outra.",
  },
  {
    match: /Status inválido/i,
    message: "Estado inválido para o desejo.",
  },
  {
    match: /Já existe uma fonte de renda/i,
    message: "Você já tem uma fonte de renda desse tipo com esse nome.",
  },
  {
    match: /Essa série já virou uma fonte/i,
    message: "Essa renda já foi confirmada antes.",
  },
  {
    match: /Tipo inválido/i,
    message: "Tipo de renda inválido.",
  },
  {
    match: /Usuário não encontrado/i,
    message: "Sua sessão não confere. Entre novamente.",
  },
];

export function translateWishError(error: unknown, fallback: string): string {
  const problem = readProblem(error);
  if (!problem.detail) return fallback;
  const hit = ERROR_TRANSLATIONS.find((rule) =>
    rule.match.test(problem.detail as string),
  );
  if (hit) return hit.message;
  // 400/409 já vêm em português do servidor e dizem mais que um genérico; o
  // que não pode vazar para a tela é erro cru de 500 ou de rede
  return problem.status === 400 || problem.status === 409
    ? (problem.detail as string)
    : fallback;
}

/** "10/09" — dia e mês bastam: a lista cabe num mês. */
export function formatDueDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/**
 * Quando o próximo pagamento cai, na voz de quem espera por ele.
 *
 * <p>"Cai hoje" importa: no dia do pagamento, dizer "faltam 30 dias" (a próxima
 * ocorrência) seria o oposto da verdade.
 */
export function describeSalaryTiming(
  daysUntilSalary: number | null,
  salaryDate: string | null,
): string | null {
  if (daysUntilSalary == null || salaryDate == null) return null;
  const quando = formatDueDate(salaryDate);
  if (daysUntilSalary <= 0) return `Cai hoje (${quando})`;
  if (daysUntilSalary === 1) return `Cai amanhã (${quando})`;
  return `Cai em ${daysUntilSalary} dias (${quando})`;
}

/**
 * A frase-resumo do salário que ainda não chegou.
 *
 * <p>É a pergunta do fim do mês inteira em uma linha: do que vem, quanto já
 * está prometido e quanto sobra de verdade.
 */
export function describeCommitted(overview: {
  salaryKnown: boolean;
  expectedSalary: number | null;
  committedAfterSalary: number;
  free: number | null;
}): string {
  if (!overview.salaryKnown) {
    return "Cadastre seu salário para ver quanto dele já tem dono";
  }
  const comprometido = formatBRL(overview.committedAfterSalary);
  if (overview.free == null) {
    return `${comprometido} já têm dono`;
  }
  return `${comprometido} já têm dono · sobram ${formatBRL(overview.free)}`;
}
