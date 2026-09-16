import { APP_ROUTES, FINANCE_TAB_ROUTES, MAIN_TAB_ROUTES } from "./routeNames";

/** O que o Extrato aceita ao ser aberto por atalho. */
export interface StatementParams {
  /** Abre já filtrado por esta conta — é o filtro de origem inicial. */
  accountId?: string;
}

/**
 * O mínimo que o helper pede de quem navega. As telas recebem o `navigate` do
 * `useNavigation()` sem ParamList tipado (o projeto não declara um), então o
 * contrato aqui é estrutural: qualquer objeto com `navigate` serve, inclusive
 * o `jest.fn()` dos testes.
 */
export interface StatementNavigator {
  navigate(...args: never[]): void;
}

/**
 * Os argumentos do `navigate` — separados para o teste conferir a forma sem
 * precisar de um navegador montado.
 *
 * A forma é sempre a aninhada por `Main`: o Extrato é aba de segundo nível
 * (Finanças › Extrato) e o React Navigation 7 não repassa um NAVIGATE não
 * tratado aos netos. Aninhar funciona de qualquer tela — da pilha (Cartões,
 * Análise) E de dentro de Main (Home), porque o container já montado resolve
 * a rota. Um helper só, em vez de cada tela escrever os três níveis à mão.
 *
 * Os params da FOLHA vão dentro de `params.params`: é assim que chegam em
 * `route.params` do Extrato. Espalhados no nível de Finanças, o `accountId`
 * ficaria na aba-mãe e o Extrato nunca o leria.
 */
export function statementNavigateArgs(
  params?: StatementParams,
): readonly [string, object] {
  const hasParams = params !== undefined && Object.keys(params).length > 0;
  return [
    APP_ROUTES.main,
    {
      screen: MAIN_TAB_ROUTES.financas,
      params: hasParams
        ? { screen: FINANCE_TAB_ROUTES.extrato, params }
        : { screen: FINANCE_TAB_ROUTES.extrato },
    },
  ] as const;
}

/** Leva ao Extrato de qualquer tela, opcionalmente já filtrado por conta. */
export function navigateToStatement(
  navigation: StatementNavigator,
  params?: StatementParams,
): void {
  // O `navigate` das telas é genérico sobre um ParamList vazio: o cast é o
  // mesmo `as any` que as telas já faziam, só que num lugar único
  const navigate = navigation.navigate as unknown as (
    name: string,
    params: object,
  ) => void;
  navigate(...statementNavigateArgs(params));
}
