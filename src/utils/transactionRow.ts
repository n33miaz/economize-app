import type { BankTransaction, ConnectorAccount } from "../services/api";
import { accountDisplayName, originLabel } from "./accounts";
import { formatDayMonthShort } from "./cycleWindow";
import { formatBRL } from "./money";
import {
  isRenamed,
  transactionDisplayName,
  transactionOriginalName,
} from "./transactions";

/**
 * Regras da linha de lançamento — as mesmas para o Extrato, a Fatura e a
 * Revisão.
 *
 * Antes, cada tela decidia sozinha o que é crédito, que cor o valor veste, o
 * que a linha fala para o leitor de tela e onde a data fica. Três telas, três
 * respostas: a Revisão pintava débito de vermelho enquanto o Extrato deixava
 * neutro; a Fatura dizia "compra" onde o Extrato dizia "saída"; nenhuma
 * desenhava os selos de ignorada/entre contas/estornada que a folha de
 * detalhes já conhecia. Aqui a resposta existe UMA vez, sem depender de tema
 * nem de componente — é o que deixa cada regra testável sem montar tela.
 */

/** Como o valor é falado: conta corrente (entrada/saída) ou cartão (crédito/compra). */
export type TransactionRowVoice = "bank" | "card";

/**
 * O tom do valor. `up` é dinheiro entrando; `neutral` é saída — de propósito
 * sem vermelho, porque gastar não é erro; `muted` rebaixa a linha que NÃO
 * conta nas somas (ignorada, entre contas, estornada) sem pintá-la de perigo.
 */
export type AmountTone = "up" | "neutral" | "muted";

export type RowBadgeKey =
  | "pending"
  | "ignored"
  | "internal"
  | "family"
  | "refunded";

/** Só `warning` para o que pede ação; procedência e marcas são neutras. */
export type RowBadgeTone = "neutral" | "warning";

export interface RowBadge {
  key: RowBadgeKey;
  label: string;
  tone: RowBadgeTone;
  /** Como o selo é FALADO — "aguardando revisão" é o que o app sempre disse. */
  spoken: string;
}

/**
 * O que as regras leem da transação. As marcas são opcionais de propósito:
 * servidor mais velho e fixtures de teste montam a linha sem elas, e a
 * ausência não pode derrubar a tela — `undefined` lê como "não marcada".
 */
export type RowTransaction = Pick<
  BankTransaction,
  | "type"
  | "amount"
  | "date"
  | "description"
  | "originalDescription"
  | "displayAlias"
  | "reviewStatus"
  | "accountId"
> &
  Partial<
    Pick<
      BankTransaction,
      "ignored" | "internalTransfer" | "familyTransfer" | "refunded"
    >
  >;

/** Separador da linha de apoio: "Alimentação · Nubank · 13 set". */
export const SUPPORT_SEPARATOR = " · ";

/**
 * Débito é o que sai. A Revisão já unia sinal e tipo (`amount < 0 || DEBIT`)
 * enquanto Extrato e Fatura olhavam só o tipo — e um servidor que mandasse
 * `CREDIT` com valor negativo era lido de dois jeitos. A fonte única fica com
 * a leitura mais defensiva.
 */
export function isDebit(tx: Pick<RowTransaction, "type" | "amount">): boolean {
  return tx.amount < 0 || tx.type === "DEBIT";
}

export function isCredit(tx: Pick<RowTransaction, "type" | "amount">): boolean {
  return !isDebit(tx);
}

/** Categorização ainda não confirmada pelo usuário. */
export function isPendingReview(
  tx: Pick<RowTransaction, "reviewStatus">,
): boolean {
  return Boolean(tx.reviewStatus) && tx.reviewStatus !== "CONFIRMED";
}

/**
 * O verbo do valor no idioma da conta. No cartão, crédito é estorno ou
 * pagamento e débito é compra — chamar compra de "saída" descreveria a conta
 * corrente, que é outra coisa.
 */
export function amountVerb(
  tx: Pick<RowTransaction, "type" | "amount">,
  voice: TransactionRowVoice,
): string {
  const credit = isCredit(tx);
  if (voice === "card") return credit ? "crédito" : "compra";
  return credit ? "entrada" : "saída";
}

/** "+ R$ 1.234,56" / "- R$ 89,90": sinal com espaço, módulo formatado. */
export function amountLabel(
  tx: Pick<RowTransaction, "type" | "amount">,
): string {
  return `${isCredit(tx) ? "+ " : "- "}${formatBRL(Math.abs(tx.amount))}`;
}

export function amountTone(
  tx: Pick<
    RowTransaction,
    "type" | "amount" | "ignored" | "internalTransfer" | "refunded"
  >,
): AmountTone {
  if (tx.ignored || tx.internalTransfer || tx.refunded) return "muted";
  return isCredit(tx) ? "up" : "neutral";
}

