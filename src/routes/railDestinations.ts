import CalendarClock from "lucide-react-native/dist/esm/icons/calendar-clock";
import ChartCandlestick from "lucide-react-native/dist/esm/icons/chart-candlestick";
import ChartColumn from "lucide-react-native/dist/esm/icons/chart-column";
import ChartPie from "lucide-react-native/dist/esm/icons/chart-pie";
import CreditCard from "lucide-react-native/dist/esm/icons/credit-card";
import House from "lucide-react-native/dist/esm/icons/house";
import Info from "lucide-react-native/dist/esm/icons/info";
import Newspaper from "lucide-react-native/dist/esm/icons/newspaper";
import Settings2 from "lucide-react-native/dist/esm/icons/settings-2";
import Sparkles from "lucide-react-native/dist/esm/icons/sparkles";
import Tags from "lucide-react-native/dist/esm/icons/tags";
import User from "lucide-react-native/dist/esm/icons/user";
import Wallet from "lucide-react-native/dist/esm/icons/wallet";
import type { LucideIcon } from "lucide-react-native";

import {
  APP_ROUTES,
  FINANCE_TAB_ROUTES,
  MAIN_TAB_ROUTES,
  MARKET_TAB_ROUTES,
  type LeafRouteName,
} from "./routeNames";

/**
 * Mapa de destinos do trilho lateral do desktop.
 *
 * Regra dura: os `route` são os nomes INTERNOS de rota, contrato de todo
 * `navigate()` já espalhado pelas telas. O que muda de nome aqui é só o
 * `label` — o que o usuário lê.
 */
export type RailKey =
  | "home"
  | "financas"
  | "mercado"
  | "cartoes"
  | "analise"
  | "relatorios"
  | "previsao"
  | "categorias"
  | "noticias"
  | "assistente"
  | "perfil"
  | "ajustes"
  | "sobre";

export interface RailDestination {
  key: RailKey;
  /** Rótulo exibido — pode mudar à vontade, não é contrato de navegação. */
  label: string;
  /**
   * Nome interno da rota, vindo de `routeNames.ts`. Tipado: apontar para uma
   * rota que o navegador não declara passou a ser erro de compilação, e não
   * mais uma pílula que apaga em silêncio no desktop.
   */
  route: LeafRouteName;
  /** Abas de "Main" precisam de navegação aninhada; telas do stack, não. */
  inMainTabs: boolean;
  Icon: LucideIcon;
  /**
   * Trio primário: as mesmas três abas da barra inferior. Só elas ganham o
   * ícone com preenchimento animado — no secundário o `fill` do lucide vira
   * silhueta (o "i" do Info some dentro do disco cheio).
   */
  primary: boolean;
}

export interface RailGroup {
  /** Rótulo do grupo; o primeiro grupo não leva título (é a navegação-base). */
  title?: string;
  items: RailDestination[];
}

/**
 * A ordem do trilho não copia a da barra inferior de propósito: no rodapé o
 * "Início" fica no meio porque é o alvo do polegar; numa coluna a leitura é de
 * cima para baixo e quem manda vem primeiro. Os nomes de rota são os mesmos,
 * então nenhum `navigate()` existente muda.
 */
export const RAIL_GROUPS: RailGroup[] = [
  {
    items: [
      {
        key: "home",
        label: "Início",
        route: MAIN_TAB_ROUTES.principal,
        inMainTabs: true,
        Icon: House,
        primary: true,
      },
      {
        key: "financas",
        label: "Finanças",
        route: MAIN_TAB_ROUTES.financas,
        inMainTabs: true,
        Icon: Wallet,
        primary: true,
      },
      {
        key: "mercado",
        label: "Mercado",
        route: MAIN_TAB_ROUTES.indicadores,
        inMainTabs: true,
        Icon: ChartCandlestick,
        primary: true,
      },
    ],
  },
  {
    // Tudo aqui só era alcançável por botão espalhado dentro de outra tela —
    // no celular isso é economia de espaço, no desktop é esconder o produto
    title: "Aprofundar",
    items: [
      {
        // EC-113: o cartão é um destino, não uma tarefa — ele responde a uma
        // pergunta inteira ("o que eu devo neste ciclo") e o usuário volta a
        // ele. Escondê-lo dentro do Extrato repetiria o erro que o EC-108
        // corrigiu: produto alcançável só por botão dentro de outra tela.
        key: "cartoes",
        label: "Cartões",
        route: APP_ROUTES.cartoes,
        inMainTabs: false,
        Icon: CreditCard,
        primary: false,
      },
      {
        key: "analise",
        label: "Análise",
        route: APP_ROUTES.analise,
        inMainTabs: false,
        Icon: ChartColumn,
        primary: false,
      },
      {
        key: "relatorios",
        label: "Relatórios",
        route: APP_ROUTES.relatorios,
        inMainTabs: false,
        Icon: ChartPie,
        primary: false,
      },
      {
        key: "previsao",
        label: "Previsão",
        route: APP_ROUTES.previsao,
        inMainTabs: false,
        Icon: CalendarClock,
        primary: false,
      },
      {
        key: "categorias",
        label: "Categorias",
        route: APP_ROUTES.categorias,
        inMainTabs: false,
        Icon: Tags,
        primary: false,
      },
      {
        key: "noticias",
        label: "Notícias",
        route: APP_ROUTES.noticias,
        inMainTabs: false,
        Icon: Newspaper,
        primary: false,
      },
      {
        key: "assistente",
        label: "Assistente",
        route: APP_ROUTES.assistente,
        inMainTabs: false,
        Icon: Sparkles,
        primary: false,
      },
    ],
  },
  {
    title: "Conta",
    items: [
      {
        key: "perfil",
        label: "Perfil",
        route: APP_ROUTES.perfil,
        inMainTabs: false,
        Icon: User,
        primary: false,
      },
      {
        key: "ajustes",
        label: "Opções avançadas",
        route: APP_ROUTES.avancado,
        inMainTabs: false,
        Icon: Settings2,
        primary: false,
      },
      {
        key: "sobre",
        label: "Sobre",
        route: APP_ROUTES.sobre,
        inMainTabs: false,
        Icon: Info,
        primary: false,
      },
    ],
  },
];

