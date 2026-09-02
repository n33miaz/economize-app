import api, {
  applyReview,
  changePassword,
  confirmAllReview,
  convertCurrency,
  createCategory,
  createRecurrence,
  deleteCategory,
  deleteRecurrence,
  detectRecurrences,
  forgotPassword,
  getAccountInvoices,
  getAccounts,
  getAiProviders,
  getAiSettings,
  getAnalyticsMonths,
  getAssetDetail,
  getBankTransactions,
  getCatalog,
  getCategories,
  getDebtOverview,
  getHistoricalData,
  getMonthlyAnalytics,
  getRecurrenceForecast,
  getRecurrences,
  getReviewQueue,
  getTransactions,
  getUserMe,
  resetPassword,
  saveAiSettings,
  updateCategory,
  updateRecurrence,
  updateTransactionAlias,
  updateUserMe,
  acceptIncomeSuggestion,
  createFamily,
  createFamilyInvite,
  createIncomeSource,
  createWish,
  deleteAiSettings,
  deleteFamily,
  deleteIncomeSource,
  deleteWish,
  getCommittedOverview,
  getFamily,
  getFamilyAnalytics,
  getFamilyTransactions,
  getIncomeOverview,
  getWishes,
  joinFamily,
  purchaseWish,
  removeFamilyMember,
  renameFamily,
  saveWorkProfile,
  testAiKey,
  updateFamilySharing,
  updateIncomeSource,
  updateWish,
} from "../api";

// O dublê tem de ser o AXIOS, não este módulo: as funções abaixo fecham sobre
// a instância criada aqui dentro, e trocar o export default não as alcança
jest.mock("axios", () => {
  const cliente = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
  };
  return {
    __esModule: true,
    default: {
      create: jest.fn(() => cliente),
      // O `getApiErrorStatus` só cava no erro se o axios o reconhecer: um
      // dublê que diz "não é meu" faria o 404 da casa virar erro genérico
      isAxiosError: jest.fn(
        (erro: unknown) =>
          typeof erro === "object" && erro !== null && "response" in erro,
      ),
    },
  };
});

const cliente = api as unknown as Record<string, jest.Mock>;

/**
 * O contrato de cada rota (EC-155).
 *
 * <p>São funções de uma linha, e é por isso mesmo que ninguém as testava — mas
 * é nelas que mora o caminho da URL. Um caminho errado não quebra compilação,
 * não quebra teste de store (que dubla estas funções) e só aparece como "não
 * funciona" na mão do usuário. O que se prova aqui é: método certo, caminho
 * certo, parâmetros certos, e o `.data` desembrulhado.
 */
