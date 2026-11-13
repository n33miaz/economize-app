import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Onde moram os segredos do aparelho: o JWT da sessão (authStore) e o segredo
 * do aparelho confiável (deviceIdentity).
 *
 * <p><b>Por que existe.</b> O AsyncStorage é um arquivo em texto claro na
 * pasta do app: backup, aparelho com root ou um app de depuração leem o token
 * como está e entram na conta. No Android e no iOS o SecureStore guarda o valor
 * cifrado com chave do Keystore/Keychain, que não sai do aparelho.
 *
 * <p><b>Web.</b> O navegador não tem cofre do sistema e o SecureStore não
 * existe lá. Ali o valor continua no AsyncStorage (localStorage), na mesma
 * chave de sempre: o risco é exatamente o de hoje, nem maior nem menor.
 *
 * <p><b>Migração.</b> Quem já estava logado tem o valor na chave ANTIGA do
 * AsyncStorage. A leitura é o lugar da migração, e não um passo separado na
 * abertura do app, porque o `persist` do zustand hidrata sozinho assim que o
 * módulo é importado: qualquer passo "antes" disputaria corrida com ele. Lendo
 * aqui, a hidratação só recebe a resposta depois de o valor antigo ter sido
 * achado — e a pessoa continua logada depois da atualização.
 *
 * <p><b>Falha.</b> Aparelho sem suporte ou valor que não decifra (backup
 * restaurado em outro aparelho, chave do Keystore perdida) não pode derrubar o
 * app: leitura que falha vira "não há nada" — sessão ausente, tela de login —
 * e escrita que falha é engolida com um aviso SEM o valor no log.
 */

/**
 * O SecureStore só aceita letras, números, ".", "-" e "_" na chave; as chaves
 * antigas começam com "@". O nome lógico continua o antigo (é o que o web e a
 * migração usam) e só o cofre vê a versão saneada.
 */
function secureKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

/** Web não tem cofre: tudo segue no AsyncStorage, como antes. */
function isWeb(): boolean {
  return Platform.OS === "web";
}

/**
 * Aviso de falha sem nada sensível: só a operação e a chave lógica — nunca o
 * valor, e nem a mensagem do erro, que em alguns aparelhos ecoa o conteúdo.
 */
function warn(operation: string, key: string): void {
  console.warn(`Armazenamento seguro indisponível (${operation} ${key})`);
}

/**
 * Copia o valor da chave antiga do AsyncStorage para o cofre e apaga a antiga.
 * Devolve o valor achado (ou nulo), mesmo que a cópia falhe: a pessoa não pode
 * sair da conta por causa da atualização. Se a cópia falhar, a chave antiga
 * não é apagada AQUI, e a sessão segue aberta nesta execução. Não há promessa
 * de nova tentativa: a primeira escrita do store (a própria hidratação já
 * escreve) apaga a chave antiga — ver `setItem`. Num aparelho cujo cofre não
 * grava, a próxima abertura cai no login, que é o comportamento de "cofre
 * indisponível"; o contrário (manter o texto claro) faria o logout não fechar
 * a sessão.
 */
async function migrateFromLegacy(key: string): Promise<string | null> {
  let legacy: string | null;
  try {
    legacy = await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
  if (legacy === null) return null;
  try {
    await SecureStore.setItemAsync(secureKey(key), legacy);
  } catch {
    warn("migrar", key);
    return legacy;
  }
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Já está no cofre; a cópia em texto claro é apagada de novo em toda
    // escrita (ver `setItem`)
  }
  return legacy;
}

export async function getItem(key: string): Promise<string | null> {
  if (isWeb()) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  }
  let value: string | null;
  try {
    value = await SecureStore.getItemAsync(secureKey(key));
  } catch {
    // Cofre ilegível: sessão ausente. NÃO cai para a chave antiga — se o
    // cofre não funciona, ler o texto claro aqui reabriria uma sessão que o
    // logout (que só consegue escrever no cofre) não teria como fechar
    warn("ler", key);
    return null;
  }
  if (value !== null) return value;
  return migrateFromLegacy(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (isWeb()) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // mesmo comportamento de antes: sem onde guardar, só não persiste
    }
    return;
  }
  try {
    await SecureStore.setItemAsync(secureKey(key), value);
  } catch {
    warn("gravar", key);
  }
  // Toda escrita apaga a chave antiga. É o que impede uma cópia em texto
  // claro esquecida (migração que copiou mas não apagou) de ressuscitar uma
  // sessão já encerrada: depois do logout ela também sai
  await removeLegacy(key);
}

export async function removeItem(key: string): Promise<void> {
  if (isWeb()) {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // idem
    }
    return;
  }
  try {
    await SecureStore.deleteItemAsync(secureKey(key));
  } catch {
    warn("apagar", key);
  }
  await removeLegacy(key);
}

async function removeLegacy(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // sem acesso ao AsyncStorage também não há o que reler dele
  }
}

/** O formato que o `createJSONStorage` do zustand espera. */
export const secureStorage = { getItem, setItem, removeItem };
