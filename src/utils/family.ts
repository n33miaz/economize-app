import type {
  Category,
  CategorySlice,
  FamilyCategoryTotal,
  FamilyRole,
  FamilyShareScope,
  FamilyTransaction,
} from "../services/api";
import { readProblem } from "./recurrence";

/**
 * Regras puras da Casa (EC-150): tudo que a tela precisa dizer ou derivar dos
 * dados do grupo, sem JSX. Mora aqui pelo mesmo motivo dos Desejos — frase e
 * conta testáveis, e uma versão só delas para as três telas que as usam.
 */

/**
 * Iniciais do avatar. Primeira letra do primeiro e do ÚLTIMO nome: "Maria da
 * Silva" vira "MS", não "MD" — a preposição do meio não identifica ninguém.
 * Nome de uma palavra só dá uma letra; nome vazio dá "?" para o disco nunca
 * ficar em branco.
 */
export function initialsOf(name: string | null | undefined): string {
  const parts = (name ?? "")
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);
  if (parts.length === 0) return "?";
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return `${first}${last}`.toUpperCase();
}

/**
 * Índice de cor estável por membro. A cor segue a PESSOA, como a cor de
 * categoria segue a categoria: o mesmo nome veste o mesmo tom em qualquer
 * tela, e ninguém precisa de legenda para reconhecer quem é quem. É um hash
 * do id (e não da posição na lista) para a cor não trocar quando alguém sai.
 */
export function memberColorIndex(memberId: string, paletteSize: number): number {
  if (paletteSize <= 0) return 0;
  let hash = 0;
  for (let i = 0; i < memberId.length; i += 1) {
    hash = (hash * 31 + memberId.charCodeAt(i)) >>> 0;
  }
  return hash % paletteSize;
}

export function shareScopeLabel(scope: FamilyShareScope): string {
  switch (scope) {
    case "NONE":
      return "Nada";
    case "TOTALS":
      return "Só totais";
    case "TRANSACTIONS":
      return "Lançamentos";
  }
}

/** A mesma escolha, na voz da lista de membros: "mostra: só totais". */
export function shareScopeSummary(scope: FamilyShareScope): string {
  switch (scope) {
    case "NONE":
      return "não mostra nada";
    case "TOTALS":
      return "mostra só totais";
    case "TRANSACTIONS":
      return "mostra os lançamentos";
  }
}

/** O que cada escopo entrega à casa, dito antes de a pessoa escolher. */
export function describeShareScope(scope: FamilyShareScope): string {
  switch (scope) {
    case "NONE":
      return "A casa sabe que você está aqui, mas não vê nenhum número seu.";
    case "TOTALS":
      return "A casa vê suas somas por categoria e o total do período — nenhuma linha do extrato.";
    case "TRANSACTIONS":
      return "A casa vê cada lançamento seu, menos os das categorias e contas que você esconder.";
  }
}

export function familyRoleLabel(role: FamilyRole): string {
  return role === "OWNER" ? "Dono da casa" : "Membro";
}

/**
 * Validade do convite, para quem vai mandar o código pelo WhatsApp. É um
 * instante (não uma data-só), então o fuso do aparelho É o certo aqui — o
 * convite expira na hora local de quem o emitiu.
 */
export function inviteValidityLabel(
  expiresAt: string,
  now: Date = new Date(),
): string {
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return "Validade desconhecida";
  if (expires.getTime() <= now.getTime()) return "Convite expirado";
  const date = expires.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
  const time = expires.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `Vale até ${date} às ${time}`;
}

/** Alfabeto do código sem os caracteres ambíguos (0/O, 1/I): só isto entra. */
const INVITE_ALPHABET = /[^ABCDEFGHJKLMNPQRSTUVWXYZ23456789]/g;
export const INVITE_CODE_LENGTH = 8;

/**
 * Normaliza o que a pessoa digitou ou colou: maiúsculas, sem espaço, sem
 * traço, sem caractere fora do alfabeto. O código chega pelo WhatsApp com
 * espaço no fim e traço no meio.
 *
 * <p>Não existe conversão de "0" para "O" nem de "1" para "I": o alfabeto do
 * código não tem NENHUM dos quatro, exatamente para que o par ambíguo nunca
 * apareça. Um deles no texto colado é ruído — e não dá para adivinhar de qual
 * letra é o engano —, então cai fora com o resto do que não é do alfabeto.
 */
export function normalizeInviteCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(INVITE_ALPHABET, "")
    .slice(0, INVITE_CODE_LENGTH);
}

/** "ABCD EFGH": em dois blocos o código se lê e se dita sem perder a posição. */
export function formatInviteCode(code: string): string {
  if (code.length <= 4) return code;
  return `${code.slice(0, 4)} ${code.slice(4)}`;
}

