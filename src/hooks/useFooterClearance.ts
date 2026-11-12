import { useContext } from "react";

import {
  ASSISTANT_FAB_HEIGHT,
  useAssistantFabOffset,
} from "../components/AssistantFAB";
import { TabBarHeightContext } from "../routes/tabBarHeight";
import { spacing } from "../theme/ds";

/**
 * Quanto de rodapé uma lista precisa reservar para o último item não ficar
 * debaixo do que flutua sobre ela.
 *
 * Duas coisas flutuam: a ilha da barra de abas (cuja altura chega pelo
 * `TabBarHeightContext`, e é `undefined` fora das abas e no desktop) e o
 * botão do assistente. A reserva é a MAIOR das duas mais um respiro — a mesma
 * conta que o `AssistantFAB` documenta, sem número escrito à mão.
 *
 * <p>Existe porque um `pb-24` chutado não era aplicado: na web o
 * `contentContainerClassName` de uma `SectionList` computa padding zero, e o
 * botão do estado vazio do Extrato ficava inalcançável sob a barra.
 */
export function useFooterClearance(): number {
  const tabBarHeight = useContext(TabBarHeightContext);
  const fabTop = useAssistantFabOffset() + ASSISTANT_FAB_HEIGHT;
  return Math.max(tabBarHeight ?? 0, fabTop) + spacing[4];
}
