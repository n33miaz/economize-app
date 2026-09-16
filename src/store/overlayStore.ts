import type { ReactNode } from "react";
import { create } from "zustand";

/**
 * O andar de cima do app — onde as folhas e diálogos são realmente desenhados.
 *
 * <p><b>Por que isto existe.</b> Este app roda na nova arquitetura
 * (`newArchEnabled: true`, RN 0.76.9, Fabric sem ponte) e ali o
 * {@code Modal} do Android está quebrado de um jeito silencioso: a janela do
 * modal nasce com caixa de layout de <b>tamanho zero</b>. O conteúdo até
 * chega a pintar quando recebe medida em pixels, mas o Android só entrega
 * toque dentro dos limites da view — e os limites são zero. Resultado medido
 * no emulador em 15/09/2026: a folha aparecia e <b>nenhum botão dentro dela
 * respondia</b>, nem o "Entendi", nem o toque no fundo para fechar.
 *
 * <p>Testado e descartado, para ninguém repetir: tirar o
 * `statusBarTranslucent`, trocar o `KeyboardAvoidingView` por uma `View`,
 * medir em pixels em vez de `flex: 1`, e embrulhar o conteúdo num
 * `GestureHandlerRootView`. Os quatro mudam o desenho; nenhum devolve o toque.
 *
 * <p><b>A saída.</b> A folha deixa de ser janela do sistema e passa a ser uma
 * camada do próprio app, desenhada por {@code OverlayHost} no topo da árvore
 * de navegação — acima da barra de abas de baixo, que é justamente quem
 * cobria a folha quando ela era desenhada dentro da tela.
 *
 * <p><b>`hostMounted` não é detalhe.</b> Sem host montado (os testes de
 * unidade renderizam um componente sozinho), quem usa o {@code CustomModal}
 * desenha no lugar, como antes. A correção não podia obrigar 20 suítes a
 * montar a aplicação inteira para ver um texto.
 */
export interface OverlayLayer {
  id: string;
  node: ReactNode;
}

interface OverlayState {
  layers: OverlayLayer[];
  /** Há um {@link OverlayHost} na árvore para receber as camadas? */
  hostMounted: boolean;
  mount: (id: string, node: ReactNode) => void;
  unmount: (id: string) => void;
  registerHost: () => void;
  unregisterHost: () => void;
}

export const useOverlayStore = create<OverlayState>((set) => ({
  layers: [],
  hostMounted: false,

  mount: (id, node) =>
    set((state) => {
      const indice = state.layers.findIndex((camada) => camada.id === id);
      // Reabrir a mesma folha não pode empilhar duas: a identidade manda
      if (indice === -1) return { layers: [...state.layers, { id, node }] };
      const proximas = state.layers.slice();
      proximas[indice] = { id, node };
      return { layers: proximas };
    }),

  unmount: (id) =>
    set((state) => {
      if (!state.layers.some((camada) => camada.id === id)) return state;
      return { layers: state.layers.filter((camada) => camada.id !== id) };
    }),

  // A ordem de empilhamento é a de chegada, e quem chega por último fica por
  // cima — é o que faz um diálogo aberto de dentro de uma folha ficar visível
  registerHost: () => set({ hostMounted: true }),
  unregisterHost: () => set({ hostMounted: false, layers: [] }),
}));