export interface SupportLineInput {
  tx: Pick<RowTransaction, "date">;
  /** Nome já resolvido pela tela; vazio vira "Sem categoria". */
  categoryName?: string | null;
  /** Falso quando a categoria já está no contêiner (chip do grupo da Revisão). */
  showCategory?: boolean;
  account?: ConnectorAccount | null;
  /** Só quando a tela tem origem como dimensão real — mesma regra do Extrato. */
  showOrigin?: boolean;
}

/**
 * As partes da linha de apoio, na ordem categoria → conta → data. Cada parte
 * volta separada para a tela poder desenhá-las como textos aninhados; quem
 * quiser a frase inteira junta com `SUPPORT_SEPARATOR`.
 *
 * A conta só entra quando foi RESOLVIDA no mapa: sem conta mapeada, a origem
 * vira selo ("Origem não informada"), e não texto — 1.600 linhas repetindo a
 * mesma frase na linha de apoio diriam a mesma coisa 1.600 vezes.
 */
export function supportLineParts({
  tx,
  categoryName,
  showCategory = true,
  account,
  showOrigin = false,
}: SupportLineInput): string[] {
  const parts: string[] = [];
  if (showCategory) parts.push(categoryName?.trim() || "Sem categoria");
  if (showOrigin && account) parts.push(accountDisplayName(account));
  parts.push(formatDayMonthShort(tx.date));
  return parts;
}

/**
 * Os selos da linha, na ordem em que aparecem. O que pede ação vem primeiro
 * e é o único em tom de aviso; as marcas de "como esta linha conta" vêm em
 * seguida, neutras, porque são decisão do usuário e não problema.
 */
export function rowBadges(
  tx: Pick<
    RowTransaction,
    "reviewStatus" | "ignored" | "internalTransfer" | "familyTransfer" | "refunded"
  >,
): RowBadge[] {
  const badges: RowBadge[] = [];
  if (isPendingReview(tx)) {
    badges.push({
      key: "pending",
      label: "Revisar",
      tone: "warning",
      spoken: "aguardando revisão",
    });
  }
  if (tx.ignored) {
    badges.push({ key: "ignored", label: "Ignorada", tone: "neutral", spoken: "ignorada" });
  }
  if (tx.internalTransfer) {
    badges.push({
      key: "internal",
      label: "Entre contas",
      tone: "neutral",
      spoken: "entre contas",
    });
  }
  if (tx.familyTransfer) {
    badges.push({ key: "family", label: "Na casa", tone: "neutral", spoken: "na casa" });
  }
  if (tx.refunded) {
    badges.push({ key: "refunded", label: "Estornada", tone: "neutral", spoken: "estornada" });
  }
  return badges;
}

export interface SpokenLabelInput {
  tx: RowTransaction;
  voice?: TransactionRowVoice;
  categoryName?: string | null;
  showCategory?: boolean;
  account?: ConnectorAccount | null;
  showOrigin?: boolean;
  /** Só na casa: de quem é a linha. */
  member?: { memberName: string; isMe: boolean } | null;
  /** Falso na linha de outra pessoa, que não abre o detalhe. */
  interactive?: boolean;
}

/**
 * O que o leitor de tela ouve na linha inteira.
 *
 * A linha é UM nó acessível (um touchable com rótulo próprio não anuncia os
 * filhos), então tudo o que o olho vê precisa estar aqui: o apelido E o texto
 * do banco, a data, o valor com o verbo certo, a categoria, a origem, os
 * selos e o dono. As frases são as mesmas que as três telas já falavam —
 * "no banco:", "entrada/saída", "crédito/compra", "origem …", "aguardando
 * revisão", "lançamento de …", "Abrir detalhes" — só que agora numa ordem só.
 */
export function spokenLabel({
  tx,
  voice = "bank",
  categoryName,
  showCategory = true,
  account,
  showOrigin = false,
  member,
  interactive = true,
}: SpokenLabelInput): string {
  const name = transactionDisplayName(tx);
  const pieces: string[] = [
    isRenamed(tx) ? `${name}, no banco: ${transactionOriginalName(tx)}` : name,
    formatDayMonthShort(tx.date),
    `${amountVerb(tx, voice)} de ${formatBRL(Math.abs(tx.amount))}`,
  ];
  if (showCategory) pieces.push(categoryName?.trim() || "sem categoria");
  if (showOrigin) {
    // Pelo helper: com o nome cru, conta que o provedor mandou sem nome fazia
    // o leitor ouvir "origem ," onde o olho lia "Cartão de crédito"
    pieces.push(
      account
        ? `origem ${accountDisplayName(account)}`
        : originLabel(tx.accountId, account).toLowerCase(),
    );
  }
  for (const badge of rowBadges(tx)) pieces.push(badge.spoken);
  if (member) {
    pieces.push(member.isMe ? "lançamento seu" : `lançamento de ${member.memberName}`);
  }
  const sentence = pieces.join(", ");
  return interactive ? `${sentence}. Abrir detalhes e apelido` : sentence;
}
