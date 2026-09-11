import { create } from "zustand";

import { ImportSource, getImportSources } from "../services/api";
import { describeLoadFailure } from "../services/requestFailure";

/**
 * Os arquivos que o usuário já importou — EC-195.
 *
 * Mesmo desenho e mesma razão do `accountsStore`: cada linha do extrato
 * devolve só o `uploadId`, e repetir o nome do arquivo em cada uma de 1.682
 * linhas seria pagar mil vezes pelo mesmo texto. Carrega uma vez, casa em
 * memória.
 *
 * A lista só muda quando o usuário importa um arquivo — daí o cache de
 * sessão, com `force` para quem acabou de importar.
 */
interface ImportSourcesState {
  sources: ImportSource[];
  byId: Map<string, ImportSource>;
  isLoading: boolean;
  /** Separa "ainda não perguntei" de "perguntei e não há arquivo nenhum". */
  hasLoadedOnce: boolean;
  error: string | null;
  fetchSources: (force?: boolean) => Promise<void>;
  reset: () => void;
}

const emptyState = () => ({
  sources: [] as ImportSource[],
  byId: new Map<string, ImportSource>(),
  isLoading: false,
  hasLoadedOnce: false,
  error: null as string | null,
});

export const useImportSourcesStore = create<ImportSourcesState>((set, get) => ({
  ...emptyState(),

  /**
   * Fim de sessão zera o store. Nome de arquivo é rastro do usuário — e, com
   * cache permanente, o mapa da conta ANTERIOR sobreviveria a um login com
   * outra conta até o app reiniciar.
   */
  reset: () => set(emptyState()),

  fetchSources: async (force = false) => {
    const state = get();
    if (state.isLoading) return;
    if (state.hasLoadedOnce && !force) return;

    set({ isLoading: true, error: null });
    try {
      const data = await getImportSources();
      set({
        sources: data,
        byId: new Map(data.map((fonte) => [fonte.id, fonte])),
        isLoading: false,
        hasLoadedOnce: true,
      });
    } catch (e) {
      // `hasLoadedOnce` fica FALSO: um 500 no cold start não pode desligar a
      // procedência pelo resto da sessão (mesma lição do accountsStore)
      set({
        error: describeLoadFailure(
          e,
          "Não foi possível carregar os arquivos importados agora.",
        ),
        isLoading: false,
      });
    }
  },
}));
