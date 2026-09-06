import { Platform } from "react-native";

/**
 * Copiar sem biblioteca.
 *
 * <p>O app não tem `expo-clipboard`, e trazer uma dependência nativa para
 * copiar um punhado de caracteres não se justifica. Na web o navegador oferece
 * a área de transferência; no aparelho o texto fica selecionável e a tela diz
 * como copiar — o caminho real é colar no WhatsApp ou no gerenciador de senhas.
 *
 * <p>O retorno é a diferença que importa para quem chama: `false` significa
 * "copiar não aconteceu", e a tela precisa dizer isso em vez de anunciar um
 * sucesso que não houve.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  const clipboard = (globalThis as { navigator?: Navigator }).navigator
    ?.clipboard;
  if (!clipboard?.writeText) return false;
  try {
    await clipboard.writeText(text);
    return true;
  } catch {
    // contexto não seguro e permissão negada estouram aqui — os dois são
    // "não copiou", e nenhum deles pode derrubar a tela
    return false;
  }
}
