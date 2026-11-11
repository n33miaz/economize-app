import { bytesDeBase64 } from "./arquivoRecebido";

/**
 * Quem é a pessoa por trás de uma sessão — sem guardar quem ela é.
 *
 * <p><b>Para que serve.</b> Dois tipos de dado ficam no aparelho. O que veio
 * do servidor (extrato, carteira) é cache e morre em toda saída: basta buscar
 * de novo. Mas a conversa com o Nino, os favoritos e alguns avisos só existem
 * AQUI — e a sessão expira sozinha. Apagá-los em toda saída faria a pessoa
 * perder a conversa a cada 401. A regra passou a ser: eles só são apagados
 * quando quem ENTRA é outra pessoa. Para isso é preciso lembrar quem foi a
 * última, depois que ela saiu.
 *
 * <p><b>De onde vem.</b> Do próprio token: o `sub` do JWT é o e-mail da conta.
 * A resposta do login só traz token e nome (e nome não identifica ninguém), e
 * o segundo fator e o cadastro nem passam o e-mail pelo mesmo caminho — o
 * token é a única fonte que as quatro entradas têm em comum.
 *
 * <p><b>O que fica guardado.</b> Um resumo do e-mail, não o e-mail: com a
 * sessão encerrada, o aparelho não deve dizer a quem o pegar quem o usou por
 * último. O resumo NÃO é criptografia (53 bits, sem sal secreto) — serve para
 * comparar "é a mesma pessoa?", e é só isso que se pede dele.
 */

/** cyrb53: resumo de 53 bits, determinístico, sem dependência nativa. */
function digest(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/** O `sub` do JWT; null quando o token não é um JWT legível. */
function subjectOf(token: string): string | null {
  const payload = token.split(".")[1];
  if (!payload) return null;
  try {
    // JWT usa base64url; o decodificador da casa lê o alfabeto padrão
    const bytes = bytesDeBase64(payload.replace(/-/g, "+").replace(/_/g, "/"));
    let json = "";
    for (const byte of bytes) json += String.fromCharCode(byte);
    // Os bytes são UTF-8 e aqui viram um caractere por byte. Um acento sairia
    // trocado — e não importa: o texto só é COMPARADO, nunca mostrado, e a
    // troca é a mesma toda vez
    const claims = JSON.parse(json) as { sub?: unknown };
    return typeof claims.sub === "string" && claims.sub ? claims.sub : null;
  } catch {
    return null;
  }
}

/**
 * A chave que identifica a pessoa do token, ou null quando não dá para saber.
 *
 * <p>null é uma resposta honesta e quem chama tem de tratá-la como "pessoa
 * desconhecida", isto é, como OUTRA pessoa: na dúvida, o dado de quem saiu é
 * apagado. Errar para esse lado custa uma conversa; errar para o outro mostra
 * a conversa de alguém a quem não devia.
 */
export function userKeyFromToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const subject = subjectOf(token);
  return subject ? digest(subject.trim().toLowerCase()) : null;
}
