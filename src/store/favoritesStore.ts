import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Indicator } from "../services/api";
import { useIndicatorStore } from "./indicatorStore";

interface FavoritesState {
  favorites: string[];
}

interface FavoritesActions {
  toggleFavorite: (id: string) => void;
  isFavorite: (id: string) => boolean;
}

type FavoritesStore = FavoritesState & FavoritesActions;

export const useFavoritesStore = create(
  persist<FavoritesStore>(
    (set, get) => ({
      favorites: [],

      isFavorite: (id: string) => {
        return get().favorites.includes(id);
      },

      toggleFavorite: (id: string) => {
        const currentFavorites = get().favorites;
        const exists = currentFavorites.includes(id);

        let newFavorites;

        if (exists) {
          newFavorites = currentFavorites.filter((favId) => favId !== id);
        } else {
          newFavorites = Array.from(new Set([...currentFavorites, id]));
        }

        set({ favorites: newFavorites });
      },
    }),
    {
      name: "@favorites",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

/**
 * Toggle canônico para quem tem o objeto Indicator em mãos (cards, sheet de
 * detalhe): além do id, guarda/descarta o retrato do ativo no indicatorStore.
 * Sem o retrato, um favorito vindo da busca remota (que não entra na lista
 * principal) acendia a estrela mas ficava invisível na faixa do Mercado e no
 * bloco da Home. Favoritos antigos (persistidos antes do retrato existir)
 * seguem aparecendo pelo caminho de sempre: a lista local.
 */
export function toggleFavoriteWithSnapshot(indicator: Indicator) {
  const { favorites, toggleFavorite } = useFavoritesStore.getState();
  const adding = !favorites.includes(indicator.id);
  const { upsertFavoriteSnapshot, removeFavoriteSnapshot } =
    useIndicatorStore.getState();
  if (adding) upsertFavoriteSnapshot(indicator);
  else removeFavoriteSnapshot(indicator.id);
  toggleFavorite(indicator.id);
}
