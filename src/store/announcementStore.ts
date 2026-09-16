import { create } from "zustand";

/**
 * Uma fila para quem quer falar na abertura do app.
 *
 * <p><b>O defeito, relatado pelo dono em 16/09/2026:</b> <i>"os modais estão
 * aparecendo todos ao mesmo tempo ao entrar no app (biometria, nova versão e
 * procure outros)"</i>. Estavam, e não era coincidência: cada anúncio decidia
 * sozinho se aparecia, e as condições deles são todas satisfeitas no MESMO
 * instante — o app acabou de abrir.
 *
 * <p>Quem disputava a tela:
 *
 * <ul>
 *   <li>a oferta de biometria, depois de as credenciais passarem;</li>
 *   <li>o anúncio de versão nova, quando o servidor publica uma;</li>
 *   <li>a apresentação do pote, uma vez na vida, quando há ciclo para mostrar;</li>
 *   <li>a oferta do Plus, que tem regras de sessão próprias.</li>
 * </ul>
 *
 * <p>Três folhas empilhadas não são três avisos: são zero. A pessoa fecha tudo
 * no reflexo, e o único que importava vai junto.
 *
 * <p><b>A regra.</b> Cada anúncio pede a vez com uma prioridade; só o de menor
 * número aparece. Quando ele sai, o seguinte entra — na abertura seguinte, não
 * um atrás do outro no mesmo segundo: o anúncio que perdeu a vez simplesmente
 * não é mostrado agora, e as condições dele continuam valendo amanhã.
 *
 * <p><b>Por que fila e não "só um por sessão".</b> Um contador por sessão
 * esconderia o aviso urgente quando o decorativo chegasse primeiro. A ordem
 * aqui é por IMPORTÂNCIA, não por chegada: versão nova (o app pode estar
 * quebrado contra o servidor) vem antes da apresentação do pote, que vem antes
 * da oferta comercial — sempre.
 */

/**
 * Menor número fala primeiro. Os vãos entre eles são de propósito: cabe
 * encaixar um anúncio novo sem renumerar os que já existem.
 */
export const ANNOUNCEMENT_PRIORITY = {
  /** Oferta de biometria: a pessoa acabou de digitar a senha e está esperando. */
  biometric: 10,
  /** Versão nova: pode ser o app inteiro desalinhado com o servidor. */
  newVersion: 20,
  /** A marca virou indicador — ensina algo, uma vez na vida. */
  potStates: 30,
  /** Comercial: nunca na frente de informação. */
  premiumOffer: 40,
} as const;

interface AnnouncementState {
  /** Quem pediu a vez, por id, com a prioridade de cada um. */
  claims: Record<string, number>;
  claim: (id: string, priority: number) => void;
  release: (id: string) => void;
  reset: () => void;
}

export const useAnnouncementStore = create<AnnouncementState>((set) => ({
  claims: {},

  claim: (id, priority) =>
    set((state) =>
      state.claims[id] === priority
        ? state
        : { claims: { ...state.claims, [id]: priority } },
    ),

  release: (id) =>
    set((state) => {
      if (!(id in state.claims)) return state;
      const proximos = { ...state.claims };
      delete proximos[id];
      return { claims: proximos };
    }),

  // Fim de sessão: sair da conta não pode deixar um pedido preso, senão o
  // próximo login entra com a fila já ocupada por um anúncio que não existe
  reset: () => set({ claims: {} }),
}));

/**
 * Este anúncio tem a vez?
 *
 * <p>Empate de prioridade é resolvido pelo id, em ordem alfabética: não
 * deveria acontecer (cada anúncio tem número próprio) e, se acontecer, o
 * resultado precisa ser ESTÁVEL entre renders — sem isso duas folhas piscariam
 * alternando qual delas aparece.
 */
export function hasFloor(claims: Record<string, number>, id: string): boolean {
  const minha = claims[id];
  if (minha === undefined) return false;
  for (const [outro, prioridade] of Object.entries(claims)) {
    if (outro === id) continue;
    if (prioridade < minha) return false;
    if (prioridade === minha && outro < id) return false;
  }
  return true;
}
