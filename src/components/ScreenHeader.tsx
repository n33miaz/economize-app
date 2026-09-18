import React from "react";
import { View, TouchableOpacity } from "react-native";
import ChevronLeft from "lucide-react-native/dist/esm/icons/chevron-left";
import User from "lucide-react-native/dist/esm/icons/user";
import { useNavigation } from "@react-navigation/native";
import Constants from "expo-constants";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useBreakpoint } from "../hooks/useBreakpoint";
import { useTabBarStore } from "../store/tabBarStore";
import { useTheme } from "../theme/ThemeProvider";
import { motion, spacing, radius } from "../theme/ds";
import { selectionEasing } from "../theme/motionPresets";

/**
 * O CABEÇALHO CONDENSA AO ROLAR — a metade da escolha 5 que faltava.
 *
 * <p>O dono escolheu em 16/09 a variante <i>"sem fio: separação por respiro e
 * tinta"</i>, e ela tem duas partes. A primeira (tirar as molduras) saiu no
 * mesmo dia. A segunda é esta: <i>"no celular, o header condensa ao rolar: o
 * título de 28 px encolhe para 18 e vira uma barra fina com sombra, liberando
 * altura"</i>.
 *
 * <p><b>Por que importa ter número.</b> O alvo declarado é o Safari de um
 * iPhone 12, onde sobram <b>664 px</b> de altura útil. Aberto, este cabeçalho
 * come 47 (status bar) + 20 + 34 (título) + 15 (legenda) + 16 = <b>132 px</b>,
 * 20% do que a pessoa vê sem rolar — gastos com o nome de uma tela que ela
 * acabou de escolher. Condensado ele fica em 47 + 8 + 24 + 8 = 87.
 *
 * <p><b>O sinal é o mesmo da ilha e do segmentado</b> (`tabBarStore`): rolar
 * para baixo esconde, para cima traz de volta, com a histerese de 12 px que
 * impede o tremor. Um segundo mecanismo de rolagem só para o cabeçalho seria
 * outro relógio para desandar.
 */

/** Altura reservada para a legenda quando ela existe. */
const SUBTITULO_ALTURA = 15;

/** Respiro acima do título, aberto e condensado. */
const TOPO_ABERTO = spacing[5];
const TOPO_CONDENSADO = spacing[2];

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  rightActions?: React.ReactNode[];
  showProfileButton?: boolean;
  /**
   * Seta de voltar à esquerda do título. Sem valor, aparece sozinha nas
   * telas EMPILHADAS (pilha com histórico) e nunca nas raízes das abas.
   * Existe por causa da web: no celular há o botão do sistema e o gesto de
   * borda; no navegador uma tela empilhada sem seta é beco sem saída — a
   * barra de abas fica coberta e nada na interface diz como voltar.
   */
  showBackButton?: boolean;
  /**
   * Telas apresentadas como modal já nascem abaixo da status bar; somar o
   * statusBarHeight nelas cria uma faixa morta no topo (iOS). Passe false
   * nesses casos para usar só o respiro padrão.
   */
  topInset?: boolean;
}

