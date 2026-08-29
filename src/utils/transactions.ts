import type {
  BankTransaction,
  CategorizedBy,
  ReviewGroup,
} from "../services/api";

/**
 * Regras de transação que não dependem de tela (EC-094).
 *
 * O ponto central: desde que a transação passou a ter apelido, `description`
 * virou TEXTO DE EXIBIÇÃO — ele muda quando o usuário renomeia. Quem precisa de
 * identidade estável (chave de grupo, dedupe, comparação, key de lista) usa
 * `originalDescription`, que é sempre o texto do banco.
 */

/** Mesmo teto do `@Size` da API e da coluna `display_alias`. */
export const TRANSACTION_ALIAS_MAX_LENGTH = 80;

/**
 * Caracteres de formatação (categoria Unicode FORMAT) que o servidor apaga:
 * largura zero, marcas de direção, hífen suave, BOM. Vão por ponto de código —
 * escrever os caracteres no fonte deixaria invisíveis dentro do próprio arquivo,
 * e as classes `\p{...}` dependem de suporte que o Hermes não garante.
 */
function isFormatCodePoint(code: number): boolean {
  return (
    code === 0x00ad ||
    code === 0x061c ||
    code === 0x180e ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x202a && code <= 0x202e) ||
    (code >= 0x2060 && code <= 0x2064) ||
    (code >= 0x2066 && code <= 0x2069) ||
    code === 0xfeff
  );
}

/** Controles ISO e qualquer espaço (inclusive NBSP, tab e quebra de linha). */
function isControlOrSpace(char: string, code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f) || /\s/.test(char);
}

/**
 * Espelha o saneamento do servidor para que a prévia na tela seja o que vai
 * ficar salvo. O servidor continua sendo a autoridade — isto é conveniência,
 * não validação de segurança.
 */
export function sanitizeTransactionAlias(
  raw: string | null | undefined,
): string | null {
  if (raw == null) return null;
  let visible = "";
  for (const char of raw) {
    const code = char.codePointAt(0) ?? 0;
    if (isFormatCodePoint(code)) continue;
    visible += isControlOrSpace(char, code) ? " " : char;
  }
  const collapsed = visible.replace(/ {2,}/g, " ").trim();
  return collapsed.length === 0 ? null : collapsed;
}

export type AliasValidation =
  | { ok: true; value: string | null }
  | { ok: false; message: string };

/**
 * O `@Size(max = 80)` do servidor roda ANTES do saneamento, sobre o texto cru.
 * Validar o cru aqui é o que faz o cliente recusar exatamente o que o servidor
 * recusaria, em vez de mandar algo que volta 400.
 */
export function validateTransactionAlias(raw: string): AliasValidation {
  if (raw.length > TRANSACTION_ALIAS_MAX_LENGTH) {
    return {
      ok: false,
      message: `O apelido cabe em ${TRANSACTION_ALIAS_MAX_LENGTH} caracteres.`,
    };
  }
  return { ok: true, value: sanitizeTransactionAlias(raw) };
}

/** Nada a enviar quando o apelido efetivo não mudou. */
export function aliasChanged(
  current: string | null,
  next: string | null,
): boolean {
  return (current ?? null) !== (next ?? null);
}

type NamedTransaction = Pick<
  BankTransaction,
  "description" | "originalDescription" | "displayAlias"
>;

/** O que a tela mostra: apelido quando existe, senão o texto do banco. */
export function transactionDisplayName(tx: NamedTransaction): string {
  const alias = tx.displayAlias?.trim();
  if (alias) return alias;
  return tx.description || tx.originalDescription || "Sem descrição";
}

/**
 * O texto do banco. Serve tanto para mostrar a verdade ao lado do apelido
 * quanto como chave estável — `description` não serve para nenhum dos dois.
 */
export function transactionOriginalName(tx: NamedTransaction): string {
  return tx.originalDescription || tx.description || "Sem descrição";
}

