import { create } from "zustand";

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  // Ação irreversível pinta o botão de confirmar com o token de perigo
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  // Para fluxos em que recusar também é resposta (ex.: "Agora não" da
  // biometria); dispara no botão de cancelar, toque fora, Esc e voltar
  onCancel?: () => void;
}

interface ConfirmState {
  request: ConfirmOptions | null;
  ask: (options: ConfirmOptions) => void;
  dismiss: () => void;
}

// `Alert.alert` do react-native-web é `static alert() {}` — um no-op silencioso.
// Todo diálogo de confirmação do app passava por ele, então no navegador sair da
// conta, excluir categoria e remover transação simplesmente não faziam nada.
// A fila é de um: um segundo `ask` substitui o pedido anterior, que é o
// comportamento que o Alert nativo já tinha.
export const useConfirmStore = create<ConfirmState>((set, get) => ({
  request: null,
  ask: (options) => {
    // Substituir sem avisar engoliria o onCancel do pedido anterior — e para
    // fluxos como o da biometria, recusar É uma resposta que precisa fluir
    get().request?.onCancel?.();
    set({ request: options });
  },
  dismiss: () => set({ request: null }),
}));

// Atalho para quem chama de fora de componente (handlers, stores)
export const askConfirm = (options: ConfirmOptions) =>
  useConfirmStore.getState().ask(options);
