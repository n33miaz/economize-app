import {
  createCategory,
  deleteCategory,
  getCategories,
  updateCategory,
} from "../../services/api";
import { useCategoriesStore } from "../categoriesStore";

import type { Category } from "../../services/api";

jest.mock("../../services/api", () => ({
  getCategories: jest.fn(),
  createCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
}));

const mockGet = getCategories as jest.MockedFunction<typeof getCategories>;
const mockCreate = createCategory as jest.MockedFunction<typeof createCategory>;
const mockUpdate = updateCategory as jest.MockedFunction<typeof updateCategory>;
const mockDelete = deleteCategory as jest.MockedFunction<typeof deleteCategory>;

const cat = (id: string, over: Partial<Category> = {}): Category =>
  ({
    id,
    name: `Categoria ${id}`,
    groupName: null,
    slug: id,
    flow: "EXPENSE",
    color: null,
    icon: null,
    systemKey: null,
    parentSystemKey: null,
    parentId: null,
    system: false,
    archived: false,
    ...over,
  }) as Category;

/** Erro do backend no formato ProblemDetail, como o axios o entrega. */
const erroComDetalhe = (detail: string) =>
  Object.assign(new Error("Request failed"), { response: { data: { detail } } });

describe("categoriesStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCategoriesStore.setState({
      items: [],
      isLoading: false,
      isSaving: false,
      error: null,
    });
  });

  it("carrega o catálogo", async () => {
    mockGet.mockResolvedValue([cat("c1"), cat("c2")]);

    await useCategoriesStore.getState().fetch();

    expect(useCategoriesStore.getState().items).toHaveLength(2);
    expect(useCategoriesStore.getState().isLoading).toBe(false);
  });

  it("falha ao carregar vira mensagem de tela", async () => {
    mockGet.mockRejectedValue(new Error("offline"));

    await useCategoriesStore.getState().fetch();

    expect(useCategoriesStore.getState().error).toMatch(/categorias/i);
  });

  it("criar acrescenta sem refazer a lista", async () => {
    useCategoriesStore.setState({ items: [cat("c1")] });
    mockCreate.mockResolvedValue(cat("c2", { name: "Pet" }));

    const criada = await useCategoriesStore.getState().create({ name: "Pet" });

    expect(criada?.name).toBe("Pet");
    expect(useCategoriesStore.getState().items).toHaveLength(2);
    expect(mockGet).not.toHaveBeenCalled();
  });

  it("erro de criação mostra a CAUSA que o backend deu", async () => {
    // 400 do servidor traz "já existe uma categoria com esse nome" — dizer
    // "falha ao criar" no lugar esconderia justamente o que resolve
    mockCreate.mockRejectedValue(erroComDetalhe("Já existe uma categoria com esse nome"));

    const criada = await useCategoriesStore.getState().create({ name: "Pet" });

    expect(criada).toBeNull();
    expect(useCategoriesStore.getState().error)
      .toBe("Já existe uma categoria com esse nome");
    expect(useCategoriesStore.getState().isSaving).toBe(false);
  });

  it("editar troca só a categoria alterada", async () => {
    useCategoriesStore.setState({ items: [cat("c1"), cat("c2")] });
    mockUpdate.mockResolvedValue(cat("c1", { name: "Renomeada" }));

    await useCategoriesStore.getState().update("c1", { name: "Renomeada" });

    const items = useCategoriesStore.getState().items;
    expect(items.find((c) => c.id === "c1")?.name).toBe("Renomeada");
    expect(items.find((c) => c.id === "c2")?.name).toBe("Categoria c2");
  });

  it("arquivar o pai arquiva as filhas na tela, como o backend faz no banco", async () => {
    useCategoriesStore.setState({
      items: [cat("pai"), cat("filha", { parentId: "pai" }), cat("outra")],
    });
    mockUpdate.mockResolvedValue(cat("pai", { archived: true }));

    await useCategoriesStore.getState().update("pai", { archived: true });

    const items = useCategoriesStore.getState().items;
    // Sem espelhar, a subcategoria continuaria no seletor até o próximo fetch
    expect(items.find((c) => c.id === "filha")?.archived).toBe(true);
    expect(items.find((c) => c.id === "outra")?.archived).toBe(false);
  });

  it("excluir o pai leva as filhas junto", async () => {
    useCategoriesStore.setState({
      items: [cat("pai"), cat("filha", { parentId: "pai" }), cat("outra")],
    });
    mockDelete.mockResolvedValue({ deleted: true } as never);

    const resultado = await useCategoriesStore.getState().remove("pai");

    expect(resultado).toBe("deleted");
    expect(useCategoriesStore.getState().items.map((c) => c.id)).toEqual(["outra"]);
  });

  it("categoria em uso é ARQUIVADA, e continua na lista marcada", async () => {
    useCategoriesStore.setState({
      items: [cat("pai"), cat("filha", { parentId: "pai" })],
    });
    mockDelete.mockResolvedValue({ deleted: false } as never);

    const resultado = await useCategoriesStore.getState().remove("pai");

    expect(resultado).toBe("archived");
    // Sumir da lista apagaria a categoria do histórico de quem já a usou
    expect(useCategoriesStore.getState().items).toHaveLength(2);
    expect(useCategoriesStore.getState().items.every((c) => c.archived)).toBe(true);
  });

  it("falha ao remover não tira nada da tela", async () => {
    useCategoriesStore.setState({ items: [cat("c1")] });
    mockDelete.mockRejectedValue(erroComDetalhe("Categoria do sistema não pode ser removida"));

    const resultado = await useCategoriesStore.getState().remove("c1");

    expect(resultado).toBeNull();
    expect(useCategoriesStore.getState().items).toHaveLength(1);
    expect(useCategoriesStore.getState().error)
      .toBe("Categoria do sistema não pode ser removida");
  });

  it("byId acha a categoria e tolera id ausente", () => {
    useCategoriesStore.setState({ items: [cat("c1")] });

    expect(useCategoriesStore.getState().byId("c1")?.id).toBe("c1");
    expect(useCategoriesStore.getState().byId("nao-existe")).toBeUndefined();
    expect(useCategoriesStore.getState().byId(null)).toBeUndefined();
    expect(useCategoriesStore.getState().byId(undefined)).toBeUndefined();
  });
});
