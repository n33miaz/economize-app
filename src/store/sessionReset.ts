/**
 * O ponto ÚNICO de limpeza de sessão.
 *
 * <p><b>O defeito que isto fecha.</b> O `logout()` tinha uma lista escrita à
 * mão, store por store, e cada store novo dependia de alguém lembrar de entrar
 * nela. Extrato, carteira, revisão, relatórios, categorias, recorrências, o
 * perfil e a conversa com o Nino ficaram de fora — e este app é usado por duas
 * pessoas no MESMO aparelho: quem entrava depois via os lançamentos de quem
 * saiu até o cache de um minuto vencer (e a conversa, para sempre: ela mora no
 * disco).
 *
 * <p><b>A regra.</b> Todo arquivo de `src/store` aparece aqui, numa das duas
 * tabelas: ou tem dado de quem está logado e ganha uma limpeza em
 * {@link SESSION_RESETS}, ou é do aparelho/da tela e ganha uma linha em
 * {@link DEVICE_STORES} dizendo POR QUE sobrevive. Um store novo fora das duas
 * quebra o teste de guarda (`__tests__/sessionReset.test.ts`) — a memória de
 * quem escreve deixou de fazer parte do mecanismo.
 *
 * <p><b>Por que manifesto, e não cada store se registrando.</b> Registro
 * automático só acontece quando o módulo é importado, e há dado de usuário no
 * DISCO (conversa, favoritos, carrinho) de store que pode ainda não ter sido
 * carregado. O `require` daqui carrega o store, e é o `set` dele que regrava o
 * disco vazio.
 *
 * <p><b>Por que `require` tardio.</b> O mesmo motivo do interceptor em
 * `services/api`: quase todo store importa a API, que importa o authStore, que
 * chama este módulo. Trazer os stores no topo fecharia o ciclo na
 * inicialização.
 */

