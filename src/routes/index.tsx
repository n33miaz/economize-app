import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import {
  createBottomTabNavigator,
  type BottomTabBarProps,
} from "@react-navigation/bottom-tabs";
import { createMaterialTopTabNavigator } from "@react-navigation/material-top-tabs";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useNavigationContainerRef,
  type LinkingOptions,
} from "@react-navigation/native";
import * as ExpoLinking from "expo-linking";
import ChartCandlestick from "lucide-react-native/dist/esm/icons/chart-candlestick";
import House from "lucide-react-native/dist/esm/icons/house";
import WalletTabIcon from "lucide-react-native/dist/esm/icons/wallet";
import { Platform, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "react-native-reanimated";

import { lightTheme } from "../theme/colors";
import { useTheme, type Theme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { useBreakpoint, useContentCapStyle } from "../hooks/useBreakpoint";
import { useAuthStore } from "../store/authStore";
import ScreenHeader from "../components/ScreenHeader";
import MarketNewsTicker from "../components/MarketNewsTicker";
import {
  ephemeralTransition,
  fadeTransition,
  modalLikeTransition,
  slideRightTransition,
} from "./transitions";
import TabBarWithIndicator from "./TabBarWithIndicator";
import AnimatedTabIcon from "./AnimatedTabIcon";
import SideRail from "./SideRail";
import {
  railKeyForRoute,
  type RailDestination,
  type RailKey,
} from "./railDestinations";
import {
  APP_ROUTES,
  AUTH_ROUTES,
  FINANCE_TAB_ROUTES,
  MAIN_TAB_ROUTES,
  MARKET_TAB_ROUTES,
} from "./routeNames";

// Telas
import Login from "../screens/auth/Login";
import Register from "../screens/auth/Register";
import ForgotPassword from "../screens/auth/ForgotPassword";
import ResetPassword from "../screens/auth/ResetPassword";
import ChangePassword from "../screens/ChangePassword";
import Home from "../screens/Home";
import Currencies from "../screens/Currencies";
import Indexes from "../screens/Indexes";
import News from "../screens/News";
import About from "../screens/About";
import Wallet from "../screens/Wallet";
import BankIntegration from "../screens/BankIntegration";
import AiAssistant from "../screens/AiAssistant";
import Profile from "../screens/Profile";
import AdvancedOptions from "../screens/AdvancedOptions";
import AiSettings from "../screens/AiSettings";
import Wishes from "../screens/Wishes";
import IncomeSettings from "../screens/IncomeSettings";
import Reports from "../screens/Reports";
import Analytics from "../screens/Analytics";
import Categories from "../screens/Categories";
import CreditCards from "../screens/CreditCards";
import StatementReview from "../screens/StatementReview";
import Recurrences from "../screens/Recurrences";
import RecurrenceForm from "../screens/RecurrenceForm";
import BalanceForecast from "../screens/BalanceForecast";

// Altura da barra inferior sem contar o inset da barra de gestos
const BOTTOM_BAR_HEIGHT = 84;

const Stack = createNativeStackNavigator();
const BottomTab = createBottomTabNavigator();
const TopTab = createMaterialTopTabNavigator();

// Fora do componente: como arrow inline, cada render do MainTabs entregava
// uma função nova ao navigator e remontava a barra inteira
const renderTabBar = (props: BottomTabBarProps) => (
  <TabBarWithIndicator {...props} />
);
const renderNoTabBar = () => null;

// Moedas e Índices
function IndicatorsTabs() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  // O mesmo teto do miolo das telas de pilha: sem ele, num monitor largo o
  // título e a régua de abas correm até a borda enquanto as listas abaixo
  // param em 1180 — dois eixos diferentes na mesma tela
  const capStyle = useContentCapStyle();
  return (
    <View className="flex-1 bg-background" style={capStyle}>
      <ScreenHeader title="Mercado" subtitle="Moedas e Índices Globais" />
      {/* EC-102: manchetes do momento antes das abas — contexto do mercado
          que o usuário veio olhar, sem roubar espaço das listas */}
      <MarketNewsTicker />
      <TopTab.Navigator
        screenOptions={{
          // Deslizar entre Moedas e Índices é parte da navegação: o gesto
          // fica explícito e a troca por toque no rótulo anima o deslize —
          // salvo quando o sistema pede menos movimento (troca seca)
          swipeEnabled: true,
          animationEnabled: !reducedMotion,
          tabBarPressColor: "transparent",
          tabBarActiveTintColor: t.accent.neon,
          tabBarInactiveTintColor: t.text.tertiary,
          tabBarIndicatorStyle: { backgroundColor: t.accent.neon, height: 3 },
          // Abas centradas com largura natural (visual do protótipo): o grupo
          // encolhe via width auto e centraliza por alignSelf. Centralizar só
          // o conteúdo interno desalinharia o indicador, que posiciona as
          // abas a partir do x=0 da própria barra.
          tabBarStyle: {
            alignSelf: "center",
            width: "auto",
            backgroundColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            // a lib impõe um boxShadow próprio na web mesmo com sombra zerada
            ...(Platform.OS === "web" ? { boxShadow: "none" } : null),
          },
          // width auto + padding 0 por item: o indicador de 3px herda a
          // largura medida do rótulo, em vez de esticar por meia tela
          tabBarItemStyle: { width: "auto", paddingHorizontal: 0 },
          tabBarGap: spacing[6],
          tabBarLabelStyle: {
            fontFamily: "Roboto_700Bold",
            fontSize: 12,
            textTransform: "capitalize",
          },
        }}
      >
        <TopTab.Screen name={MARKET_TAB_ROUTES.moedas} component={Currencies} />
        <TopTab.Screen name={MARKET_TAB_ROUTES.indices} component={Indexes} />
      </TopTab.Navigator>
    </View>
  );
}

// Carteira e Extrato (Open Finance)
function FinanceTabs() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  // Mesmo teto do bloco de Mercado — ver comentário lá
  const capStyle = useContentCapStyle();
  return (
    <View className="flex-1 bg-background" style={capStyle}>
      <ScreenHeader title="Finanças" subtitle="Gestão de Patrimônio" />
      <TopTab.Navigator
        screenOptions={{
          // Mesmo gate do bloco de Mercado: com "reduzir movimento" ativo a
          // troca de aba é seca em todo o app
          swipeEnabled: true,
          animationEnabled: !reducedMotion,
          tabBarPressColor: "transparent",
          tabBarActiveTintColor: t.accent.neon,
          tabBarInactiveTintColor: t.text.tertiary,
          tabBarIndicatorStyle: { backgroundColor: t.accent.neon, height: 3 },
          // Mesmo tratamento do bloco de Mercado: grupo de abas centrado com
          // largura natural; centralizar só o conteúdo interno desalinharia o
          // indicador, que posiciona as abas a partir do x=0 da própria barra
          tabBarStyle: {
            alignSelf: "center",
            width: "auto",
            backgroundColor: "transparent",
            elevation: 0,
            shadowOpacity: 0,
            // a lib impõe um boxShadow próprio na web mesmo com sombra zerada
            ...(Platform.OS === "web" ? { boxShadow: "none" } : null),
          },
          // width auto + padding 0 por item: o indicador de 3px herda a
          // largura medida do rótulo, em vez de esticar por meia tela
          tabBarItemStyle: { width: "auto", paddingHorizontal: 0 },
          tabBarGap: spacing[6],
          tabBarLabelStyle: {
            fontFamily: "Roboto_700Bold",
            fontSize: 12,
            textTransform: "capitalize",
          },
        }}
      >
        <TopTab.Screen name={FINANCE_TAB_ROUTES.carteira} component={Wallet} />
        <TopTab.Screen name={FINANCE_TAB_ROUTES.extrato} component={BankIntegration} />
        {/* EC-097: o que se repete é a terceira leitura do mesmo dinheiro —
            Carteira responde "o que eu tenho", Extrato "o que aconteceu" e
            Recorrências "o que vai acontecer de novo". Os nomes das duas
            primeiras são contrato de navigate() e ficam intactos. */}
        <TopTab.Screen name={FINANCE_TAB_ROUTES.recorrencias} component={Recurrences} />
      </TopTab.Navigator>
    </View>
  );
}

