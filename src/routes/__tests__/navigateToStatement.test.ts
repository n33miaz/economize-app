import {
  navigateToStatement,
  statementNavigateArgs,
} from "../navigateToStatement";
import {
  APP_ROUTES,
  FINANCE_TAB_ROUTES,
  MAIN_TAB_ROUTES,
} from "../routeNames";

describe("navigateToStatement — o atalho único para o Extrato", () => {
  it("aninha pela aba-mãe: Main › Finanças › Extrato", () => {
    // O Extrato é aba de segundo nível e o React Navigation 7 não repassa um
    // NAVIGATE não tratado aos netos: sem os três níveis o pedido morre na
    // aba de baixo. A forma aninhada funciona de qualquer tela, inclusive de
    // dentro de Main
    expect(statementNavigateArgs()).toEqual([
      APP_ROUTES.main,
      {
        screen: MAIN_TAB_ROUTES.financas,
        params: { screen: FINANCE_TAB_ROUTES.extrato },
      },
    ]);
  });

  it("o filtro de conta vai nos params da FOLHA, não da aba-mãe", () => {
    // Espalhado no nível de Finanças, o accountId ficaria na aba-mãe e o
    // Extrato nunca o leria em route.params
    expect(statementNavigateArgs({ accountId: "acc-1" })).toEqual([
      APP_ROUTES.main,
      {
        screen: MAIN_TAB_ROUTES.financas,
        params: {
          screen: FINANCE_TAB_ROUTES.extrato,
          params: { accountId: "acc-1" },
        },
      },
    ]);
  });

  it("objeto vazio não inventa params na folha", () => {
    expect(statementNavigateArgs({})[1]).toEqual({
      screen: MAIN_TAB_ROUTES.financas,
      params: { screen: FINANCE_TAB_ROUTES.extrato },
    });
  });

  it("chama o navigate da tela com exatamente esses argumentos", () => {
    const navigate = jest.fn();

    navigateToStatement({ navigate }, { accountId: "acc-1" });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      ...statementNavigateArgs({ accountId: "acc-1" }),
    );
  });

  it("sem filtro, navega para o Extrato inteiro", () => {
    const navigate = jest.fn();

    navigateToStatement({ navigate });

    expect(navigate).toHaveBeenCalledWith(...statementNavigateArgs());
  });
});
