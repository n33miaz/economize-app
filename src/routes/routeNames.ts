/**
 * Nomes internos de rota — fonte única.
 *
 * Eram literais soltos em três lugares (o navegador, o mapa do trilho e o
 * teste que dizia travá-los), e nenhum deles conversava com os outros:
 * renomear uma tela em `routes/index.tsx` deixava as suítes verdes, o `tsc`
 * mudo e a pílula do trilho apagada em runtime.
 *
 * A partir daqui o literal existe UMA vez. Quem quiser renomear muda aqui, e
 * o compilador cobra o resto — inclusive o mapa do trilho, que é um `Record`
 * sobre estes nomes e por isso não fecha com uma rota sem destino.
 *
 * Estes valores são contrato de `navigate()` espalhado por todas as telas: o
 * que o usuário lê é o `title` da tela e o `label` do trilho, nunca isto.
 */

/** Telas da pilha autenticada. */
export const APP_ROUTES = {
  main: "Main",
  noticias: "Notícias",
  assistente: "IA Assist",
  sobre: "Sobre",
  perfil: "Profile",
  avancado: "Opções avançadas",
  relatorios: "Relatórios",
  analise: "Análise",
  cartoes: "Cartões",
  categorias: "Categorias",
  previsao: "Previsão",
  agendamento: "Agendamento",
  revisao: "Revisão",
  alterarSenha: "Alterar Senha",
  opcoesIa: "Opções de IA",
  desejos: "Desejos",
  renda: "Renda e jornada",
  familia: "Família",
} as const;

/** Abas da barra inferior (o container "Main"). */
export const MAIN_TAB_ROUTES = {
  financas: "Finanças",
  principal: "Principal",
  indicadores: "Indicadores",
} as const;

/** Abas superiores dentro de Finanças. */
export const FINANCE_TAB_ROUTES = {
  carteira: "Carteira",
  extrato: "Extrato",
  recorrencias: "Recorrências",
} as const;

/** Abas superiores dentro de Indicadores. */
export const MARKET_TAB_ROUTES = {
  moedas: "Moedas",
  indices: "Índices",
  // EC-099: as duas de cima são listas curadas e curtas; esta é o catálogo
  // inteiro, paginado por cursor e ordenado pelo servidor
  catalogo: "Catálogo",
} as const;

/** Telas do fluxo sem sessão. */
export const AUTH_ROUTES = {
  login: "Login",
  register: "Register",
  forgotPassword: "ForgotPassword",
  resetPassword: "ResetPassword",
} as const;

export type AppRouteName = (typeof APP_ROUTES)[keyof typeof APP_ROUTES];
export type MainTabRouteName =
  (typeof MAIN_TAB_ROUTES)[keyof typeof MAIN_TAB_ROUTES];
type FinanceTabRouteName =
  (typeof FINANCE_TAB_ROUTES)[keyof typeof FINANCE_TAB_ROUTES];
type MarketTabRouteName =
  (typeof MARKET_TAB_ROUTES)[keyof typeof MARKET_TAB_ROUTES];

/**
 * Tudo que `getCurrentRoute()` pode devolver numa tela autenticada.
 *
 * "Main" fica de fora de propósito: é container, nunca folha. "Finanças" e
 * "Indicadores" também são containers, mas continuam aqui porque o trilho
 * navega para eles e porque um deles pode aparecer como folha por um quadro,
 * antes de a aba interna assumir.
 */
export type LeafRouteName =
  | Exclude<AppRouteName, typeof APP_ROUTES.main>
  | MainTabRouteName
  | FinanceTabRouteName
  | MarketTabRouteName;

/** A mesma lista em runtime, para o teste conferir a cobertura do trilho. */
export const LEAF_ROUTE_NAMES: readonly LeafRouteName[] = [
  ...(Object.values(APP_ROUTES).filter(
    (name) => name !== APP_ROUTES.main,
  ) as Exclude<AppRouteName, typeof APP_ROUTES.main>[]),
  ...Object.values(MAIN_TAB_ROUTES),
  ...Object.values(FINANCE_TAB_ROUTES),
  ...Object.values(MARKET_TAB_ROUTES),
];
