import { create } from "zustand";
import {
  Category,
  CategoryFlow,
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../services/api";
import {
  describeLoadFailure,
  describeSaveFailure,
} from "../services/requestFailure";

interface CategoriesState {
  items: Category[];
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  create: (data: {
    name: string;
    groupName?: string | null;
    flow?: CategoryFlow;
    color?: string | null;
    icon?: string | null;
    parentId?: string | null;
  }) => Promise<Category | null>;
  update: (
    id: string,
    data: Partial<{
      name: string;
      groupName: string | null;
      flow: CategoryFlow;
      color: string | null;
      icon: string | null;
      archived: boolean;
      parentId: string | null;
      clearParent: boolean;
    }>,
  ) => Promise<Category | null>;
  remove: (id: string) => Promise<"deleted" | "archived" | null>;
  byId: (id: string | null | undefined) => Category | undefined;
  /** Fim de sessão: apaga as categorias. */
  reset: () => void;
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  items: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetch: async () => {
    // Uma busca em voo basta: dois focos no mesmo instante (montagem + volta
    // de uma folha) pediam a mesma lista duas vezes, e na instância gratuita
    // isso é o dobro de trabalho para o mesmo resultado
    if (get().isLoading) return;
    set({ isLoading: true, error: null });
    try {
      const items = await getCategories();
      set({ items, isLoading: false });
    } catch (e) {
      const message = describeLoadFailure(e, "Falha ao carregar categorias.");
      if (!message) return;
      set({
        error: message,
        isLoading: false,
      });
    }
  },

  create: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const category = await createCategory(data);
      set({ items: [...get().items, category], isSaving: false });
      return category;
    } catch (e) {
      // 400 do backend traz a causa real (ex.: nome duplicado) no ProblemDetail
      const message = describeSaveFailure(e, "Falha ao criar categoria.");
      if (!message) return null;
      set({
        error: message,
        isSaving: false,
      });
      return null;
    }
  },

  update: async (id, data) => {
    set({ isSaving: true, error: null });
    try {
      const category = await updateCategory(id, data);
      set({
        items: get().items.map((c) => {
          if (c.id === id) return category;
          // o backend arquiva o galho inteiro; espelhar aqui evita a subcategoria
          // continuar aparecendo no picker até o próximo fetch
          if (data.archived && c.parentId === id) return { ...c, archived: true };
          return c;
        }),
        isSaving: false,
      });
      return category;
    } catch (e) {
      const message = describeSaveFailure(e, "Falha ao salvar categoria.");
      if (!message) return null;
      set({
        error: message,
        isSaving: false,
      });
      return null;
    }
  },

  remove: async (id) => {
    set({ isSaving: true, error: null });
    try {
      const result = await deleteCategory(id);
      if (result.deleted) {
        // excluir o pai leva as subcategorias junto
        set({
          items: get().items.filter((c) => c.id !== id && c.parentId !== id),
          isSaving: false,
        });
        return "deleted";
      }
      // arquivada: continua na lista para histórico, mas marcada
      set({
        items: get().items.map((c) =>
          c.id === id || c.parentId === id ? { ...c, archived: true } : c,
        ),
        isSaving: false,
      });
      return "archived";
    } catch (e) {
      const message = describeSaveFailure(e, "Falha ao remover categoria.");
      if (!message) return null;
      set({
        error: message,
        isSaving: false,
      });
      return null;
    }
  },

  byId: (id) => (id ? get().items.find((c) => c.id === id) : undefined),

  // Fim de sessão: categoria é da conta, e o nome que a pessoa deu a cada uma
  // é rastro dela. `isLoading` cai para a conta nova poder buscar
  reset: () =>
    set({ items: [], isLoading: false, isSaving: false, error: null }),
}));
