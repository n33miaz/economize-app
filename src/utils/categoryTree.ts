import type { Category } from "../services/api";

/** Categoria raiz já com as subcategorias penduradas. */
export interface CategoryNode extends Category {
  children: Category[];
}

interface TreeOptions {
  /** Inclui arquivadas (a tela de Categorias mostra; o picker não). */
  includeArchived?: boolean;
}

const byName = (a: Category, b: Category) =>
  a.name.localeCompare(b.name, "pt-BR");

/**
 * Monta a árvore de dois níveis. Subcategoria cujo pai não veio na lista vira
 * raiz em vez de sumir — perder categoria da tela é pior que mostrá-la solta.
 */
export function buildCategoryTree(
  items: Category[],
  { includeArchived = false }: TreeOptions = {},
): CategoryNode[] {
  const visible = includeArchived ? items : items.filter((c) => !c.archived);
  const roots = new Map<string, CategoryNode>();

  for (const category of visible) {
    if (!category.parentId) roots.set(category.id, { ...category, children: [] });
  }
  const orphans: CategoryNode[] = [];
  for (const category of visible) {
    if (!category.parentId) continue;
    const parent = roots.get(category.parentId);
    if (parent) parent.children.push(category);
    else orphans.push({ ...category, children: [] });
  }

  const list = [...roots.values(), ...orphans];
  list.forEach((node) => node.children.sort(byName));
  return list.sort(byName);
}

/** Seções da tela/picker: o grupo vem sempre da raiz. */
export function groupRootsByGroupName(
  roots: CategoryNode[],
): { title: string; data: CategoryNode[] }[] {
  const named = new Map<string, CategoryNode[]>();
  const others: CategoryNode[] = [];
  for (const root of roots) {
    if (!root.groupName) {
      others.push(root);
      continue;
    }
    const list = named.get(root.groupName) ?? [];
    list.push(root);
    named.set(root.groupName, list);
  }
  const sections = [...named.entries()].map(([title, data]) => ({ title, data }));
  if (others.length > 0) sections.push({ title: "Outras", data: others });
  return sections;
}

/** "Alimentação › Delivery" para telas onde a subcategoria aparece sozinha. */
export function categoryPath(category: Category): string {
  return category.parentName
    ? `${category.parentName} › ${category.name}`
    : category.name;
}

export function matchesSearch(category: Category, term: string): boolean {
  if (!term) return true;
  const needle = term
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .trim();
  if (!needle) return true;
  const haystack = `${category.name} ${category.parentName ?? ""}`
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase();
  return haystack.includes(needle);
}
