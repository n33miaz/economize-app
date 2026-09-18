import { create } from "zustand";

/**
 * A ilha da barra de abas se esconde quando a pessoa rola para baixo.
 *
 * <p>Escolha do dono em 16/09/2026: <i>"ilha flutuante que se esconde ao
 * rolar"</i>. O motivo tem número: o alvo declarado é o Safari de um iPhone 12
 * com a barra de busca em cima, onde sobram <b>664 px</b> de altura útil. Uma
 * faixa fixa de 64 px é quase 10% do que a pessoa vê sem rolar, gasta o tempo
 * inteiro com três destinos que ela já sabe onde ficam.
 *
 * <p><b>Por que um store e não estado de tela.</b> Quem sabe da rolagem é a
 * tela; quem desenha a barra é o navegador, que está fora dela. Passar isso por
 * props exigiria atravessar o React Navigation inteiro.
 *
 * <p><b>Por que histerese, e não "rolou para baixo, some".</b> Sem uma zona
 * morta, o quique da rolagem (e o rubber-band do iOS) faz a barra piscar várias
 * vezes por segundo. O limite de 12 px é o menor valor em que a barra não
 * tremia no teste com o dedo.
 */

/** Deslocamento mínimo, em pixels, para a barra mudar de estado. */
export const LIMITE_ROLAGEM = 12;

/**
 * Abaixo deste ponto a barra SEMPRE aparece.
 *
 * <p>No topo da lista não há o que ganhar escondendo: a pessoa acabou de
 * chegar, e é ali que ela troca de aba.
 */
export const ZONA_DE_TOPO = 24;

interface TabBarState {
  escondida: boolean;
  /** Último deslocamento vertical conhecido. */
  ultimoY: number;
  /** Informa a posição de rolagem atual de uma lista. */
  aoRolar: (y: number) => void;
  /** Volta ao estado visível — trocar de aba, abrir folha, sair da tela. */
  revelar: () => void;
}

export const useTabBarStore = create<TabBarState>((set, get) => ({
  escondida: false,
  ultimoY: 0,

  aoRolar: (y) => {
    const { ultimoY, escondida } = get();
    // Rubber-band do iOS devolve y negativo; tratar como topo
    const atual = Math.max(0, y);

    if (atual <= ZONA_DE_TOPO) {
      if (escondida || ultimoY !== atual) set({ escondida: false, ultimoY: atual });
      return;
    }

    const delta = atual - ultimoY;
    if (Math.abs(delta) < LIMITE_ROLAGEM) return;

    // desceu o dedo (conteúdo subindo) = está lendo = esconde
    set({ escondida: delta > 0, ultimoY: atual });
  },

  revelar: () => {
    if (get().escondida) set({ escondida: false });
  },
}));