// --- NAVEGAÇÃO PRINCIPAL (BOTTOM TABS) ---
function MainTabs() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // No desktop a navegação sai do rodapé e vira trilho lateral (montado na
  // raiz, ao lado do stack): é o que separa "site espremido no meio da tela"
  // de layout de computador. Aqui basta calar a barra — as duas nunca
  // aparecem juntas.
  const { isWide } = useBreakpoint();
  // Web entra junto do iOS: no iPhone, tanto no Safari quanto instalado na tela
  // de início, a barra de gestos come o rodapé e Platform.OS lá é "web". No
  // Android o respiro fixo continua valendo, e no desktop o inset é 0.
  const bottomInset =
    Platform.OS === "ios" || Platform.OS === "web" ? insets.bottom : 0;

  return (
    <BottomTab.Navigator
      initialRouteName={MAIN_TAB_ROUTES.principal}
      // Voltar (Android) leva à Home; o default "firstRoute" cairia em Finanças
      backBehavior="initialRoute"
      // No celular a barra padrão ganha um wrap com o indicador deslizante na
      // borda superior; no desktop quem navega é o trilho lateral, então a
      // barra não renderiza nada em vez de virar uma segunda navegação
      tabBar={isWide ? renderNoTabBar : renderTabBar}
      screenOptions={{
        // "shift" desliza + esmaece na troca de tab — mesma família de movimento
        // da entrada do assistente, no lugar do corte seco do fade
        animation: "shift",
        // Na web o React Navigation renderiza cada aba como <a href="/Main/...">
        // e o botão dele chama preventDefault no clique. Trocar por um
        // TouchableOpacity cru tirava esse preventDefault: o navegador seguia o
        // link, recarregava a página e o app voltava para a Home — as abas
        // Indicadores e Finanças ficavam inalcançáveis. O botão customizado
        // existe só para matar o feedback de opacidade, que não vale isso.
        tabBarButton:
          Platform.OS === "web"
            ? undefined
            : (props) => <TouchableOpacity {...(props as any)} activeOpacity={1} />,
        headerShown: false,
        tabBarActiveTintColor: t.accent.neon,
        tabBarInactiveTintColor: t.text.tertiary,
        // Quando o trilho assume, a barra não renderiza nada — todo o estilo
        // abaixo é do celular. A versão anterior desta tela mandava a MESMA
        // barra para a esquerda no desktop; virava uma segunda navegação, de
        // três destinos, encostada no trilho de doze.
        tabBarStyle: {
          backgroundColor: t.background.surface,
          // 84 dá folga para o ícone da Home (28, ~30 no pico do pop) +
          // rótulo dentro do `overflow: hidden` da barra. Com 70 o rótulo
          // era cortado sempre que não havia inset de barra de gestos
          height: BOTTOM_BAR_HEIGHT + bottomInset,
          paddingBottom: bottomInset > 0 ? bottomInset : 10,
          paddingTop: 8,
          // No dark, sombra é invisível — a borda superior faz a separação
          borderTopWidth: 1,
          borderTopColor: t.border.default,
          // Cantos superiores arredondados: o fundo do navigator (base) fica
          // visível atrás e a barra ganha a mesma geometria dos cards
          borderTopLeftRadius: radius["2xl"],
          borderTopRightRadius: radius["2xl"],
          overflow: "hidden",
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontFamily: "Roboto_700Bold",
          fontSize: 11,
          marginTop: 4,
        },
      }}
    >
      {/* Os `name` são contrato de navegação (várias telas fazem navigate()
          por eles); o que o usuário vê muda só pelo `title` */}
      <BottomTab.Screen
        name={MAIN_TAB_ROUTES.financas}
        component={FinanceTabs}
        options={{
          title: "Finanças",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon Icon={WalletTabIcon} focused={focused} size={26} />
          ),
        }}
      />
      <BottomTab.Screen
        name={MAIN_TAB_ROUTES.principal}
        component={Home}
        options={{
          title: "Início",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon Icon={House} focused={focused} size={28} />
          ),
        }}
      />
      <BottomTab.Screen
        name={MAIN_TAB_ROUTES.indicadores}
        component={IndicatorsTabs}
        options={{
          title: "Mercado",
          tabBarIcon: ({ focused }) => (
            <AnimatedTabIcon
              Icon={ChartCandlestick}
              focused={focused}
              size={26}
            />
          ),
        }}
      />
    </BottomTab.Navigator>
  );
}

