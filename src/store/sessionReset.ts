/**
 * O ponto ÚNICO de limpeza de sessão.
 *
 * <p><b>O defeito que isto fecha.</b> O `logout()` tinha uma lista escrita à
 * mão, store por store, e cada store novo dependia de alguém lembrar de entrar
 * nela. Extrato, carteira, revisão, relatórios, categorias, recorrências, o
 * perfil e a conversa com o Nino ficaram de fora — e este app é usado por duas
 * pessoas no MESMO aparelho: quem entrava depois via os lançamentos de quem
 * saiu até o cache de um minuto vencer.
 *
 * <p><b>A regra.</b> Todo arquivo de `src/store` aparece aqui, em UMA de três
 * tabelas, e o teste de guarda (`__tests__/sessionReset.test.ts`) quebra se um
 * store novo ficar de fora — a memória de quem escreve deixou de fazer parte
 * do mecanismo:
 * <ul>
 *   <li>{@link SESSION_RESETS} — cache do que o SERVIDOR tem (extrato,
 *       carteira, contas…). Morre em toda saída e em toda entrada: buscar de
 *       novo devolve tudo.</li>
 *   <li>{@link PERSONAL_RESETS} — o que é da pessoa e só existe NESTE aparelho
 *       (a conversa com o Nino, os favoritos). Não morre na saída: a sessão
 *       expira sozinha, e perder a conversa a cada 401 seria castigar a pessoa
 *       por um prazo do servidor. Morre quando quem entra é OUTRA pessoa.
 *       Enquanto ninguém está logado nada disso é mostrado — as telas que o
 *       leem moram todas na árvore autenticada.</li>
 *   <li>{@link DEVICE_STORES} — estado de tela ou do aparelho, com o porquê
 *       de sobreviver.</li>
 * </ul>
 *
 * <p><b>Por que manifesto, e não cada store se registrando.</b> Registro
 * automático só acontece quando o módulo é importado, e há dado de usuário no
 * DISCO de store que pode ainda não ter sido carregado. O `load` daqui carrega
 * o store, e é o `set` dele que regrava o disco vazio.
 *
 * <p><b>Por que `require` tardio.</b> O mesmo motivo do interceptor em
 * `services/api`: quase todo store importa a API, que importa o authStore, que
 * chama este módulo. Trazer os stores no topo fecharia o ciclo na
 * inicialização.
 */

/** O mínimo que a limpeza precisa de um store, persistido ou não. */
interface ResettableStore {
  getState: () => object;
  persist?: {
    hasHydrated: () => boolean;
    onFinishHydration: (listener: () => void) => () => void;
  };
}

/**
 * Em que momento a limpeza roda. `exit` é o fim da sessão (logout, 401);
 * `entry` é a gravação de uma sessão nova.
 */
export type SessionMoment = "exit" | "entry";

export interface SessionReset {
  /** Carrega o módulo (tardiamente) e devolve o hook do store. */
  load: () => ResettableStore;
  /** A ação de limpeza no estado; `reset` quando não dito. */
  method?: string;
  /** Limita a um dos momentos; sem isto, roda nos dois. */
  only?: SessionMoment;
}

/** Chave = nome do arquivo em `src/store`, sem a extensão. */
export const SESSION_RESETS: Record<string, SessionReset> = {
  // Contas, cartões e cada lançamento de cada fatura; o `hasLoadedOnce`
  // impediria até o refetch. Também mora no disco (último saldo conhecido)
  accountsStore: { load: () => require("./accountsStore").useAccountsStore },
  // Provedor, modelo e os 4 últimos dígitos da chave de IA de quem saiu
  aiSettingsStore: {
    load: () => require("./aiSettingsStore").useAiSettingsStore,
  },
  // A consolidação do mês — também no disco, para a cortina do servidor
  analyticsStore: { load: () => require("./analyticsStore").useAnalyticsStore },
  // Não é dado pessoal: um pedido preso na fila faria o próximo login entrar
  // com a vez ocupada por uma folha que já não existe
  announcementStore: {
    load: () => require("./announcementStore").useAnnouncementStore,
  },
  // O extrato: o dado mais sensível do app
  bankStore: { load: () => require("./bankStore").useBankStore },
  // O catálogo é público, mas vem ORDENADO pelos favoritos de quem pediu
  catalogStore: { load: () => require("./catalogStore").useCatalogStore },
  // Categorias são da conta: nomes como "Mesada do Pedro" são rastro
  categoriesStore: {
    load: () => require("./categoriesStore").useCategoriesStore,
  },
  // Parcelas e compromissos contra a renda
  commitmentsStore: {
    load: () => require("./commitmentsStore").useCommitmentsStore,
  },
  // O diálogo aberto guarda o texto e o CALLBACK de quem saiu
  confirmStore: { load: () => require("./confirmStore").useConfirmStore },
  // Instituições conectadas pelo Open Finance
  connectorStore: { load: () => require("./connectorStore").useConnectorStore },
  // A casa: nome e números de OUTRAS pessoas
  familyStore: { load: () => require("./familyStore").useFamilyStore },
  // Nomes dos arquivos importados
  importSourcesStore: {
    load: () => require("./importSourcesStore").useImportSourcesStore,
  },
  installmentsStore: {
    load: () => require("./installmentsStore").useInstallmentsStore,
  },
  // Posições, saldos e perfil de investidor
  investmentStore: {
    load: () => require("./investmentStore").useInvestmentStore,
  },
  // Manchete não é dado pessoal: o reset descarta as buscas em voo, pedidas
  // com o token que acabou de ser jogado fora
  newsStore: { load: () => require("./newsStore").useNewsStore },
  // A cortina de abertura vale por SESSÃO
  openingStore: { load: () => require("./openingStore").useOpeningStore },
  // O plano é da conta: sem zerar, quem entra depois de um Plus fica sem anúncio
  planStore: { load: () => require("./planStore").usePlanStore },
  // Contas fixas, salário detectado e a previsão de saldo
  recurrenceStore: {
    load: () => require("./recurrenceStore").useRecurrenceStore,
  },
  reportsStore: { load: () => require("./reportsStore").useReportsStore },
  // A fila de revisão é extrato com outro recorte
  reviewStore: { load: () => require("./reviewStore").useReviewStore },
  // O carrinho é da conta, e o que não subiu vai junto (decisão anterior a
  // este módulo, mantida)
  shoppingStore: { load: () => require("./shoppingStore").useShoppingStore },
  // O aviso na tela pode citar o que a pessoa acabou de fazer. Só na saída:
  // o porquê está no `reset` do store
  toastStore: {
    load: () => require("./toastStore").useToastStore,
    only: "exit",
  },
  // Nome, e-mail e os contadores do hub
  userStore: { load: () => require("./userStore").useUserStore },
  // Aportes e resgates
  walletStore: { load: () => require("./walletStore").useWalletStore },
  // Desejos, salário confirmado e jornada: o dado mais pessoal que o app tem
  wishStore: { load: () => require("./wishStore").useWishStore },
};

