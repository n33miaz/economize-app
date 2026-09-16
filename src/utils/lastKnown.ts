import type { ConnectorAccount, MonthlyAnalytics } from "../services/api";
import { hasMovement } from "../store/analyticsStore";
import { cashPositionFrom } from "./cashPosition";
import { formatMonthLabel, formatWindowLabel } from "./cycleWindow";

/**
 * O que o app SABIA antes de o servidor dormir — e o que ele pode afirmar
 * disso enquanto o servidor acorda.
 *
 * <p>O pedido do dono, em 15/09/2026: <i>"estou achando que a api está
 * demorando muito para carregar e mostrar meus saldos a primeira vez"</i>. A
 * hospedagem gratuita hiberna a API e o primeiro acesso do dia pode levar
 * quatro minutos; até aqui esses minutos eram uma cortina e um relógio. Os
 * números da última visita estavam no aparelho — só não eram mostrados.
 *
 * <p><b>A regra.</b> Mostrar dado guardado é mostrar dado VELHO, e velho só
 * pode aparecer com data ao lado. Por isso cada pedaço só entra quando veio
 * com o seu instante: contas sem `accountsAt` e consolidação sem `homeDataAt`
 * não têm como provar de quando são, e não entram. Sem nada que entre, o
 * resultado é `null` — a tela não desenha o bloco. Nunca um zero: zero é um
 * número, e "não sei" não é zero.
 *
 * <p>A ordem de preferência da manchete é a MESMA da Home (ver
 * `utils/cashPosition`): o saldo que a instituição informou; sem ele, o
 * resultado do período. A pessoa lê aqui o mesmo número que vai ler na tela
 * de trás quando o servidor responder — mudar o critério faria os dois
 * discordarem.
 */

export interface LastKnownLine {
  /** Rótulo pronto para a tela ("Em conta", "Sobrou em set 2026"). */
  label: string;
  /** Com o sinal que a Home usa: negativo quando faltou. */
  amount: number;
}

export interface LastKnownSnapshot {
  headline: LastKnownLine;
  /** Os gastos do período, quando a consolidação estava guardada. */
  expenses: LastKnownLine | null;
  /**
   * O instante mais VELHO entre os que entraram, em ISO. A legenda carimba o
   * pior caso: se o saldo é de ontem e o mês é de hoje, o bloco é de ontem.
   */
  at: string;
}

export interface LastKnownInput {
  accounts: ConnectorAccount[];
  accountsAt: string | null;
  homeData: MonthlyAnalytics | null;
  homeDataAt: string | null;
}

/**
 * "em set 2026" no modo mês, "no ciclo 12/07 → 11/08" no modo janela — o
 * complemento que cola em "Sobrou", "Faltou" e "Gastos". Mesmos rótulos que a
 * Home usa, pela mesma razão de sempre: duas telas, uma verdade.
 */
function periodComplement(data: MonthlyAnalytics): string {
  if (data.month) return `em ${formatMonthLabel(data.month)}`;
  const window = formatWindowLabel(data.start, data.end);
  return window ? `no ciclo ${window}` : "no período";
}

const oldestOf = (instants: string[]): string =>
  instants.reduce((oldest, current) =>
    new Date(current).getTime() < new Date(oldest).getTime() ? current : oldest,
  );

export function lastKnownSnapshot(
  input: LastKnownInput,
): LastKnownSnapshot | null {
  // `cashPositionFrom` responde null quando nenhuma conta informou saldo; o
  // `accountsAt` na frente é a exigência de data, explicada no topo
  const cash = input.accountsAt ? cashPositionFrom(input.accounts) : null;
  const cashAmount = cash?.amount ?? null;
  // Consolidação zerada (ciclo parado) não é "o que eu sabia": é a ausência
  // de movimento, e desenhá-la aqui seria mostrar R$ 0,00 como informação
  const month =
    input.homeDataAt && hasMovement(input.homeData) ? input.homeData : null;

  if (cashAmount === null && month === null) return null;

  const usedInstants: string[] = [];
  if (cashAmount !== null && input.accountsAt) usedInstants.push(input.accountsAt);
  if (month && input.homeDataAt) usedInstants.push(input.homeDataAt);

  let headline: LastKnownLine;
  if (cashAmount !== null) {
    // Sem o "hoje" da Home: o bloco inteiro é passado, e a legenda logo
    // abaixo diz de quando. "Em conta hoje" ao lado de "pode estar
    // desatualizado" seria a tela discordando de si mesma na mesma linha
    headline = { label: "Em conta", amount: cashAmount };
  } else {
    const data = month as MonthlyAnalytics;
    const complement = periodComplement(data);
    // "Sobrou" em cima de número negativo é frase errada — a mesma regra da
    // manchete da Home
    headline = {
      label: data.net < 0 ? `Faltou ${complement}` : `Sobrou ${complement}`,
      amount: data.net,
    };
  }

  const expenses: LastKnownLine | null = month
    ? { label: `Gastos ${periodComplement(month)}`, amount: month.totalExpense }
    : null;

  return { headline, expenses, at: oldestOf(usedInstants) };
}