// --- ROTAS DE AUTENTICAÇÃO ---
function AuthRoutes() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false, ...fadeTransition }}>
      <Stack.Screen name={AUTH_ROUTES.login} component={Login} />
      <Stack.Screen name={AUTH_ROUTES.register} component={Register} />
      <Stack.Screen name={AUTH_ROUTES.forgotPassword} component={ForgotPassword} />
      <Stack.Screen name={AUTH_ROUTES.resetPassword} component={ResetPassword} />
    </Stack.Navigator>
  );
}

// Paths nomeados só para o stack de auth: o e-mail de redefinição aponta para
// /reset-password?token=... e precisa cair direto na tela certa na web (o
// token de query string vira param da rota). As rotas autenticadas ficam de
// fora de propósito — um path sem match cai na rota inicial do navegador
// ativo, preservando o comportamento atual do app.
// Nomes de rota livres com params opcionais: o app nunca declarou o
// `ReactNavigation.RootParamList` global, e o container precisa da MESMA lista
// no `linking` e na ref — senão o TypeScript infere `{}` por um lado e o mapa
// de paths por outro, e os dois deixam de conversar.
type AppParamList = Record<string, object | undefined>;

const linking: LinkingOptions<AppParamList> = {
  prefixes: [ExpoLinking.createURL("/")],
  config: {
    screens: {
      [AUTH_ROUTES.login]: "login",
      [AUTH_ROUTES.register]: "register",
      [AUTH_ROUTES.forgotPassword]: "forgot-password",
      [AUTH_ROUTES.resetPassword]: "reset-password",
    },
  },
};

