import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  Linking,
  PanResponder,
  Platform,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from "react-native";
import ChevronLeft from "lucide-react-native/dist/esm/icons/chevron-left";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Settings from "lucide-react-native/dist/esm/icons/settings";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type EntryExitAnimationFunction,
} from "react-native-reanimated";

import * as Haptics from "../utils/haptics";
import api, { type NewsArticle } from "../services/api";
import { useTheme } from "../theme/ThemeProvider";
import { motion, radius, spacing } from "../theme/ds";
import { softEasing } from "../theme/motionPresets";
import { usePreferencesStore } from "../store/preferencesStore";
import {
  TICKER_PAUSE_MS,
  TICKER_REFRESH_MS,
  TICKER_ROTATE_MS,
  buildTickerParams,
  createAutoAdvance,
  indexAfterRefresh,
  prepareTickerArticles,
  relativeTimeLabel,
  wrapIndex,
} from "../utils/newsTicker";
import Skeleton from "./Skeleton";
import MarketNewsSettingsSheet from "./MarketNewsSettingsSheet";

// Altura fixa: o carrossel troca de conteúdo o tempo todo e não pode bombear
// o layout das abas logo abaixo a cada manchete de tamanho diferente
const TICKER_HEIGHT = 80;

// Fração da largura (ou velocidade) que confirma a troca no arrasto — abaixo
// disso o slide volta para o lugar
const SWIPE_COMMIT_RATIO = 0.25;
const SWIPE_COMMIT_VELOCITY = 0.5;

// Granularidade do "há X min": um tick por minuto mantém o rótulo honesto
// mesmo quando o slide não troca (uma notícia só, leitor de tela ativo)
const CLOCK_TICK_MS = 60_000;

// O sinal de leitor de tela só é confiável no nativo: o react-native-web
// devolve `true` incondicional em isScreenReaderEnabled (o navegador não
// expõe essa informação), e usá-lo mataria a rotação em toda a web
const SCREEN_READER_SIGNAL_TRUSTED = Platform.OS !== "web";

// O RNW encaminha eventos de mouse para o DOM, mas os types do react-native
// não os declaram — tipo local estreito em vez de `any`, sem efeito no nativo
type MouseHoverProps = { onMouseEnter?: () => void };

/**
 * Carrossel "notícias do momento" do topo do Mercado: um card compacto com
 * uma notícia por vez, avanço automático a cada 20s, arrasto manual infinito
 * nos dois sentidos (índice circular por módulo) e botões anterior/próximo —
 * o caminho alcançável por leitor de tela e por mouse na web, já que o gesto
 * de arrasto não é. Sem notícia: com filtro ativo, um estado vazio com CTA de
 * limpar o recorte; sem filtro, o componente não ocupa espaço.
 */
