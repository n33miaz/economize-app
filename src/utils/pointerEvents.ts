import { StyleSheet } from "react-native";

/**
 * `box-none`: o contêiner não recebe clique, os filhos recebem.
 *
 * Precisa sair de `StyleSheet.create` e nunca de um objeto de estilo solto. No
 * react-native-web só o compilador de estilos conhece `box-none` — é ele que
 * emite `pointer-events:none` no contêiner e a regra `> *` com `auto` para os
 * filhos. Inline o valor vai cru para o CSS, o navegador descarta
 * `pointer-events: box-none` por ser inválido e o elemento volta para `auto`.
 *
 * Foi exatamente assim que a camada de tela inteira do Toast passou a engolir
 * todo clique de mouse na web, sem desenhar nada que denunciasse a causa.
 */
export const boxNone = StyleSheet.create({
  passaAdiante: { pointerEvents: "box-none" },
}).passaAdiante;
