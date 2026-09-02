import { getUserMe, updateUserMe } from "../../services/api";
import { useAuthStore } from "../authStore";
import { useUserStore } from "../userStore";

import type { UserMe } from "../../services/api";

jest.mock("../../services/api", () => ({
  getUserMe: jest.fn(),
  updateUserMe: jest.fn(),
}));

const mockGet = getUserMe as jest.MockedFunction<typeof getUserMe>;
const mockUpdate = updateUserMe as jest.MockedFunction<typeof updateUserMe>;

const me = (name: string): UserMe =>
  ({ id: "u1", name, email: "dono@economize.test" }) as UserMe;

describe("userStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useUserStore.setState({ me: null, isLoading: false, isSaving: false, error: null });
    useAuthStore.setState({ userName: "Antigo" });
  });

  it("carrega os dados do usuário", async () => {
    mockGet.mockResolvedValue(me("Neemias"));

    await useUserStore.getState().fetchMe();

    expect(useUserStore.getState().me?.name).toBe("Neemias");
    expect(useUserStore.getState().isLoading).toBe(false);
  });

  it("falha ao carregar vira mensagem de tela", async () => {
    mockGet.mockRejectedValue(new Error("offline"));

    await useUserStore.getState().fetchMe();

    expect(useUserStore.getState().error).toMatch(/dados/i);
  });

  it("salvar o nome sincroniza o authStore, que é de onde as telas leem", async () => {
    mockUpdate.mockResolvedValue(me("Nome novo"));

    const ok = await useUserStore.getState().updateName("Nome novo");

    expect(ok).toBe(true);
    expect(useUserStore.getState().me?.name).toBe("Nome novo");
    // Sem sincronizar, a Home continuaria dando "Olá, Antigo" até o próximo login
    expect(useAuthStore.getState().userName).toBe("Nome novo");
  });

  it("falha ao salvar mostra a causa do servidor e não toca o nome exibido", async () => {
    const erro = Object.assign(new Error("400"), {
      response: { data: { detail: "Nome não pode ficar em branco" } },
    });
    mockUpdate.mockRejectedValue(erro);

    const ok = await useUserStore.getState().updateName("");

    expect(ok).toBe(false);
    expect(useUserStore.getState().error).toBe("Nome não pode ficar em branco");
    expect(useAuthStore.getState().userName).toBe("Antigo");
    expect(useUserStore.getState().isSaving).toBe(false);
  });
});
