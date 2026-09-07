import { Platform } from "react-native";
import Constants from "expo-constants";

/**
 * Versão do app e a régua que a compara com a do servidor.
 *
 * <p>O problema que isto resolve: uma versão antiga do APK continuava falando
 * com uma API que já tinha mudado de contrato, e o sintoma para quem usava era
 * tela em branco ou número errado — nunca "você precisa atualizar". A régua
 * mora aqui, em função pura, para o store de versão e o interceptor da API
 * decidirem a mesma coisa a partir dos mesmos três números.
 */

/** O que vale quando o Expo não informa a versão — sinal de build quebrado. */
export const UNKNOWN_VERSION = "0.0.0";

/**
 * Para onde mandar quem precisa baixar. É o mesmo endereço que a API devolve;
 * fica aqui como plano B para o caso em que a API já recusou a versão (426) e
 * não conseguimos nem buscar a resposta completa.
 */
export const DEFAULT_DOWNLOAD_URL = "https://economize-web.onrender.com/baixar";

// Só os três números interessam. O que vier depois ("-beta.1", "+build7") é
// ignorado de propósito: o servidor publica "2.3.0" e o app pode nascer como
// "2.3.0-dev" no simulador — e os dois são a mesma versão para esta régua.
const SEMVER = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?/;

/**
 * Normaliza qualquer coisa que pareça uma versão para "maior.menor.correção".
 * O que não parecer vira {@link UNKNOWN_VERSION}, e não erro: a régua é
 * consultada na abertura do app, e uma exceção aqui derrubaria tudo.
 */
export function normalizeVersion(raw: unknown): string {
  if (typeof raw !== "string") return UNKNOWN_VERSION;
  const match = SEMVER.exec(raw.trim());
  if (!match) return UNKNOWN_VERSION;
  const [, major, minor = "0", patch = "0"] = match;
  return `${Number(major)}.${Number(minor)}.${Number(patch)}`;
}

function parts(version: string): [number, number, number] {
  const [major, minor, patch] = normalizeVersion(version).split(".");
  return [Number(major), Number(minor), Number(patch)];
}

/**
 * Comparação NUMÉRICA, campo a campo. Comparar as strings faria "2.10.0" vir
 * antes de "2.9.9" — e é exatamente o salto de versão que um app faz.
 */
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

/** `true` quando `version` é mais antiga que `min`. Igual não é abaixo. */
export function isBelow(version: string, min: string): boolean {
  return compareSemver(version, min) < 0;
}

/**
 * A versão deste build, vinda do `version` do app.json que o Expo embute no
 * manifesto. No navegador ela é a do bundle — que pode estar em cache velho,
 * e é justamente isso que o aviso de atualização da web detecta.
 */
export const APP_VERSION = normalizeVersion(Constants.expoConfig?.version);

export type AppPlatform = "android" | "ios" | "web";

/**
 * Plataforma como o servidor a conhece. Ele decide coisas diferentes para
 * cada uma — só o nativo é bloqueável por versão, a web se atualiza sozinha —
 * então o rótulo precisa ser estável, e não o `Platform.OS` cru (que ainda
 * tem "windows" e "macos" no tipo).
 */
export function platformHeader(): AppPlatform {
  if (Platform.OS === "android" || Platform.OS === "ios") return Platform.OS;
  return "web";
}

/**
 * Os dois cabeçalhos que TODA requisição leva. Existem como função para o
 * interceptor da API e a consulta de versão (que não passa pelo interceptor)
 * mandarem exatamente o mesmo par.
 */
export function versionHeaders(): Record<string, string> {
  return {
    "X-App-Version": APP_VERSION,
    "X-App-Platform": platformHeader(),
  };
}