/**
 * As somas da casa no shape que a Análise já sabe desenhar. A cor e o ícone
 * vêm do catálogo do CHAMADOR quando a categoria é dele (ou do sistema);
 * categoria pessoal de outro membro não existe aqui e cai no neutro — o nome
 * está garantido pela resposta, o visual não precisa fingir.
 *
 * Sem período anterior de propósito: a visão da casa não compara com o ciclo
 * passado nesta versão, então `previousExpenseTotal` é 0 e o delta é nulo, e
 * quem desenha a linha precisa saber que não deve escrever "novo" ali.
 */
export function familyCategorySlices(
  categories: FamilyCategoryTotal[],
  catalog: Category[],
): CategorySlice[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return categories.map((total) => {
    const known = total.categoryId ? byId.get(total.categoryId) : undefined;
    return {
      categoryId: total.categoryId,
      name: total.categoryName,
      groupName: known?.groupName ?? null,
      color: known?.color ?? null,
      icon: known?.icon ?? null,
      systemKey: known?.systemKey ?? null,
      parentSystemKey: known?.parentSystemKey ?? null,
      system: known?.system ?? false,
      expenseTotal: total.expense,
      incomeTotal: total.income,
      txCount: total.txCount,
      previousExpenseTotal: 0,
      expenseDeltaPct: null,
      children: [],
    };
  });
}

/** Chave do chip "todo mundo" no filtro de membro do extrato da casa. */
export const MEMBER_ALL = "all";

export interface MemberFilterOption {
  key: string;
  label: string;
  count: number;
}

/**
 * Um chip por pessoa com linha no recorte, mais "Todos". Nasce das linhas (e
 * não da lista de membros) para o chip de quem mostra só totais não existir:
 * filtrar por alguém que não tem linha nenhuma daria uma lista vazia sem
 * explicação. Com uma pessoa só, a fileira não existe — não há o que filtrar.
 */
export function memberFilterOptions(
  transactions: FamilyTransaction[],
): MemberFilterOption[] {
  const counts = new Map<string, MemberFilterOption>();
  for (const tx of transactions) {
    const current = counts.get(tx.memberId);
    if (current) current.count += 1;
    else counts.set(tx.memberId, { key: tx.memberId, label: tx.memberName, count: 1 });
  }
  if (counts.size < 2) return [];
  return [
    { key: MEMBER_ALL, label: "Todos", count: transactions.length },
    ...[...counts.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  ];
}

export function applyMemberFilter(
  transactions: FamilyTransaction[],
  memberKey: string,
): FamilyTransaction[] {
  if (memberKey === MEMBER_ALL) return transactions;
  return transactions.filter((tx) => tx.memberId === memberKey);
}

/**
 * Filtro derivado, e não estado corrigido por efeito: se a pessoa filtrada
 * deixou de ter linhas na recarga, o chip dela sumiu e o filtro volta a
 * "Todos" — sem isso a tela ficaria presa numa lista vazia sem chip marcado.
 */
export function resolveMemberFilter(
  memberKey: string,
  options: MemberFilterOption[],
): string {
  if (memberKey === MEMBER_ALL) return MEMBER_ALL;
  return options.some((option) => option.key === memberKey)
    ? memberKey
    : MEMBER_ALL;
}

/** Mensagem por status HTTP, para a operação dizer o que o 404 DELA significa. */
export type FamilyErrorMessages = Partial<Record<number, string>>;

/** Mensagem do `join`: o servidor não diz qual dos três foi, de propósito. */
export const INVALID_INVITE_MESSAGE = "Código inválido, expirado ou já usado.";

/**
 * Erros da Casa em português. 409 é sempre "já tem casa" e 429 é sempre o
 * limitador do `join` fechando; o 404 muda de significado por operação
 * (código errado no `join`, casa desfeita nas demais), então quem chama pode
 * sobrescrever qualquer status. O `detail` do 400 já vem em português do
 * servidor e diz mais que um genérico — passa; o de 500 e de rede não passa.
 */
export function translateFamilyError(
  error: unknown,
  fallback: string,
  messages: FamilyErrorMessages = {},
): string {
  const problem = readProblem(error);
  if (problem.status !== null && messages[problem.status]) {
    return messages[problem.status] as string;
  }
  switch (problem.status) {
    case 404:
      return "A casa não foi encontrada — talvez tenha sido desfeita.";
    case 409:
      return "Você já faz parte de uma casa.";
    case 429:
      return "Muitas tentativas. Espere um minuto e tente de novo.";
    case 400:
      return problem.detail ?? fallback;
    default:
      return fallback;
  }
}