export const RAIL_DESTINATIONS: RailDestination[] = RAIL_GROUPS.flatMap(
  (group) => group.items,
);

/**
 * Rota-folha ativa → item do trilho.
 *
 * A folha é o que o container devolve em `getCurrentRoute()`: dentro de
 * Finanças ela é "Carteira"/"Extrato"/"Recorrências", dentro de Mercado é
 * "Moedas"/"Índices".
 *
 * `null` marca TELA DE TAREFA — revisar, agendar, trocar senha. Elas não são
 * destino de navegação e não têm um lugar fixo no trilho: "Revisão" abre da
 * Home, da Análise E do Extrato. Apontar todas para um destino fixo acendia
 * "Finanças" para quem clicou no card de revisão da Home, e pílula parada no
 * lugar errado é pior do que pílula apagada. O que vale é o destino de onde
 * o usuário veio — ver `railKeyForRoute`.
 *
 * O `Record<LeafRouteName, …>` é o que fecha o buraco antigo: tela nova sem
 * decisão aqui não compila, em vez de virar pílula apagada em runtime.
 */
const ROUTE_TO_RAIL_KEY: Record<LeafRouteName, RailKey | null> = {
  [MAIN_TAB_ROUTES.principal]: "home",
  [MAIN_TAB_ROUTES.financas]: "financas",
  [FINANCE_TAB_ROUTES.carteira]: "financas",
  [FINANCE_TAB_ROUTES.extrato]: "financas",
  [FINANCE_TAB_ROUTES.recorrencias]: "financas",
  [MAIN_TAB_ROUTES.indicadores]: "mercado",
  [MARKET_TAB_ROUTES.moedas]: "mercado",
  [MARKET_TAB_ROUTES.indices]: "mercado",
  [APP_ROUTES.analise]: "analise",
  // Destino próprio: a tela abre do trilho sem cartão escolhido e do Extrato
  // com um cartão no parâmetro — nos dois casos a pílula certa é "Cartões"
  [APP_ROUTES.cartoes]: "cartoes",
  [APP_ROUTES.relatorios]: "relatorios",
  [APP_ROUTES.previsao]: "previsao",
  [APP_ROUTES.categorias]: "categorias",
  [APP_ROUTES.noticias]: "noticias",
  [APP_ROUTES.assistente]: "assistente",
  [APP_ROUTES.perfil]: "perfil",
  [APP_ROUTES.avancado]: "ajustes",
  [APP_ROUTES.sobre]: "sobre",
  // Tarefas: preservam o destino de origem
  [APP_ROUTES.revisao]: null,
  [APP_ROUTES.agendamento]: null,
  [APP_ROUTES.alterarSenha]: null,
};

/**
 * Qual item do trilho acende.
 *
 * `previousKey` é o item que estava aceso antes desta troca de rota. Só é
 * usado nas telas de tarefa, e é o que faz a pílula ficar em "Início" quando
 * a revisão foi aberta pelo card da Home, e em "Análise" quando foi aberta
 * pelo banner de lá. Sem histórico (link direto para a tarefa, cold start),
 * nada acende: é a resposta honesta para "não dá para saber de onde veio".
 */
export function railKeyForRoute(
  routeName?: string,
  previousKey?: RailKey,
): RailKey | undefined {
  if (!routeName) return undefined;
  const mapped = ROUTE_TO_RAIL_KEY[routeName as LeafRouteName];
  if (mapped === null) return previousKey;
  return mapped ?? undefined;
}