// Tema do container alinhado aos tokens: evita flashes brancos nas transições
// e pinta o fundo atrás dos cantos arredondados da tab bar. Vira função porque
// o tema muda em runtime — como constante de módulo o navegador ficava escuro
// por baixo das telas claras.
function buildNavigationTheme(t: Theme) {
  const base = t === lightTheme ? DefaultTheme : DarkTheme;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: t.accent.neon,
      background: t.background.base,
      card: t.background.surface,
      text: t.text.primary,
      border: t.border.default,
      notification: t.accent.neon,
    },
  };
}

// Pilha autenticada isolada num componente: a raiz agora monta trilho e
// miolo lado a lado, e deixar as 14 telas inline lá dentro empurrava tudo
// para a direita sem ganhar nada em clareza.
function AppStack() {
  return (
    <Stack.Navigator
      screenOptions={{ headerShown: false, ...slideRightTransition }}
    >
      <Stack.Screen name={APP_ROUTES.main} component={MainTabs} />
      <Stack.Screen
        name={APP_ROUTES.noticias}
        component={News}
        options={ephemeralTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.assistente}
        component={AiAssistant}
        options={modalLikeTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.sobre}
        component={About}
        options={modalLikeTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.perfil}
        component={Profile}
        options={ephemeralTransition}
      />
      {/* EC-104: "Settings" e "Conta" foram absorvidas pelo hub Profile;
          o que restou de avançado vive nesta rota */}
      <Stack.Screen
        name={APP_ROUTES.avancado}
        component={AdvancedOptions}
        options={ephemeralTransition}
      />
      {/* EC-107: chave própria de IA. Fica fora do trilho lateral de propósito
          — é ajuste de conta, não destino de navegação do dia a dia */}
      <Stack.Screen
        name={APP_ROUTES.opcoesIa}
        component={AiSettings}
        options={ephemeralTransition}
      />
      {/* EC-140/141: o desejo medido em horas de vida, e a renda/jornada que
          dão o valor da hora. São duas telas porque uma é o objetivo e a outra
          é o cadastro que o alimenta — mas a segunda só é alcançada pela
          primeira, quando falta o dado */}
      <Stack.Screen
        name={APP_ROUTES.desejos}
        component={Wishes}
        options={ephemeralTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.renda}
        component={IncomeSettings}
        options={ephemeralTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.relatorios}
        component={Reports}
        options={ephemeralTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.analise}
        component={Analytics}
        options={ephemeralTransition}
      />
      {/* EC-113: as faturas são um aprofundamento do Extrato, do mesmo jeito
          que Análise — pilha, com o cartão vindo por parâmetro quando o
          usuário chega pelo filtro de origem */}
      <Stack.Screen
        name={APP_ROUTES.cartoes}
        component={CreditCards}
        options={ephemeralTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.categorias}
        component={Categories}
        options={ephemeralTransition}
      />
      {/* EC-097: a projeção é um aprofundamento da aba Recorrências, do
          mesmo jeito que Análise aprofunda o Extrato — pilha, não aba */}
      <Stack.Screen
        name={APP_ROUTES.previsao}
        component={BalanceForecast}
        options={ephemeralTransition}
      />
      {/* Formulário entra de baixo (é uma tarefa, não um destino) e é tela
          de pilha porque o seletor de categoria já é um Modal próprio */}
      <Stack.Screen
        name={APP_ROUTES.agendamento}
        component={RecurrenceForm}
        options={modalLikeTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.revisao}
        component={StatementReview}
        options={modalLikeTransition}
      />
      <Stack.Screen
        name={APP_ROUTES.alterarSenha}
        component={ChangePassword}
        options={ephemeralTransition}
      />
    </Stack.Navigator>
  );
}