/**
 * O que é da pessoa e só existe neste aparelho. Ver o topo do arquivo para a
 * regra; quem decide "é outra pessoa" é o `openSession` do authStore.
 */
export const PERSONAL_RESETS: Record<string, SessionReset> = {
  // A conversa com o Nino cita gastos e saldos, e fica no disco sem prazo
  aiStore: { load: () => require("./aiStore").useAiStore },
  // Os ativos que a pessoa acompanha
  favoritesStore: { load: () => require("./favoritesStore").useFavoritesStore },
  // SÓ os retratos dos favoritos. Cotação é pública e fica
  indicatorStore: {
    load: () => require("./indicatorStore").useIndicatorStore,
    method: "resetFavorites",
  },
  // SÓ os campos derivados da conta; tema, tranca e afins são do aparelho —
  // a lista e o porquê estão no próprio store
  preferencesStore: {
    load: () => require("./preferencesStore").usePreferencesStore,
    method: "resetAccountScoped",
  },
};

/**
 * Os stores que NÃO são limpos, cada um com o seu porquê. Existe para o teste
 * de guarda distinguir "decidi que fica" de "esqueci" — e o mesmo teste trava
 * a lista de CAMPOS de cada um: um store "do aparelho" que ganhe um campo novo
 * tem de passar por alguém que decida se o campo é do aparelho mesmo.
 */
export const DEVICE_STORES: Record<string, string> = {
  authStore: "é a própria sessão; quem chama a limpeza é ele",
  // As camadas são dos componentes MONTADOS: cada um tira a sua ao desmontar,
  // e a árvore autenticada desmonta inteira na saída. Esvaziar aqui apagaria
  // também as de quem mora na raiz (aviso de versão, tranca) e segue montado
  overlayStore: "camadas de folhas montadas; saem com o componente dono",
  serverStore: "se o servidor está acordando: estado da hospedagem",
  sessionReset: "este módulo",
  tabBarStore: "posição de rolagem da barra de abas",
  versionStore: "versão mínima exigida pelo servidor: vale para o aparelho",
};

/**
 * Roda uma limpeza — agora e, se o store ainda não leu o disco, de novo
 * quando terminar de ler.
 *
 * <p><b>O defeito que a segunda vez fecha.</b> O store persistido começa a
 * hidratar no instante em que o módulo é carregado, e a leitura do disco é
 * assíncrona. Se a limpeza chega no meio (o `load` daqui pode ser justamente
 * quem carregou o módulo; ou o 401 chegou antes de o app terminar de abrir), o
 * `reset` limpa a memória, a leitura volta LOGO DEPOIS com o que estava no
 * disco e repõe os dados de quem saiu — em memória, e no disco de novo no
 * próximo `set`. Limpar outra vez no fim da hidratação é o que faz a limpeza
 * ser a última palavra, na ordem em que as coisas chegarem.
 */
function run(name: string, entry: SessionReset): void {
  try {
    const store = entry.load();
    const reset = () =>
      (store.getState() as Record<string, () => void>)[entry.method ?? "reset"]();
    reset();
    if (store.persist && !store.persist.hasHydrated()) {
      const stop = store.persist.onFinishHydration(() => {
        stop();
        reset();
      });
    }
  } catch (error) {
    // Uma limpeza que estoura não pode impedir as outras: sair pela metade é
    // pior do que sair com um aviso no console
    console.error(`Falha ao limpar ${name} no fim da sessão:`, error);
  }
}

/**
 * Apaga o cache do que é do servidor — memória e disco.
 *
 * <p>Chamado em TODO caminho que encerra ou troca a sessão: `logout()` (Perfil,
 * tranca da biometria, 401 do interceptor, "apagar dados locais") e a entrada
 * de uma sessão nova (login, segundo fator, cadastro). A entrada repete a
 * limpeza de propósito: é o que garante "B entra, nada de A aparece" mesmo que
 * alguma coisa tenha sido escrita entre a saída e a entrada.
 */
export function clearSessionData(moment: SessionMoment = "exit"): void {
  for (const [name, entry] of Object.entries(SESSION_RESETS)) {
    if (entry.only && entry.only !== moment) continue;
    run(name, entry);
  }
}

/**
 * Apaga o que é da pessoa e só existe neste aparelho. Chamado quando quem
 * entra NÃO é quem saiu, e pelo "apagar dados locais".
 */
export function clearPersonalData(): void {
  for (const [name, entry] of Object.entries(PERSONAL_RESETS)) {
    run(name, entry);
  }
}
