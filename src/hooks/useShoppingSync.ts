import { useCallback, useEffect } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";

import { useShoppingStore } from "../store/shoppingStore";

/**
 * Sincroniza o carrinho nas três voltas em que a internet pode ter voltado:
 * a tela ganhou foco, o app voltou do segundo plano e o armazenamento acabou
 * de hidratar. Nunca antes de hidratar — subir uma lista vazia por cima da
 * que está no disco seria apagar o carrinho de quem estava sem sinal.
 *
 * <p>Falha é silenciosa por contrato: o store marca `syncFailed` e a tela
 * mostra "ainda não sincronizado". Aqui não há toast nem retry.
 */
export function useShoppingSync() {
  const syncAll = useShoppingStore((s) => s.syncAll);
  const hasHydrated = useShoppingStore((s) => s.hasHydrated);

  useEffect(() => {
    if (hasHydrated) syncAll();
  }, [hasHydrated, syncAll]);

  useFocusEffect(
    useCallback(() => {
      syncAll();
    }, [syncAll]),
  );

  useEffect(() => {
    const assinatura = AppState.addEventListener("change", (estado) => {
      if (estado === "active") syncAll();
    });
    return () => assinatura.remove();
  }, [syncAll]);
}