/** Chave = nome do arquivo em `src/store`, sem a extensão. */
export const SESSION_RESETS: Record<string, () => void> = {
  // Contas, cartões e cada lançamento de cada fatura; o `hasLoadedOnce`
  // impediria até o refetch. Também mora no disco (último saldo conhecido)
  accountsStore: () =>
    require("./accountsStore").useAccountsStore.getState().reset(),
  // Provedor, modelo e os 4 últimos dígitos da chave de IA de quem saiu
  aiSettingsStore: () =>
    require("./aiSettingsStore").useAiSettingsStore.getState().reset(),
  // A conversa com o Nino cita gastos e saldos, e fica no DISCO
  aiStore: () => require("./aiStore").useAiStore.getState().reset(),
  // A consolidação do mês — também no disco, para a cortina do servidor
  analyticsStore: () =>
    require("./analyticsStore").useAnalyticsStore.getState().reset(),
  // Não é dado pessoal: um pedido preso na fila faria o próximo login entrar
  // com a vez ocupada por uma folha que já não existe
  announcementStore: () =>
    require("./announcementStore").useAnnouncementStore.getState().reset(),
  // O extrato: o dado mais sensível do app
  bankStore: () => require("./bankStore").useBankStore.getState().reset(),
  // O catálogo é público, mas vem ORDENADO pelos favoritos de quem pediu
  catalogStore: () =>
    require("./catalogStore").useCatalogStore.getState().reset(),
  // Categorias são da conta: nomes como "Mesada do Pedro" são rastro
  categoriesStore: () =>
    require("./categoriesStore").useCategoriesStore.getState().reset(),
  // Instituições conectadas pelo Open Finance
  connectorStore: () =>
    require("./connectorStore").useConnectorStore.getState().reset(),
  // A casa: nome e números de OUTRAS pessoas
  familyStore: () => require("./familyStore").useFamilyStore.getState().reset(),
  // Os ativos que a pessoa acompanha — no disco
  favoritesStore: () =>
    require("./favoritesStore").useFavoritesStore.getState().reset(),
  // Nomes dos arquivos importados
  importSourcesStore: () =>
    require("./importSourcesStore").useImportSourcesStore.getState().reset(),
  // SÓ os retratos dos favoritos (disco). Cotação é pública e fica
  indicatorStore: () =>
    require("./indicatorStore").useIndicatorStore.getState().resetFavorites(),
  installmentsStore: () =>
    require("./installmentsStore").useInstallmentsStore.getState().reset(),
  // Posições, saldos e perfil de investidor
  investmentStore: () =>
    require("./investmentStore").useInvestmentStore.getState().reset(),
  // Manchete não é dado pessoal: o reset descarta as buscas em voo, pedidas
  // com o token que acabou de ser jogado fora
  newsStore: () => require("./newsStore").useNewsStore.getState().reset(),
  // A cortina de abertura vale por SESSÃO
  openingStore: () =>
    require("./openingStore").useOpeningStore.getState().reset(),
  // O plano é da conta: sem zerar, quem entra depois de um Plus fica sem anúncio
  planStore: () => require("./planStore").usePlanStore.getState().reset(),
  // SÓ os campos derivados da conta; tema, tranca e afins são do aparelho —
  // a lista e o porquê estão no próprio store
  preferencesStore: () =>
    require("./preferencesStore")
      .usePreferencesStore.getState()
      .resetAccountScoped(),
  // Contas fixas, salário detectado e a previsão de saldo
  recurrenceStore: () =>
    require("./recurrenceStore").useRecurrenceStore.getState().reset(),
  reportsStore: () =>
    require("./reportsStore").useReportsStore.getState().reset(),
  // A fila de revisão é extrato com outro recorte
  reviewStore: () => require("./reviewStore").useReviewStore.getState().reset(),
  // O carrinho é da conta, e o que não subiu vai junto (decisão anterior a
  // este módulo, mantida)
  shoppingStore: () =>
    require("./shoppingStore").useShoppingStore.getState().reset(),
  // Nome, e-mail e os contadores do hub
  userStore: () => require("./userStore").useUserStore.getState().reset(),
  // Aportes e resgates
  walletStore: () => require("./walletStore").useWalletStore.getState().reset(),
  // Desejos, salário confirmado e jornada: o dado mais pessoal que o app tem
  wishStore: () => require("./wishStore").useWishStore.getState().reset(),
};

/**
 * Os stores que NÃO são limpos, cada um com o seu porquê. Existe para o teste
 * de guarda distinguir "decidi que fica" de "esqueci".
 */
export const DEVICE_STORES: Record<string, string> = {
  authStore: "é a própria sessão; quem chama a limpeza é ele",
  confirmStore: "diálogo de confirmação aberto na tela, sem dado de conta",
  overlayStore: "camadas de interface montadas, sem dado de conta",
  serverStore: "se o servidor está acordando: estado da hospedagem",
  sessionReset: "este módulo",
  tabBarStore: "posição de rolagem da barra de abas",
  toastStore: "o aviso na tela — inclusive o 'sessão expirada' do próprio 401",
  versionStore: "versão mínima exigida pelo servidor: vale para o aparelho",
};

/**
 * Apaga tudo o que é de quem estava logado — memória e disco.
 *
 * <p>Chamado em TODO caminho que encerra ou troca a sessão: `logout()` (Perfil,
 * tranca da biometria, 401 do interceptor, "apagar dados locais") e a entrada
 * de uma sessão nova (login, segundo fator, cadastro). A entrada repete a
 * limpeza de propósito: é o que garante "B entra, nada de A aparece" mesmo que
 * alguma coisa tenha sido escrita entre a saída e a entrada.
 *
 * <p>Uma limpeza que estoura não pode impedir as outras: sair pela metade é
 * pior do que sair com um aviso no console.
 */
export function clearSessionData(): void {
  for (const [name, reset] of Object.entries(SESSION_RESETS)) {
    try {
      reset();
    } catch (error) {
      console.error(`Falha ao limpar ${name} no fim da sessão:`, error);
    }
  }
}