export default function ScreenHeader({
  title,
  subtitle,
  rightActions,
  showProfileButton = true,
  showBackButton,
  topInset = true,
}: ScreenHeaderProps) {
  const t = useTheme();
  const navigation = useNavigation();
  // Home, Finanças e Mercado vivem dentro do navegador de abas: para elas
  // `getState()` é o estado da aba, não da pilha, e a seta não aparece
  const navState = navigation.getState();
  const isPushed = navState?.type === "stack" && navigation.canGoBack();
  const showBack = showBackButton ?? isPushed;

  // Condensar é coisa de telefone: no desktop o cabeçalho divide a tela com o
  // trilho lateral e não há altura escassa para devolver
  const { isPhone } = useBreakpoint();
  const reducedMotion = useReducedMotion();
  const escondida = useTabBarStore((s) => s.escondida);
  const condensado = isPhone && escondida;

  const progresso = useSharedValue(0);
  const jaMontou = React.useRef(false);
  React.useEffect(() => {
    const alvo = condensado ? 1 : 0;
    // Primeira montagem não é trajeto: o cabeçalho apenas ESTÁ no estado
    // certo. Mesmo princípio da ilha de baixo e do segmentado do topo
    if (!jaMontou.current) {
      jaMontou.current = true;
      progresso.value = alvo;
      return;
    }
    progresso.value = reducedMotion
      ? alvo
      : withTiming(alvo, {
          duration: motion.duration.fast,
          easing: selectionEasing,
        });
  }, [condensado, reducedMotion, progresso]);

  const respiroDoTopo = topInset ? Constants.statusBarHeight : 0;

  const estiloBarra = useAnimatedStyle(() => ({
    paddingTop:
      respiroDoTopo +
      interpolate(progresso.value, [0, 1], [TOPO_ABERTO, TOPO_CONDENSADO]),
    paddingBottom: interpolate(
      progresso.value,
      [0, 1],
      [spacing[4], spacing[2]],
    ),
    // A sombra nasce com o condensado: é o que separa a barra fina do conteúdo
    // que passa por baixo dela, agora que não há mais fio nem cartucho.
    // `shadowOpacity` e `elevation` na mesma regra — cada plataforma usa a sua
    shadowOpacity: interpolate(progresso.value, [0, 1], [0, 0.18]),
    elevation: interpolate(progresso.value, [0, 1], [0, 4]),
  }));

  const estiloTitulo = useAnimatedStyle(() => ({
    fontSize: interpolate(progresso.value, [0, 1], [28, 18]),
    lineHeight: interpolate(progresso.value, [0, 1], [34, 24]),
  }));

  const estiloSubtitulo = useAnimatedStyle(() => ({
    height: interpolate(progresso.value, [0, 1], [SUBTITULO_ALTURA, 0]),
    opacity: interpolate(progresso.value, [0, 1], [1, 0]),
    marginTop: interpolate(progresso.value, [0, 1], [2, 0]),
  }));

  return (
    <Animated.View
      // SEM cartucho e SEM linha embaixo. O cabeçalho era uma superfície
      // `surface` com borda inferior E cantos inferiores arredondados — três
      // molduras para o mesmo elemento, e o resultado era uma barra que
      // parecia colada por cima da tela. Foi o que o dono apontou em 15/09:
      // "não parece muito moderno essas bordas".
      //
      // Agora ele usa o fundo da PÁGINA e a hierarquia vem só da tipografia,
      // que é como cabeçalho grande funciona no iOS e no Material 3: o título
      // é o maior texto da tela, e nada precisa desenhar uma caixa em volta
      // dele para provar isso. A separação do conteúdo é o próprio respiro.
      style={[
        {
          backgroundColor: t.background.base,
          paddingHorizontal: spacing[5],
          // Estáticos: só a opacidade da sombra é animada, senão cada quadro
          // recalcularia o desenho dela
          shadowColor: "#000",
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
          // A barra tem de ficar POR CIMA do conteúdo que ela deixa passar
          zIndex: 1,
        },
        estiloBarra,
      ]}
    >
      {/* NÃO existe mais botão de informação aqui. Ele aparecia em QUASE TODA
          tela — um "i" repetido em cima de cada cabeçalho, disputando espaço
          com o título — e apontava para a rota "Sobre", que tinha sido tirada
          da navegação num pedido anterior: era um botão que já não levava a
          lugar nenhum. O dono pediu para tirar todos; este era a fábrica
          deles.

          NÃO declarar StatusBar aqui. Este cabeçalho aparece em quase toda
          tela, e a barra de status é GLOBAL: a declaração daqui sobrescrevia a
          do App.tsx, que é a que segue o tema. Com `light-content` fixo os
          ícones do sistema ficavam brancos -- certo no escuro por acidente, e
          ilegível no modo claro, que é fundo claro com ícone branco.
          Quem manda na barra é o App.tsx, e é um lugar só. */}

      <View className="flex-row items-center justify-between">
        {showBack && (
          <TouchableOpacity
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
            className="bg-elevated active:bg-border"
            style={{
              width: 36,
              height: 36,
              borderRadius: radius.full,
              alignItems: "center",
              justifyContent: "center",
              marginRight: spacing[3],
            }}
            onPress={() => navigation.goBack()}
          >
            <ChevronLeft size={20} color={t.text.primary} />
          </TouchableOpacity>
        )}
        <View className="flex-1 mr-4">
          {/* Sem `className` nos dois animados: a cor e o espaçamento entram
              no estilo. Misturar o css-interop com estilo animado no mesmo nó
              é onde esta pilha já quebrou antes */}
          <Animated.Text
            // 28 aberto, 18 condensado. Com o cartucho fora, é a tipografia
            // que faz a hierarquia — e é ela que devolve altura ao rolar
            style={[
              {
                color: t.text.primary,
                fontWeight: "700",
                letterSpacing: -0.4,
              },
              estiloTitulo,
            ]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {title}
          </Animated.Text>
          {subtitle && (
            <Animated.Text
              style={[
                { color: t.text.secondary, fontSize: 13, fontWeight: "500" },
                estiloSubtitulo,
              ]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {subtitle}
            </Animated.Text>
          )}
        </View>

        <View className="flex-row items-center" style={{ gap: spacing[2] }}>
          {rightActions?.map((action, idx) => (
            <React.Fragment key={idx}>{action}</React.Fragment>
          ))}

          {showProfileButton && (
            <TouchableOpacity
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityLabel="Perfil"
              accessibilityRole="button"
              className="bg-elevated active:bg-border"
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={() => navigation.navigate("Profile" as never)}
            >
              <User size={18} color={t.text.primary} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}