// --- ROOT NAVIGATOR ---
export default function Routes() {
  const t = useTheme();
  const token = useAuthStore((state) => state.token);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const navigationTheme = React.useMemo(() => buildNavigationTheme(t), [t]);
  // A decisão trilho × barra é do breakpoint, nunca do Platform.OS: um tablet
  // Android deitado ganha o mesmo trilho que o navegador de mesa
  const { isWide } = useBreakpoint();
  const navigationRef = useNavigationContainerRef<AppParamList>();
  // Guarda a CHAVE do trilho, não o nome da rota: telas de tarefa (revisar,
  // agendar, trocar senha) não têm destino próprio e precisam do item que
  // estava aceso antes delas — é o que mantém a pílula em "Início" quando a
  // revisão foi aberta pelo card da Home
  const [activeKey, setActiveKey] = React.useState<RailKey | undefined>();

  // O trilho vive FORA do navigator (é layout, não navegação), então não tem
  // como ler a rota por hook — quem responde é o container, a cada troca
  const syncActiveRoute = React.useCallback(() => {
    const routeName = navigationRef.getCurrentRoute()?.name;
    setActiveKey((previous) => railKeyForRoute(routeName, previous));
  }, [navigationRef]);

  const handleRailNavigate = React.useCallback(
    (destination: RailDestination) => {
      // Aba do container de baixo exige navegação aninhada; tela de pilha vai
      // direto. Os nomes vêm do mapa de destinos e são os MESMOS que todo
      // navigate() já espalhado pelas telas usa.
      if (destination.inMainTabs) {
        navigationRef.navigate("Main", { screen: destination.route });
        return;
      }
      navigationRef.navigate(destination.route);
    },
    [navigationRef],
  );

  // Sem esperar a hidratação, o token persistido ainda não existe e o
  // cold start piscava a tela de Login antes de cair na Home
  if (!hasHydrated) {
    return (
      <View className="flex-1" style={{ backgroundColor: t.background.base }} />
    );
  }

  // Login e cadastro nunca ganham trilho: sem sessão não há destino para onde
  // ir, e a tela de auth é uma coluna centrada de propósito
  const showRail = Boolean(token) && isWide;

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      linking={linking}
      onReady={syncActiveRoute}
      onStateChange={syncActiveRoute}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          backgroundColor: t.background.base,
        }}
      >
        {showRail && (
          <SideRail activeKey={activeKey} onNavigate={handleRailNavigate} />
        )}
        {/* O miolo é quem estica: o trilho tem largura fixa e não encolhe */}
        <View style={{ flex: 1 }}>
          {token ? <AppStack /> : <AuthRoutes />}
        </View>
      </View>
    </NavigationContainer>
  );
}
