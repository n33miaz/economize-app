import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * O segredo que faz este aparelho ser reconhecido no login.
 *
 * <p>Com verificação em duas etapas ligada, o código passa a ser pedido só em
 * aparelho DESCONHECIDO — no celular de todo dia o login volta a ser e-mail e
 * senha. Fator que atrapalha o dono é fator que o dono desliga, e aí a conta
 * fica sem nenhum.
 *
 * <p>Guardado no mesmo armazenamento da sessão. Ele NÃO é uma sessão: sozinho
 * não abre nada — só dispensa o segundo passo de quem já sabe a senha. Por isso
 * SOBREVIVE ao logout, que é o ponto: sair da conta no próprio celular não pode
 * transformá-lo num aparelho estranho na próxima entrada.
 */
const CHAVE = "@economize_device_token";

export async function readDeviceToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(CHAVE);
  } catch {
    // armazenamento indisponível é "aparelho desconhecido": pede o código
    return null;
  }
}

export async function saveDeviceToken(token: string): Promise<void> {
  try {
    await AsyncStorage.setItem(CHAVE, token);
  } catch {
    // sem onde guardar, o próximo login pede o código de novo — é o
    // comportamento seguro, e não vale derrubar o login por causa disso
  }
}

export async function forgetDeviceToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}

/**
 * Como este aparelho aparece na lista de conhecidos. É rótulo para a pessoa
 * reconhecer o que está ali e revogar o que não reconhece — nunca prova de
 * nada, porque quem o escreve é o cliente.
 */
export function deviceLabel(): string {
  if (Platform.OS === "web") {
    const agent =
      typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    if (/iPhone|iPad/i.test(agent)) return "Navegador no iPhone";
    if (/Android/i.test(agent)) return "Navegador no Android";
    if (/Macintosh/i.test(agent)) return "Navegador no Mac";
    if (/Windows/i.test(agent)) return "Navegador no Windows";
    return "Navegador";
  }
  return Platform.OS === "ios" ? "Economize! no iPhone" : "Economize! no Android";
}
