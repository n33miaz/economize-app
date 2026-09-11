import { create } from "zustand";

/**
 * O sinal de "a primeira tela já sabe o que mostrar" — EC-148 estendido.
 *
 * <p><b>O buraco que isto fecha.</b> A abertura do app (o pote que enche, a
 * moeda que cai, o pote que sobe para o cabeçalho) só existia na tela de
 * <b>Login</b>. Quem abre o app já autenticado — que é quem usa o app todo
 * dia — nunca via nada disso: caía direto num esqueleto cinza.
 *
 * <p><b>Por que um store, e não um prop.</b> Quem sabe que os dados chegaram é
 * a Home, lá no fundo da árvore de navegação; quem desenha a abertura é o
 * topo, acima das rotas, porque a animação precisa cobrir a tela inteira e não
 * só a área da aba. Passar isso por prop atravessaria o navegador inteiro.
 *
 * <p><b>Uma vez por sessão, não por foco.</b> `done` nunca volta para falso
 * sozinho: sair da Home e voltar não reabre a cortina. Quem zera é o logout,
 * porque aí a próxima entrada é outra sessão — e é a mesma regra dos stores
 * que guardam rastro da pessoa.
 */
interface OpeningState {
  /** A cortina já saiu? Verdadeiro impede que ela volte no mesmo uso do app. */
  done: boolean;
  /** A Home já tem número para mostrar (ou já sabe que não tem nenhum). */
  ready: boolean;
  markReady: () => void;
  finish: () => void;
  reset: () => void;
}

export const useOpeningStore = create<OpeningState>((set) => ({
  done: false,
  ready: false,
  markReady: () => set({ ready: true }),
  finish: () => set({ done: true }),
  reset: () => set({ done: false, ready: false }),
}));
