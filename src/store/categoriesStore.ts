import { create } from "zustand";
import {
  Category,
  CategoryFlow,
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../services/api";

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
}

export const useCategoriesStore = create<CategoriesState>((set, get) => ({
  items: [],
  isLoading: false,
  isSaving: false,
  error: null,

  fetch: async () => {
    set({ isLoading: true, error: null });
    try {
      const items = await getCategories();
      set({ items, isLoading: false });
    } catch {
      set({ error: "Falha ao carregar categorias.", isLoading: false });
    }
  },

  create: async (data) => {
    set({ isSaving: true, error: null });
    try {
      const category = await createCategory(data);
      set({ items: [...get().items, category], isSaving: false });
      return category;
    } catch (e: any) {
      // 400 do backend traz a causa real (ex.: nome duplicado) no ProblemDetail
      const detail = e?.response?.data?.detail;
      set({ error: detail || "Falha ao criar categoria.", isSaving: false });
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
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || "Falha ao salvar categoria.", isSaving: false });
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
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      set({ error: detail || "Falha ao remover categoria.", isSaving: false });
      return null;
    }
  },

  byId: (id) => (id ? get().items.find((c) => c.id === id) : undefined),
}));
