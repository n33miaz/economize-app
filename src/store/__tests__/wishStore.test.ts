import { useWishStore } from "../wishStore";

jest.mock("../../services/api", () => ({
  getWishes: jest.fn(),
  createWish: jest.fn(),
  updateWish: jest.fn(),
  deleteWish: jest.fn(),
  purchaseWish: jest.fn(),
  getIncomeOverview: jest.fn(),
  createIncomeSource: jest.fn(),
  updateIncomeSource: jest.fn(),
  deleteIncomeSource: jest.fn(),
  acceptIncomeSuggestion: jest.fn(),
  saveWorkProfile: jest.fn(),
}));

const api = jest.requireMock("../../services/api");

const projecao = (over = {}) => ({
  remaining: 18000,
  hoursOfWork: 709.1,
  workDays: 88.6,
  monthsToAfford: 20,
  estimatedDate: "2028-04-30",
  installments: 20,
  maxInstallment: 900,
  achieved: false,
  whatIfs: [],
  ...over,
});

const desejo = (id: string, name = "Moto") => ({
  id,
  name,
  targetAmount: 18000,
  savedAmount: 0,
  categoryId: null,
  status: "WISH",
  targetDate: null,
  note: null,
  purchasedAt: null,
  purchaseTransactionId: null,
  projection: projecao(),
});

const baseline = (over = {}) => ({
  workIncome: 4400,
  hourlyRate: 25.39,
  hoursPerMonth: 173.33,
  monthlyLeftover: 900,
  monthlyExpense: 3500,
  cyclesConsidered: 3,
  gaps: [],
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  useWishStore.getState().reset();
  api.getWishes.mockResolvedValue({
    baseline: baseline(),
    wishes: [desejo("a")],
  });
  api.getIncomeOverview.mockResolvedValue({
    sources: [],
    workProfile: null,
    suggestions: [],
  });
});

describe("carregamento", () => {
  it("guarda o retrato financeiro junto dos desejos", async () => {
    await useWishStore.getState().fetch();

    const state = useWishStore.getState();
    expect(state.wishes).toHaveLength(1);
    expect(state.baseline?.hourlyRate).toBe(25.39);
    expect(state.hasLoadedOnce).toBe(true);
    expect(state.error).toBeNull();
  });

  it("falha de rede vira mensagem, não lista vazia silenciosa", async () => {
    api.getWishes.mockRejectedValue(new Error("Network Error"));

    await useWishStore.getState().fetch();

    expect(useWishStore.getState().error).toContain("carregar seus desejos");
    // hasLoadedOnce continua falso: a tela precisa poder tentar de novo
    expect(useWishStore.getState().hasLoadedOnce).toBe(false);
  });
});

describe("desejos", () => {
  it("o desejo novo entra na frente, como a listagem do servidor devolve", async () => {
    await useWishStore.getState().fetch();
    api.createWish.mockResolvedValue(desejo("b", "Viagem"));

    const result = await useWishStore.getState().create({
      name: "Viagem",
      targetAmount: 8000,
    });

    expect(result.ok).toBe(true);
    // inserir no fim deixaria a tela discordando do próximo fetch
    expect(useWishStore.getState().wishes.map((w) => w.id)).toEqual(["b", "a"]);
  });

  it("erro ao criar não mexe na lista", async () => {
    await useWishStore.getState().fetch();
    api.createWish.mockRejectedValue({
      response: { status: 400, data: { detail: "Limite de 100 desejos atingido" } },
    });

    const result = await useWishStore
      .getState()
      .create({ name: "X", targetAmount: 10 });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("limite de desejos");
    expect(useWishStore.getState().wishes).toHaveLength(1);
    expect(useWishStore.getState().isSaving).toBe(false);
  });

  it("excluir com sucesso limpa o erro anterior", async () => {
    await useWishStore.getState().fetch();
    useWishStore.setState({ error: "falha antiga" });
    api.deleteWish.mockResolvedValue(undefined);

    const result = await useWishStore.getState().remove("a");

    expect(result.ok).toBe(true);
    expect(useWishStore.getState().wishes).toHaveLength(0);
    // sem isso, uma falha antiga fica grudada anunciando fracasso logo depois
    // de a exclusão dar certo
    expect(useWishStore.getState().error).toBeNull();
  });

  it("excluir com falha mantém o desejo na lista", async () => {
    await useWishStore.getState().fetch();
    api.deleteWish.mockRejectedValue(new Error("boom"));

    const result = await useWishStore.getState().remove("a");

    expect(result.ok).toBe(false);
    expect(useWishStore.getState().wishes).toHaveLength(1);
  });

  it("promover a meta troca só o desejo alterado", async () => {
    api.getWishes.mockResolvedValue({
      baseline: baseline(),
      wishes: [desejo("a"), desejo("b", "Viagem")],
    });
    await useWishStore.getState().fetch();
    api.updateWish.mockResolvedValue({ ...desejo("a"), status: "GOAL" });

    await useWishStore.getState().update("a", { status: "GOAL" });

    const wishes = useWishStore.getState().wishes;
    expect(wishes.find((w) => w.id === "a")?.status).toBe("GOAL");
    expect(wishes.find((w) => w.id === "b")?.status).toBe("WISH");
  });

  it("a compra preserva o que já estava guardado", async () => {
    await useWishStore.getState().fetch();
    api.purchaseWish.mockResolvedValue({
      ...desejo("a"),
      status: "PURCHASED",
      savedAmount: 12000,
      purchasedAt: "2026-08-20",
    });

    const result = await useWishStore.getState().purchase("a");

    expect(result.ok).toBe(true);
    expect(useWishStore.getState().wishes[0].savedAmount).toBe(12000);
  });
});

