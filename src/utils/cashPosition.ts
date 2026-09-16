import type { ConnectorAccount } from "../services/api";

/**
 * Quanto a pessoa TEM — e a diferença entre saber e chutar.
 *
 * <p><b>O defeito que trouxe este arquivo, com data.</b> Em 15/09/2026 o dono
 * abriu a Home e disse: <i>"não faz o menor sentido ter sobrado 3.021,06 — não
 * tem nada nas minhas contas"</i>. Na Perspectiva de saldo, o app projetava que
 * ele fecharia o mês devendo <b>dezenove mil reais</b>: <i>"esse número é
 * absurdo"</i>. Estava certo nas duas.
 *
 * <p><b>A raiz é uma só: o app nunca soube um saldo.</b> Ele somava tudo o que
 * tinha sido importado — entradas menos saídas, desde o primeiro arquivo — e
 * usava o resultado como ponto de partida. Soma de movimento não é saldo. Ela
 * só coincidiria com o saldo se o extrato começasse no dia da abertura da conta
 * e não faltasse uma linha.
 *
 * <p>E há um erro pior embutido: <b>fatura de cartão entrava na mesma soma</b>.
 * Cada compra derruba o total, e depois o pagamento da fatura pela conta
 * corrente derruba de novo — o mesmo dinheiro contado duas vezes, sempre para
 * baixo. Quem importa cartão e conta afunda, e foi assim que se chegou aos
 * −R$ 20.515,63 que o app chamava de "o líquido do extrato que você importou".
 *
 * <p><b>A regra nova.</b> Saldo é um número com dono e com data: ou a
 * instituição informou (pelo conector, ou pelo bloco `LEDGERBAL` do OFX que o
 * usuário sobe), ou <b>não se sabe</b>. Não saber é um estado legítimo, e a
 * tela diz isso em vez de inventar. Crédito de cartão nunca é somado a
 * dinheiro: são duas perguntas diferentes, e misturá-las é o que faz alguém
 * achar que tem dinheiro que não tem.
 */

/** De onde veio o número — e, quando é `unknown`, por que não veio. */
export type CashSource = "REPORTED" | "UNKNOWN";

export interface CashPosition {
  /** Soma dos saldos informados pelas contas de banco. `null` = não sei. */
  amount: number | null;
  source: CashSource;
  /** Contas de banco no total. */
  bankAccounts: number;
  /** Quantas delas informaram saldo. */
  withBalance: number;
  /** A leitura mais VELHA entre as usadas — é ela que decide a ressalva. */
  oldestReadAt: string | null;
  /**
   * Uma frase para a tela, ou `null` quando não há ressalva a fazer. Nunca
   * "os números não batem": sempre o que exatamente falta.
   */
  caveat: string | null;
}

export interface CreditPosition {
  /** Soma dos limites informados. `null` = nenhum cartão informou. */
  limit: number | null;
  /** Soma do que se deve hoje nos cartões (o saldo informado do cartão). */
  owed: number | null;
  /** Quanto ainda dá para gastar. `null` quando falta limite ou dívida. */
  available: number | null;
  cards: number;
  /** Cartões com limite próprio informado (os que dividem bolsa não contam). */
  cardsWithLimit: number;
}

/** Quanto tempo uma leitura pode ter antes de virar ressalva na tela. */
const HORAS_ATE_VELHO = 48;

const ehBanco = (conta: ConnectorAccount) => conta.type === "BANK";
const ehCartao = (conta: ConnectorAccount) => conta.type === "CREDIT_CARD";

const horasDesde = (iso: string, agora: number): number =>
  (agora - new Date(iso).getTime()) / 3_600_000;

/**
 * O dinheiro em conta, a partir do que as instituições informaram.
 *
 * @param agora injetado para o teste mandar no relógio
 */
export function cashPositionFrom(
  accounts: ConnectorAccount[],
  agora: number = Date.now(),
): CashPosition {
  const bancos = accounts.filter(ehBanco);
  const comSaldo = bancos.filter((c) => c.reportedBalance != null);

  if (comSaldo.length === 0) {
    return {
      amount: null,
      source: "UNKNOWN",
      bankAccounts: bancos.length,
      withBalance: 0,
      oldestReadAt: null,
      caveat:
        bancos.length === 0
          ? "Nenhuma conta cadastrada ainda."
          : "Nenhuma das suas contas informou saldo.",
    };
  }

  const amount = comSaldo.reduce(
    (soma, c) => soma + (c.reportedBalance ?? 0),
    0,
  );

  const datas = comSaldo
    .map((c) => c.reportedBalanceAt)
    .filter((d): d is string => Boolean(d))
    .sort();
  const oldestReadAt = datas[0] ?? null;

  const faltando = bancos.length - comSaldo.length;
  const velho =
    oldestReadAt != null && horasDesde(oldestReadAt, agora) >= HORAS_ATE_VELHO;

  // A ordem importa: falta de conta é um buraco no NÚMERO, leitura velha é um
  // buraco na DATA. Quando as duas valem, a primeira é a que muda mais o valor
  let caveat: string | null = null;
  if (faltando > 0) {
    caveat =
      faltando === 1
        ? "1 conta não informou saldo e ficou de fora."
        : `${faltando} contas não informaram saldo e ficaram de fora.`;
  } else if (velho) {
    caveat = "A última leitura tem mais de dois dias.";
  }

  return {
    amount,
    source: "REPORTED",
    bankAccounts: bancos.length,
    withBalance: comSaldo.length,
    oldestReadAt,
    caveat,
  };
}

/**
 * O crédito dos cartões — e por que ele NUNCA entra na conta do dinheiro.
 *
 * <p>Pedido do dono, na mesma conversa: <i>"atualmente eu só tenho saldo
 * disponível em crédito nos cartões, mas sempre devemos deixar bem claro
 * isso"</i>. Limite disponível é permissão para gastar dinheiro que ainda não
 * é seu; somá-lo ao saldo seria transformar dívida futura em patrimônio.
 *
 * <p><b>Limite compartilhado conta uma vez só.</b> Também dele: <i>"normalmente
 * um crédito vale para vários cartões"</i>. O cartão virtual e o adicional
 * consomem a mesma bolsa — somar os dois mostraria o dobro do crédito que
 * existe. Quem aponta para outro cartão não entra na soma de limite; o que ele
 * DEVE, entra, porque a dívida é dele.
 */
export function creditPositionFrom(
  accounts: ConnectorAccount[],
): CreditPosition {
  const cartoes = accounts.filter(ehCartao);
  const comLimiteProprio = cartoes.filter(
    (c) => c.creditLimit != null && c.creditLimitSharedWith == null,
  );

  const limit =
    comLimiteProprio.length === 0
      ? null
      : comLimiteProprio.reduce((soma, c) => soma + (c.creditLimit ?? 0), 0);

  const comDevido = cartoes.filter((c) => c.reportedBalance != null);
  // O cartão informa o devido com o sinal do banco (negativo quase sempre); o
  // que a tela quer dizer é "você deve X", então o valor sai positivo
  const owed =
    comDevido.length === 0
      ? null
      : comDevido.reduce(
          (soma, c) => soma + Math.abs(c.reportedBalance ?? 0),
          0,
        );

  return {
    limit,
    owed,
    available: limit == null || owed == null ? null : limit - owed,
    cards: cartoes.length,
    cardsWithLimit: comLimiteProprio.length,
  };
}
