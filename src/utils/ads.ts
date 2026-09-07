import {
  APP_ROUTES,
  FINANCE_TAB_ROUTES,
  MAIN_TAB_ROUTES,
} from "../routes/routeNames";

/**
 * Quem fornece o anúncio.
 *
 * <p>"house" é anúncio da casa: um cartão interno que aponta para algo do
 * próprio produto. É o único provedor hoje, e este é o PONTO ÚNICO de troca —
 * quando (e se) entrar rede de terceiros, muda aqui e o `AdSlot` continua
 * igual.
 *
 * <p>Por que ainda não é AdMob/AdSense: os dois exigem conta do dono, aprovação
 * do domínio/app e, no nativo, um módulo nativo (react-native-google-mobile-ads
 * ou equivalente) — o que significa build novo do APK e outra dependência
 * nativa num projeto que já paga caro por elas. É decisão de produto
 * pendente, não dívida técnica: enquanto não há conta, "house" é o honesto.
 */
export type AdProvider = "none" | "house";

export function getAdProvider(): AdProvider {
  return "house";
}

/** Para onde o cartão leva. Nomes de rota vindos de `routeNames`, nunca literais. */
export interface HouseAdTarget {
  name: string;
  params?: Record<string, unknown>;
}

export interface HouseAd {
  id: string;
  title: string;
  body: string;
  /** Verbo curto do botão — o cartão inteiro é clicável, isto é só o convite. */
  cta: string;
  route: HouseAdTarget;
}

// Do Perfil ou de qualquer tela de pilha, "Finanças" não é alcançável direto:
// ela mora dentro de "Main". Navegar para "Main" com o destino aninhado é o
// que funciona de qualquer lugar do app.
const EXTRATO: HouseAdTarget = {
  name: APP_ROUTES.main,
  params: {
    screen: MAIN_TAB_ROUTES.financas,
    params: { screen: FINANCE_TAB_ROUTES.extrato },
  },
};

/**
 * Os cartões da casa. Cada um aponta para algo que o usuário ganha ao clicar
 * — o critério para entrar na lista é esse, e não "o que queremos empurrar".
 */
export const HOUSE_ADS: readonly HouseAd[] = [
  {
    id: "plus",
    title: "Economize! Plus",
    body: "Sem anúncios e com mais. Diga se tem interesse — ainda não cobramos nada.",
    cta: "Conhecer",
    route: { name: APP_ROUTES.plano },
  },
  {
    id: "conectar-banco",
    title: "Conecte seu banco",
    body: "As transações entram sozinhas, sem baixar extrato todo mês.",
    cta: "Conectar",
    route: EXTRATO,
  },
  {
    id: "importar-extrato",
    title: "Importe o extrato do mês",
    body: "Um arquivo do banco e o mês inteiro aparece categorizado.",
    cta: "Importar",
    route: EXTRATO,
  },
  {
    id: "renda",
    title: "Quanto vale sua hora?",
    body: "Cadastre renda e jornada para ver cada gasto em horas de trabalho.",
    cta: "Cadastrar",
    route: { name: APP_ROUTES.renda },
  },
];

// A rotação é por MONTAGEM, não por tempo: cada slot novo mostra o próximo
// cartão da lista, e o que já está na tela fica parado. Banner que troca
// sozinho rouba o olho do conteúdo — que é exatamente o que um anúncio
// responsável não faz.
let cursor = -1;

export function nextHouseAd(): HouseAd {
  cursor = (cursor + 1) % HOUSE_ADS.length;
  return HOUSE_ADS[cursor];
}

/** Volta ao começo da rotação. Só para os testes começarem do mesmo cartão. */
export function resetHouseAdRotation(): void {
  cursor = -1;
}
