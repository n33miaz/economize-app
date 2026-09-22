import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * O teclado virtual está na tela AGORA?
 *
 * <p>Existe por causa de um toque que custava o rascunho inteiro: com o
 * teclado aberto, a folha ocupa metade da tela e o resto é fundo escuro.
 * Tocar nesse fundo para "só fechar o teclado e ver a lista" fechava a folha
 * e jogava fora o que estava digitado. Agora o primeiro toque fecha o
 * teclado e o segundo fecha a folha — e para isso a folha precisa saber em
 * qual dos dois estados ela está.
 *
 * <p>No iOS os eventos são os `Will`, que chegam ANTES da animação; no
 * Android só existem os `Did`. Usar o par certo de cada lado é o que faz a
 * folha reagir junto com o teclado em vez de um quadro depois.
 */
export function useKeyboardVisible(): boolean {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    const eventoAbrir =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const eventoFechar =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const abrir = Keyboard.addListener(eventoAbrir, () => setAberto(true));
    const fechar = Keyboard.addListener(eventoFechar, () => setAberto(false));

    return () => {
      abrir.remove();
      fechar.remove();
    };
  }, []);

  return aberto;
}