describe("api — o contrato das rotas", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Só os verbos: `interceptors` também mora no cliente e não é dublê
    for (const verbo of ["get", "post", "put", "patch", "delete"]) {
      cliente[verbo].mockResolvedValue({ data: "RESPOSTA" });
    }
  });

  const casos: {
    nome: string;
    chamada: () => Promise<unknown>;
    metodo: string;
    caminho: string;
  }[] = [
    { nome: "catálogo", chamada: () => getCatalog({ limit: 20 }), metodo: "get", caminho: "/indicators/catalog" },
    { nome: "detalhe do ativo", chamada: () => getAssetDetail("PETR4"), metodo: "get", caminho: "/indicators/PETR4/detail" },
    { nome: "extrato bancário", chamada: () => getBankTransactions(), metodo: "get", caminho: "/bank-statements" },
    { nome: "contas", chamada: () => getAccounts(), metodo: "get", caminho: "/accounts" },
    { nome: "categorias", chamada: () => getCategories(), metodo: "get", caminho: "/categories" },
    { nome: "fila de revisão", chamada: () => getReviewQueue(), metodo: "get", caminho: "/transactions/review" },
    { nome: "transações", chamada: () => getTransactions(), metodo: "get", caminho: "/transactions" },
    { nome: "meses com dado", chamada: () => getAnalyticsMonths(), metodo: "get", caminho: "/analytics/months" },
    { nome: "recorrências", chamada: () => getRecurrences(), metodo: "get", caminho: "/recurrences" },
    { nome: "previsão", chamada: () => getRecurrenceForecast(6, 1000), metodo: "get", caminho: "/recurrences/forecast" },
    { nome: "perfil", chamada: () => getUserMe(), metodo: "get", caminho: "/users/me" },
    { nome: "provedores de IA", chamada: () => getAiProviders(), metodo: "get", caminho: "/ai/providers" },
    { nome: "opções de IA", chamada: () => getAiSettings(), metodo: "get", caminho: "/ai/settings" },
    { nome: "detectar recorrências", chamada: () => detectRecurrences(), metodo: "post", caminho: "/recurrences/detect" },
    { nome: "confirmar revisão inteira", chamada: () => confirmAllReview(), metodo: "post", caminho: "/transactions/review/confirm-all" },
    { nome: "aplicar revisão", chamada: () => applyReview([]), metodo: "patch", caminho: "/transactions/review" },
    { nome: "salvar opções de IA", chamada: () => saveAiSettings("openai" as never, "gpt", "chave"), metodo: "put", caminho: "/ai/settings" },
    { nome: "desejos", chamada: () => getWishes(), metodo: "get", caminho: "/wishes" },
    { nome: "criar desejo", chamada: () => createWish({ name: "Moto" } as never), metodo: "post", caminho: "/wishes" },
    { nome: "renda", chamada: () => getIncomeOverview(), metodo: "get", caminho: "/income" },
    { nome: "comprometido", chamada: () => getCommittedOverview(), metodo: "get", caminho: "/income/committed" },
    { nome: "cadastrar fonte", chamada: () => createIncomeSource({ kind: "SALARY", name: "Salário" } as never), metodo: "post", caminho: "/income/sources" },
    { nome: "jornada", chamada: () => saveWorkProfile({ daysPerWeek: 5, hoursPerDay: 8 }), metodo: "put", caminho: "/income/work-profile" },
    { nome: "testar chave de IA", chamada: () => testAiKey({} as never), metodo: "post", caminho: "/ai/settings/test" },
    { nome: "criar casa", chamada: () => createFamily("Casa"), metodo: "post", caminho: "/family" },
    { nome: "renomear casa", chamada: () => renameFamily("Lar"), metodo: "patch", caminho: "/family" },
    { nome: "convite da casa", chamada: () => createFamilyInvite(), metodo: "post", caminho: "/family/invites" },
    { nome: "entrar na casa", chamada: () => joinFamily("NX7QXKS5"), metodo: "post", caminho: "/family/join" },
    { nome: "compartilhamento", chamada: () => updateFamilySharing({} as never), metodo: "put", caminho: "/family/sharing" },
    { nome: "análise da casa", chamada: () => getFamilyAnalytics({ kind: "month", month: "2026-07" }), metodo: "get", caminho: "/family/analytics/monthly" },
    { nome: "extrato da casa", chamada: () => getFamilyTransactions({ range: { kind: "month", month: "2026-07" } }), metodo: "get", caminho: "/family/transactions" },
  ];

  it.each(casos)("$nome usa $metodo $caminho", async ({ chamada, metodo, caminho }) => {
    const resposta = await chamada();

    expect(cliente[metodo]).toHaveBeenCalled();
    expect(cliente[metodo].mock.calls[0][0]).toBe(caminho);
    // Toda função devolve o corpo, nunca o envelope do axios
    expect(resposta).toBe("RESPOSTA");
  });

  it("as rotas de senha não devolvem corpo, e o segredo vai no CORPO", async () => {
    await forgotPassword("a@b.c");
    expect(cliente.post.mock.calls[0][0]).toBe("/auth/forgot-password");
    expect(cliente.post.mock.calls[0][1]).toEqual({ email: "a@b.c" });

    jest.clearAllMocks();
    cliente.post.mockResolvedValue({ data: "RESPOSTA" });
    await resetPassword("tok", "nova");
    expect(cliente.post.mock.calls[0][0]).toBe("/auth/reset-password");
    // Nunca em query string: token e senha em URL vazam no log do servidor
    expect(cliente.post.mock.calls[0][1]).toEqual({ token: "tok", newPassword: "nova" });

    jest.clearAllMocks();
    cliente.post.mockResolvedValue({ data: "RESPOSTA" });
    await changePassword("velha", "nova");
    expect(cliente.post.mock.calls[0][0]).toBe("/users/me/change-password");
    expect(cliente.post.mock.calls[0][1])
      .toEqual({ currentPassword: "velha", newPassword: "nova" });
  });

  it("o id vai no CAMINHO, não no corpo", async () => {
    await updateCategory("c1", { name: "Pet" });
    expect(cliente.patch.mock.calls[0][0]).toBe("/categories/c1");

    jest.clearAllMocks();
    await deleteCategory("c1");
    expect(cliente.delete.mock.calls[0][0]).toBe("/categories/c1");

    jest.clearAllMocks();
    await updateRecurrence("r1", {} as never);
    expect(cliente.patch.mock.calls[0][0]).toBe("/recurrences/r1");

    jest.clearAllMocks();
    await deleteRecurrence("r1");
    expect(cliente.delete.mock.calls[0][0]).toBe("/recurrences/r1");
  });

  it("o apelido vai como displayAlias, e nulo é 'limpar o apelido'", async () => {
    await updateTransactionAlias("t1", null);

    expect(cliente.patch.mock.calls[0][0]).toBe("/transactions/t1/alias");
    // Nulo precisa CHEGAR ao servidor: omitir o campo seria "não mexer"
    expect(cliente.patch.mock.calls[0][1]).toEqual({ displayAlias: null });
  });

  it("a análise mensal manda o recorte como parâmetro", async () => {
    await getMonthlyAnalytics({ kind: "month", month: "2026-07" });

    expect(cliente.get.mock.calls[0][0]).toBe("/analytics/monthly");
    expect(cliente.get.mock.calls[0][1].params).toMatchObject({ month: "2026-07" });
  });

  it("a janela ancorada manda início e fim, e não um mês", async () => {
    await getDebtOverview({ kind: "window", start: "2026-07-05", end: "2026-08-04" });

    const params = cliente.get.mock.calls[0][1].params;
    expect(cliente.get.mock.calls[0][0]).toBe("/analytics/debt");
    expect(params).toMatchObject({ start: "2026-07-05", end: "2026-08-04" });
    expect(params.month).toBeUndefined();
  });

  it("sem recorte, a análise não manda parâmetro nenhum", async () => {
    await getMonthlyAnalytics();

    // `undefined` e não objeto vazio: o axios omite o parâmetro da URL, e o
    // servidor cai no padrão dele em vez de receber um recorte em branco
    expect(cliente.get.mock.calls[0][1].params).toBeUndefined();
  });

  it("o conversor manda código e valor", async () => {
    await convertCurrency("USD", 100);

    expect(cliente.get.mock.calls[0][0]).toBe("/indicators/convert");
    expect(cliente.get.mock.calls[0][1].params).toMatchObject({ code: "USD", amount: 100 });
  });

  it("as faturas de uma conta vão pelo id dela", async () => {
    await getAccountInvoices("a1");

    expect(cliente.get.mock.calls[0][0]).toBe("/accounts/a1/invoices");
  });

  it("criar categoria manda o corpo inteiro", async () => {
    await createCategory({ name: "Pet", flow: "EXPENSE" } as never);

    expect(cliente.post.mock.calls[0][0]).toBe("/categories");
    expect(cliente.post.mock.calls[0][1]).toMatchObject({ name: "Pet" });
  });

  it("criar recorrência manda o corpo inteiro", async () => {
    await createRecurrence({ merchantKey: "netflix" } as never);

    expect(cliente.post.mock.calls[0][0]).toBe("/recurrences");
    expect(cliente.post.mock.calls[0][1]).toMatchObject({ merchantKey: "netflix" });
  });

  it("atualizar o perfil manda o nome no corpo", async () => {
    await updateUserMe("Novo nome");

    expect(cliente.patch.mock.calls[0][0]).toBe("/users/me");
    expect(cliente.patch.mock.calls[0][1]).toEqual({ name: "Novo nome" });
  });

  it("sem casa, o 404 vira NULO — é estado, não erro", async () => {
    const erro = Object.assign(new Error("404"), { response: { status: 404 } });
    cliente.get.mockRejectedValueOnce(erro);

    // A tela mostra os cards de criar/entrar; um ErrorState aqui diria que
    // algo quebrou quando o que houve foi "você ainda não tem casa"
    await expect(getFamily()).resolves.toBeNull();
  });

  it("qualquer outro erro da casa SOBE: 500 não é 'sem casa'", async () => {
    const erro = Object.assign(new Error("500"), { response: { status: 500 } });
    cliente.get.mockRejectedValueOnce(erro);

    await expect(getFamily()).rejects.toThrow();
  });

  it("as rotas com id no caminho o mandam ali, e não no corpo", async () => {
    await updateWish("w1", {} as never);
    expect(cliente.patch.mock.calls[0][0]).toBe("/wishes/w1");

    jest.clearAllMocks();
    await deleteWish("w1");
    expect(cliente.delete.mock.calls[0][0]).toBe("/wishes/w1");

    jest.clearAllMocks();
    cliente.post.mockResolvedValue({ data: "RESPOSTA" });
    await purchaseWish("w1");
    expect(cliente.post.mock.calls[0][0]).toBe("/wishes/w1/purchase");
    // Sem payload, o corpo é objeto vazio: `undefined` viraria corpo ausente
    expect(cliente.post.mock.calls[0][1]).toEqual({});

    jest.clearAllMocks();
    await updateIncomeSource("s1", {} as never);
    expect(cliente.patch.mock.calls[0][0]).toBe("/income/sources/s1");

    jest.clearAllMocks();
    await deleteIncomeSource("s1");
    expect(cliente.delete.mock.calls[0][0]).toBe("/income/sources/s1");

    jest.clearAllMocks();
    cliente.post.mockResolvedValue({ data: "RESPOSTA" });
    await acceptIncomeSuggestion("serie1");
    expect(cliente.post.mock.calls[0][0]).toBe("/income/suggestions/serie1/accept");

    jest.clearAllMocks();
    await removeFamilyMember("m2");
    expect(cliente.delete.mock.calls[0][0]).toBe("/family/members/m2");

    jest.clearAllMocks();
    await deleteFamily();
    expect(cliente.delete.mock.calls[0][0]).toBe("/family");

    jest.clearAllMocks();
    await deleteAiSettings();
    expect(cliente.delete.mock.calls[0][0]).toBe("/ai/settings");
  });

  it("sair da casa é o próprio membro: o id 'me' vai no caminho", async () => {
    await removeFamilyMember("me");

    expect(cliente.delete.mock.calls[0][0]).toBe("/family/members/me");
  });

  it("o extrato da casa leva o filtro de membro junto do período", async () => {
    await getFamilyTransactions({
      range: { kind: "month", month: "2026-07" },
      memberId: "m2",
    });

    const params = cliente.get.mock.calls[0][1].params;
    expect(params).toMatchObject({ month: "2026-07", memberId: "m2" });
  });

  it("o histórico de uma moeda devolve lista vazia quando a rota falha", async () => {
    // A tela do gráfico não pode quebrar por falta de histórico: sem dado ela
    // simplesmente não desenha a linha
    cliente.get.mockRejectedValueOnce(new Error("offline"));

    await expect(getHistoricalData("USD", 7)).resolves.toEqual([]);
  });
});