describe("renda muda o valor da hora", () => {
  it("salvar a jornada recarrega TAMBÉM os desejos", async () => {
    api.saveWorkProfile.mockResolvedValue({
      daysPerWeek: 5,
      hoursPerDay: 8,
      hoursPerMonth: 173.33,
    });

    await useWishStore.getState().saveJourney({ daysPerWeek: 5, hoursPerDay: 8 });

    // recarregar só o painel de renda deixaria a tela dizendo "709 h" ao lado
    // de uma jornada que acabou de mudar
    expect(api.getIncomeOverview).toHaveBeenCalledTimes(1);
    expect(api.getWishes).toHaveBeenCalledTimes(1);
  });

  it("a recarga é serial: a listagem só parte depois da gravação e do panorama", async () => {
    const ordem: string[] = [];
    api.createIncomeSource.mockImplementation(async () => {
      ordem.push("gravou");
      return {};
    });
    api.getIncomeOverview.mockImplementation(async () => {
      ordem.push("panorama");
      return { sources: [], workProfile: null, suggestions: [] };
    });
    api.getWishes.mockImplementation(async () => {
      ordem.push("desejos");
      return { baseline: baseline(), wishes: [] };
    });

    await useWishStore
      .getState()
      .addIncome({ kind: "SALARY", name: "Salário", expectedAmount: 4400 });

    // Em paralelo, a listagem podia partir antes de o servidor terminar de
    // gravar e voltar com a projeção antiga — a mesma corrida que já mordeu a
    // conexão de bancos
    expect(ordem).toEqual(["gravou", "panorama", "desejos"]);
  });

  it("confirmar a sugestão do extrato também recalcula os desejos", async () => {
    api.acceptIncomeSuggestion.mockResolvedValue({});

    const result = await useWishStore.getState().acceptSuggestion("serie-1");

    expect(result.ok).toBe(true);
    expect(api.getWishes).toHaveBeenCalledTimes(1);
  });

  it("falha ao gravar a renda não dispara recarga nenhuma", async () => {
    api.createIncomeSource.mockRejectedValue({
      response: { status: 409, data: { detail: "Já existe uma fonte de renda" } },
    });

    const result = await useWishStore
      .getState()
      .addIncome({ kind: "SALARY", name: "Salário" });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("já tem uma fonte de renda");
    expect(api.getWishes).not.toHaveBeenCalled();
    expect(useWishStore.getState().isSaving).toBe(false);
  });
});

describe("reset", () => {
  it("apaga tudo — o salário do dono anterior não pode sobreviver ao logout", async () => {
    await useWishStore.getState().fetch();
    await useWishStore.getState().fetchIncome();

    useWishStore.getState().reset();

    const state = useWishStore.getState();
    expect(state.wishes).toEqual([]);
    expect(state.baseline).toBeNull();
    expect(state.income).toBeNull();
    expect(state.hasLoadedOnce).toBe(false);
    expect(state.hasLoadedIncomeOnce).toBe(false);
  });
});
