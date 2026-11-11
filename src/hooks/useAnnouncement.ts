import { useEffect } from "react";

import {
  hasFloor,
  useAnnouncementStore,
} from "../store/announcementStore";

/**
 * Pede a vez para um anúncio e responde se ele pode aparecer AGORA.
 *
 * <p>Uso: o componente calcula se QUER aparecer (as regras dele continuam
 * dele) e passa isso em `wants`; o que volta é se ele PODE. A separação é o
 * ponto — nenhum anúncio precisa saber que os outros existem, e a ordem mora
 * num lugar só (`ANNOUNCEMENT_PRIORITY`).
 *
 * <p>O pedido é liberado na desmontagem. Sem isso, navegar para outra tela com
 * a folha aberta deixaria a vez presa e o próximo anúncio nunca falaria.
 *
 * <p>Ver `store/announcementStore` para o defeito que trouxe isto: três folhas
 * abrindo juntas na abertura do app, que é o mesmo que nenhuma.
 */
export function useAnnouncement(
  id: string,
  priority: number,
  wants: boolean,
): boolean {
  const claim = useAnnouncementStore((s) => s.claim);
  const release = useAnnouncementStore((s) => s.release);
  const claims = useAnnouncementStore((s) => s.claims);

  // O pedido deste anúncio ainda está na fila? Entra nas dependências abaixo
  // porque a fila é esvaziada no fim E no começo de cada sessão (ver
  // `store/sessionReset`), e nem todo anúncio mora na árvore autenticada: o
  // aviso de versão e a tranca ficam na raiz e não desmontam com o login. Sem
  // isto, o pedido deles era apagado e — como `wants` não mudou — nunca
  // refeito: o aviso que esperava a vez atrás da oferta de biometria do Login
  // não aparecia mais até o app reabrir. Quem já desmontou não pede de novo,
  // que é o que a limpeza quer.
  const claimed = id in claims;

  useEffect(() => {
    if (wants) claim(id, priority);
    else release(id);
  }, [wants, claimed, id, priority, claim, release]);

  useEffect(() => () => release(id), [id, release]);

  return wants && hasFloor(claims, id);
}