export default function MarketNewsTicker() {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  const focused = useIsFocused();

  const region = usePreferencesStore((s) => s.newsRegion);
  const category = usePreferencesStore((s) => s.newsCategory);
  const setNewsRegion = usePreferencesStore((s) => s.setNewsRegion);
  const setNewsCategory = usePreferencesStore((s) => s.setNewsCategory);

  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const [screenReaderOn, setScreenReaderOn] = useState(false);
  const [clock, setClock] = useState(() => Date.now());

  // Espelhos para callbacks estáveis (PanResponder, piloto automático):
  // recriar os handlers a cada render quebraria o gesto no meio do arrasto
  const articlesRef = useRef(articles);
  const indexRef = useRef(index);
  const widthRef = useRef(width);
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => {
    articlesRef.current = articles;
    indexRef.current = index;
    widthRef.current = width;
    reducedMotionRef.current = reducedMotion;
  });

  // Direção e ponto de partida do slide que sai, lidos dentro dos worklets de
  // entrada/saída no instante da troca — prop capturada no render ficaria um
  // gesto atrasada quando o usuário inverte o sentido do arrasto
  const dirSv = useSharedValue(1);
  const exitFromSv = useSharedValue(0);
  // Deslocamento do dedo durante o arrasto (camada interna do slide)
  const dragSv = useSharedValue(0);

  // Duas trocas rápidas de filtro disparam duas buscas: só a mais recente
  // pode escrever no estado, senão a resposta atrasada atropela a atual
  const fetchSeqRef = useRef(0);

  const fetchTicker = useCallback(
    async (isRefresh: boolean) => {
      const seq = ++fetchSeqRef.current;
      try {
        if (!isRefresh) setLoading(true);
        const response = await api.get<{ articles: NewsArticle[] }>(
          "/news/top-headlines",
          { params: buildTickerParams(region, category) },
        );
        if (seq !== fetchSeqRef.current) return;
        const list = prepareTickerArticles(response.data.articles);
        const currentUrl =
          articlesRef.current[indexRef.current]?.url ?? null;
        setArticles(list);
        // Renovação silenciosa segue a notícia em tela; troca de filtro é um
        // recorte novo e recomeça do topo
        setIndex(
          isRefresh ? indexAfterRefresh(list, currentUrl, indexRef.current) : 0,
        );
      } catch {
        if (seq !== fetchSeqRef.current) return;
        // Refresh que falha preserva a lista atual — melhor notícia velha do
        // que um carrossel que some no meio do uso. Erro na busca inicial
        // esvazia a lista e cai nos estados vazios do render.
        if (!isRefresh) setArticles([]);
      } finally {
        if (seq === fetchSeqRef.current) setLoading(false);
      }
    },
    [region, category],
  );

  // Busca inicial e a cada troca de filtro
  useEffect(() => {
    fetchTicker(false);
  }, [fetchTicker]);

  // Renovação de 10 min só com a tela em foco: as tabs ficam montadas depois
  // da primeira visita, e sem o gate o app buscava notícias para sempre
  // mesmo com o usuário na Home. O relógio reinicia no refoco — atraso de até
  // uma janela é preferível a uma busca a cada volta à tela.
  useEffect(() => {
    if (!focused) return;
    const refreshTimer = setInterval(() => {
      fetchTicker(true);
    }, TICKER_REFRESH_MS);
    return () => clearInterval(refreshTimer);
  }, [focused, fetchTicker]);

  // Tick por minuto do rótulo de tempo relativo, também gated pelo foco:
  // sem ele, "há 5 min" congelava sempre que o slide não trocava
  useEffect(() => {
    if (!focused) return;
    setClock(Date.now());
    const clockTimer = setInterval(() => setClock(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(clockTimer);
  }, [focused]);

  // Com leitor de tela ativo o carrossel não anda sozinho: a troca automática
  // desmontaria o nó em foco e derrubaria a leitura no meio da frase. Na web
  // o sinal é inutilizável (sempre `true` no RNW), então lá a rotação fica
  // ligada e quem protege o leitor de tela são os botões anterior/próximo e
  // a pausa por interação/hover.
  useEffect(() => {
    if (!SCREEN_READER_SIGNAL_TRUSTED) return;
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderOn(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderOn,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const commit = useCallback(
    (direction: 1 | -1, fromDrag: number) => {
      dirSv.value = direction;
      exitFromSv.value = fromDrag;
      // O slide que entra nasce sem resíduo do arrasto; o que sai já capturou
      // o deslocamento em exitFromSv, então o net dele não salta
      dragSv.value = 0;
      setIndex((prev) => wrapIndex(prev + direction, articlesRef.current.length));
    },
    [dirSv, exitFromSv, dragSv],
  );

  // O piloto chama sempre a versão mais recente do avanço via ref — o
  // controller é um só pela vida do componente, e o estado `running` interno
  // garante que pause() vindo de um gesto tardio não religa o que o cleanup
  // do effect já desligou
  const advanceRef = useRef<() => void>(() => {});
  useEffect(() => {
    advanceRef.current = () => {
      if (articlesRef.current.length > 1) commit(1, 0);
    };
  }, [commit]);

  const autopilot = useMemo(
    () =>
      createAutoAdvance(() => advanceRef.current(), {
        rotateMs: TICKER_ROTATE_MS,
        pauseMs: TICKER_PAUSE_MS,
      }),
    [],
  );

  const count = articles.length;
  useEffect(() => {
    if (!focused || screenReaderOn || count < 2) return;
    autopilot.start();
    return () => autopilot.stop();
  }, [focused, screenReaderOn, count, autopilot]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Só arrasto claramente horizontal vira gesto do carrossel; o toque
        // simples continua chegando ao Touchable de abrir a notícia
        onMoveShouldSetPanResponder: (_evt, gesture) =>
          articlesRef.current.length > 1 &&
          Math.abs(gesture.dx) > 12 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderGrant: () => {
          // Dedo na tela = usuário lendo: o avanço automático espera
          autopilot.pause();
        },
        onPanResponderMove: (_evt, gesture) => {
          if (!reducedMotionRef.current) dragSv.value = gesture.dx;
        },
        onPanResponderRelease: (_evt, gesture) => {
          autopilot.pause();
          const trackWidth = widthRef.current || 1;
          const shouldCommit =
            Math.abs(gesture.dx) > trackWidth * SWIPE_COMMIT_RATIO ||
            Math.abs(gesture.vx) > SWIPE_COMMIT_VELOCITY;
          if (shouldCommit && articlesRef.current.length > 1) {
            Haptics.selectionAsync();
            commit(
              gesture.dx < 0 ? 1 : -1,
              reducedMotionRef.current ? 0 : gesture.dx,
            );
          } else {
            dragSv.value = withTiming(0, {
              duration: motion.duration.fast,
              easing: softEasing,
            });
          }
        },
        onPanResponderTerminate: () => {
          dragSv.value = withTiming(0, {
            duration: motion.duration.fast,
            easing: softEasing,
          });
        },
      }),
    [autopilot, commit, dragSv],
  );

  const dragStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragSv.value }],
  }));

  // Entrada/saída via entering/exiting do Reanimated: o framework aplica os
  // valores iniciais antes do primeiro frame, então a troca de slide não
  // pisca — coisa que um reset manual de translateX não garante. Na web o
  // Reanimated não suporta worklet customizado de entrada/saída (só presets):
  // sem o gate, cada troca logava um warning e não animava mesmo — a troca
  // seca é o comportamento aceito por lá.
  const slideEntering = useMemo(() => {
    if (Platform.OS === "web" || reducedMotion || width === 0) return undefined;
    const entering: EntryExitAnimationFunction = () => {
      "worklet";
      return {
        initialValues: {
          opacity: 0,
          transform: [{ translateX: dirSv.value * width }],
        },
        animations: {
          opacity: withTiming(1, {
            duration: motion.duration.base,
            easing: softEasing,
          }),
          transform: [
            {
              translateX: withTiming(0, {
                duration: motion.duration.base,
                easing: softEasing,
              }),
            },
          ],
        },
      };
    };
    return entering;
  }, [reducedMotion, width, dirSv]);

  const slideExiting = useMemo(() => {
    if (Platform.OS === "web" || reducedMotion || width === 0) return undefined;
    const exiting: EntryExitAnimationFunction = () => {
      "worklet";
      return {
        initialValues: {
          opacity: 1,
          transform: [{ translateX: exitFromSv.value }],
        },
        animations: {
          opacity: withTiming(0, {
            duration: motion.duration.base,
            easing: softEasing,
          }),
          transform: [
            {
              translateX: withTiming(-dirSv.value * width, {
                duration: motion.duration.base,
                easing: softEasing,
              }),
            },
          ],
        },
      };
    };
    return exiting;
  }, [reducedMotion, width, dirSv, exitFromSv]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  const article = articles[wrapIndex(index, count)];
  const articleUrl = article?.url;

  const openArticle = useCallback(async () => {
    if (!articleUrl) return;
    const supported = await Linking.canOpenURL(articleUrl);
    if (supported) await Linking.openURL(articleUrl);
  }, [articleUrl]);

  const openSettings = useCallback(() => {
    Haptics.selectionAsync();
    setSettingsVisible(true);
  }, []);

  // Botões anterior/próximo: mesma semântica do arrasto (pausa de leitura e
  // troca), mas alcançável por leitor de tela e por clique na web
  const step = useCallback(
    (direction: 1 | -1) => {
      if (articlesRef.current.length < 2) return;
      Haptics.selectionAsync();
      autopilot.pause();
      commit(direction, 0);
    },
    [autopilot, commit],
  );

  const clearFilters = useCallback(() => {
    Haptics.selectionAsync();
    setNewsRegion("all");
    setNewsCategory("all");
  }, [setNewsRegion, setNewsCategory]);

  // Mouse sobre o card = usuário lendo: mesma janela de pausa do dedo (30s a
  // partir do hover), em vez de pausa indefinida — mantém o produto coerente
  // entre plataformas. pause() é inofensivo com o piloto parado.
  const webHoverProps: MouseHoverProps =
    Platform.OS === "web" ? { onMouseEnter: () => autopilot.pause() } : {};

  const cardStyle = {
    height: TICKER_HEIGHT,
    // Mesmo raio dos cards de notícia da Home: objeto igual, geometria igual
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: t.border.default,
    backgroundColor: t.background.surface,
    overflow: "hidden" as const,
  };

  const containerStyle = {
    marginHorizontal: spacing[5],
    marginTop: spacing[4],
    marginBottom: spacing[2],
  };

  // O sheet vive em todos os ramos do render: uma resposta vazia no meio de
  // uma escolha de filtro não pode desmontar o modal na mão do usuário
  const sheet = (
    <MarketNewsSettingsSheet
      visible={settingsVisible}
      onClose={() => setSettingsVisible(false)}
    />
  );

  const gearButton = (
    <TouchableOpacity
      onPress={openSettings}
      accessibilityLabel="Configurar notícias do momento"
      accessibilityRole="button"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        width: 28,
        height: 28,
        borderRadius: radius.full,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Settings size={14} color={t.text.tertiary} />
    </TouchableOpacity>
  );

  // Primeiro load: esqueleto com a geometria do card (meta + duas linhas de
  // manchete) para a lista de abas não saltar quando a notícia chegar
  if (loading && count === 0) {
    return (
      <View style={containerStyle}>
        <View
          style={[cardStyle, { paddingHorizontal: spacing[4], justifyContent: "center" }]}
        >
          <Skeleton width={112} height={10} className="mb-2" />
          <Skeleton width="92%" height={13} className="mb-1.5" />
          <Skeleton width="64%" height={13} />
        </View>
        {sheet}
      </View>
    );
  }

  const hasActiveFilter = region !== "all" || category !== "all";

  if (count === 0) {
    // Sem filtro não há CTA que resolva (erro de rede ou feed vazio): o
    // Mercado segue sem a faixa. Só o sheet permanece montado — invisível
    // quando fechado — para não sumir no meio de uma escolha.
    if (!hasActiveFilter) return sheet;

    // Recorte que não devolve nada é beco sem saída se o card sumir junto
    // com a engrenagem (a preferência é persistida): estado vazio com CTA
    // de limpar o filtro, na mesma geometria para o layout não saltar
    return (
      <View style={containerStyle}>
        <View
          style={[
            cardStyle,
            {
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: spacing[4],
              gap: spacing[3],
            },
          ]}
        >
          <Text
            className="text-xs"
            style={{ flex: 1, color: t.text.secondary, lineHeight: 17 }}
            numberOfLines={3}
          >
            Sem manchetes para esse recorte agora.
          </Text>
          <TouchableOpacity
            onPress={clearFilters}
            accessibilityLabel="Limpar filtro de notícias"
            accessibilityRole="button"
            activeOpacity={0.8}
            style={{
              minHeight: 32,
              paddingHorizontal: spacing[3],
              borderRadius: radius.full,
              borderWidth: 1,
              borderColor: t.accent.neon,
              backgroundColor: t.accent.neonMuted,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              className="text-xs font-bold"
              style={{ color: t.accent.neon }}
            >
              Limpar filtro
            </Text>
          </TouchableOpacity>
          {gearButton}
        </View>
        {sheet}
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <View
        {...panResponder.panHandlers}
        {...webHoverProps}
        onLayout={handleLayout}
        // Busca em andamento com lista antiga em tela (troca de filtro):
        // o card esmaece para dizer "atualizando" sem saltar o layout
        style={[cardStyle, { opacity: loading ? 0.55 : 1 }]}
      >
        <Animated.View
          // A URL é a identidade do slide: a renovação de 10 min que mantém a
          // notícia em tela não remonta (nem anima) o card
          key={article.url}
          entering={slideEntering}
          exiting={slideExiting}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        >
          <Animated.View style={[dragStyle, { flex: 1 }]}>
            <TouchableOpacity
              onPress={openArticle}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Notícia ${wrapIndex(index, count) + 1} de ${count}: ${article.title}`}
              accessibilityHint="Abre a notícia no navegador"
              style={{
                flex: 1,
                paddingHorizontal: spacing[4],
                justifyContent: "center",
              }}
            >
              <View
                className="flex-row items-center"
                // Respiro à direita para a manchete e a meta não correrem por
                // baixo da engrenagem
                style={{ marginBottom: spacing[1], paddingRight: spacing[8] }}
              >
                <Text
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: t.accent.neon }}
                  numberOfLines={1}
                >
                  {article.source.name}
                </Text>
                <Text
                  className="text-[10px]"
                  style={{ color: t.text.tertiary, marginLeft: spacing[2] }}
                  numberOfLines={1}
                >
                  {relativeTimeLabel(article.publishedAt, clock)}
                </Text>
              </View>
              <Text
                className="text-[13px] font-bold"
                // A margem direita reserva o canto dos botões de navegação:
                // sem ela a segunda linha da manchete corria por baixo deles
                style={{
                  color: t.text.primary,
                  lineHeight: 18,
                  marginRight: count > 1 ? spacing[12] : 0,
                }}
                numberOfLines={2}
              >
                {article.title}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.View>

        {/* Fora do slide: a engrenagem fica parada enquanto as notícias deslizam */}
        <View
          style={{ position: "absolute", top: spacing[2], right: spacing[2] }}
        >
          {gearButton}
        </View>

        {/* Anterior/próximo: o caminho de navegação para leitor de tela (o
            arrasto não é alcançável por TalkBack/VoiceOver) e para o mouse */}
        {count > 1 && (
          <View
            style={{
              position: "absolute",
              bottom: spacing[2],
              right: spacing[2],
              flexDirection: "row",
              gap: spacing[1],
            }}
          >
            <TouchableOpacity
              onPress={() => step(-1)}
              accessibilityLabel="Notícia anterior"
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.full,
                backgroundColor: t.background.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronLeft size={15} color={t.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => step(1)}
              accessibilityLabel="Próxima notícia"
              accessibilityRole="button"
              hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              activeOpacity={0.7}
              style={{
                width: 26,
                height: 26,
                borderRadius: radius.full,
                backgroundColor: t.background.elevated,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ChevronRight size={15} color={t.text.secondary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {sheet}
    </View>
  );
}
