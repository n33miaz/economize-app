import { useCallback, useEffect } from "react";
import type { NativeScrollEvent, NativeSyntheticEvent } from "react-native";

import { useTabBarStore } from "../store/tabBarStore";

/**
 * Liga uma lista à ilha da barra de abas: rolar para baixo esconde, para cima
 * traz de volta.
 *
 * <p>Uso, numa `ScrollView` ou `FlatList`:
 *
 * <pre>
 *   const barra = useEsconderBarra();
 *   &lt;ScrollView {...barra}&gt;
 * </pre>
 *
 * <p><b>Por que um hook e não o store direto na tela.</b> Três coisas precisam
 * andar juntas e é fácil esquecer uma: o `onScroll`, o `scrollEventThrottle`
 * (sem ele o iOS dispara o evento uma vez por gesto, e a barra só reagiria
 * quando o dedo já saiu) e a <b>revelação ao sair da tela</b>. Esta última é a
 * que mais dói quando falta: sair de uma lista rolada para uma tela curta
 * deixaria a barra escondida sem nada para rolar de volta — navegação
 * desaparecida, sem saída.
 */
export function useEsconderBarra() {
  const aoRolar = useTabBarStore((s) => s.aoRolar);
  const revelar = useTabBarStore((s) => s.revelar);

  useEffect(() => revelar, [revelar]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      aoRolar(e.nativeEvent.contentOffset.y);
    },
    [aoRolar],
  );

  return {
    onScroll,
    // 16 ms = um quadro. Mais que isso e o movimento da barra fica atrás do
    // dedo; menos não existe.
    scrollEventThrottle: 16,
  };
}