export function isRenamed(tx: NamedTransaction): boolean {
  return Boolean(tx.displayAlias?.trim());
}

/**
 * Identidade estável do grupo entre re-fetches: a fila não traz id próprio,
 * então repetimos aqui a chave que o backend usa para agrupar — descrição
 * normalizada MAIS a categoria sugerida. Só com a descrição, dois grupos da
 * mesma loja com sugestões diferentes colidiriam: a escolha feita num card
 * vazaria para o outro e a categoria (com a regra que ela ensina) cairia em
 * transações que o usuário nunca decidiu.
 *
 * O recurso do meio é `originalDescription`, e não `sampleDescription`: este
 * último passou a ser texto de exibição (EC-094), então renomear uma transação
 * trocaria a chave do grupo e a escolha em curso pularia de card.
 */
export function reviewGroupKey(group: ReviewGroup): string {
  const first = group.transactions[0];
  const identity =
    group.normalizedDescription ??
    (first ? transactionOriginalName(first) : null) ??
    first?.id ??
    "grupo";
  return `${identity}|${group.suggestedCategoryId ?? ""}`;
}

export function categorizedByLabel(by: CategorizedBy | null): string {
  if (by === "USER") return "escolhida por você";
  if (by === "USER_RULE" || by === "LEARNED_RULE") return "regra sua";
  if (by === "AI") return "sugerida por IA";
  if (by === "KEYWORD") return "sugerida por palavra-chave";
  if (by === "FALLBACK") return "sugerida como padrão";
  return "sem origem registrada";
}

/** Substitui a transação pela versão que o servidor devolveu, preservando a ordem. */
export function replaceTransaction(
  list: BankTransaction[],
  updated: BankTransaction,
): BankTransaction[] {
  if (!list.some((tx) => tx.id === updated.id)) return list;
  return list.map((tx) => (tx.id === updated.id ? updated : tx));
}

/**
 * Propaga o rename para a fila de revisão. Quando a renomeada é a primeira do
 * grupo, o título (`sampleDescription`, que o servidor monta com o texto de
 * exibição) acompanha — senão o card afirmaria um nome que já não existe.
 * A chave do grupo não muda, porque ela não depende mais desse campo.
 */
export function applyTransactionToGroups(
  groups: ReviewGroup[],
  updated: BankTransaction,
): ReviewGroup[] {
  let touched = false;
  const next = groups.map((group) => {
    const index = group.transactions.findIndex((tx) => tx.id === updated.id);
    if (index < 0) return group;
    touched = true;
    const transactions = group.transactions.map((tx) =>
      tx.id === updated.id ? updated : tx,
    );
    return {
      ...group,
      transactions,
      sampleDescription:
        index === 0 ? transactionDisplayName(updated) : group.sampleDescription,
    };
  });
  return touched ? next : groups;
}

/**
 * Mensagem honesta para cada falha do contrato do apelido. O 404 do dono errado
 * é indistinguível de "não existe" de propósito (a API não vaza existência) —
 * então a mensagem também não pode inventar "sem permissão".
 *
 * O `detail` do 400 NÃO é repassado: o servidor devolve o erro de binding com o
 * nome do campo ("displayAlias: ..."), que é vocabulário de API, não de
 * usuário. O único 400 que o contrato do apelido prevê é o estouro do teto, e
 * essa frase o app sabe escrever melhor.
 */
export function describeAliasFailure(status: number | null): string {
  if (status === 400) {
    return `O apelido cabe em ${TRANSACTION_ALIAS_MAX_LENGTH} caracteres.`;
  }
  if (status === 404) {
    return "Não encontramos esta transação na sua conta. Atualize o extrato e tente de novo.";
  }
  if (status === 401 || status === 403) {
    return "Sua sessão expirou. Entre de novo para renomear.";
  }
  return "Não foi possível salvar o apelido agora. Tente de novo.";
}
