import React from "react";
import { Image, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useTheme } from "../theme/ThemeProvider";
import { motion, radius, spacing } from "../theme/ds";
import { softEasing } from "../theme/motionPresets";
import { SIDE_RAIL_WIDTH } from "../hooks/useBreakpoint";
import AnimatedTabIcon from "./AnimatedTabIcon";
import {
  RAIL_GROUPS,
  type RailDestination,
  type RailKey,
} from "./railDestinations";

// Alvo de toque mínimo é 44; 46 dá o mesmo respiro visual dos chips do app
const ITEM_HEIGHT = 46;
// Mesma espessura do indicador da barra inferior e das abas de Moedas/Índices:
// os três traços accent do app são a mesma linguagem
const INDICATOR_WIDTH = 3;
// Recuo do traço nas pontas do item — vira um tique curto, não uma régua
const INDICATOR_INSET = 11;

interface SideRailProps {
  /** Destino ativo, derivado da rota-folha do container de navegação. */
  activeKey?: RailKey;
  onNavigate: (destination: RailDestination) => void;
}

interface RowMetrics {
  y: number;
  height: number;
}

/**
 * Trilho lateral do desktop: substitui a barra inferior a partir de 1024 px.
 *
 * É composição de layout, não navegador — vive ao lado do stack raiz e por
 * isso continua na tela em TODAS as telas autenticadas, inclusive nas que a
 * barra inferior nunca alcançou (Análise, Relatórios, Previsão...). A pílula
 * ativa e o traço deslizante são os mesmos da `TabBarWithIndicator`, virados
 * de lado.
 */
export default function SideRail({ activeKey, onNavigate }: SideRailProps) {
  const t = useTheme();
  const reducedMotion = useReducedMotion();
  // O trilho é irmão do stack, não filho dele: nenhum cabeçalho desconta o
  // inset por ele. Num tablet deitado com recorte de câmera, o logo nasceria
  // debaixo do entalhe — no navegador de mesa os dois valores são 0.
  const insets = useSafeAreaInsets();
  const [rows, setRows] = React.useState<Record<string, RowMetrics>>({});

  const measureRow = React.useCallback(
    (key: RailKey, y: number, height: number) => {
      setRows((prev) => {
        const current = prev[key];
        if (current && current.y === y && current.height === height) {
          return prev;
        }
        return { ...prev, [key]: { y, height } };
      });
    },
    [],
  );

  const activeRow = activeKey ? rows[activeKey] : undefined;
  // Anima a posição medida, não um índice: os grupos têm títulos no meio, então
  // não existe passo constante entre um item e o seguinte
  const offsetY = useSharedValue(-1);

  React.useEffect(() => {
    if (!activeRow) return;
    const target = activeRow.y + INDICATOR_INSET;
    // Primeira medição (ou movimento reduzido): o traço já nasce no lugar,
    // sem deslizar do topo até o item ativo
    if (offsetY.value < 0 || reducedMotion) {
      offsetY.value = target;
      return;
    }
    offsetY.value = withTiming(target, {
      duration: motion.duration.base,
      easing: softEasing,
    });
  }, [activeRow, reducedMotion, offsetY]);

  const slideStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: offsetY.value }],
  }));

  return (
    <View
      // `role` e não `accessibilityRole`: "navigation" não existe na lista de
      // papéis nativos, e é justamente ele que o react-native-web precisa —
      // sai um <nav> de verdade, o landmark que o leitor de tela usa para
      // pular direto para a navegação. O "toolbar" que estava aqui não é
      // landmark nenhum e ainda prometia um comportamento de teclado (um só
      // ponto de tabulação, troca por setas) que este trilho não tem: aqui
      // cada destino é um alvo de tabulação, como num menu de site.
      role="navigation"
      accessibilityLabel="Navegação principal"
      style={{
        width: SIDE_RAIL_WIDTH + insets.left,
        paddingLeft: insets.left,
        backgroundColor: t.background.surface,
        // Trilho lateral separa por borda à direita, não em cima
        borderRightWidth: 1,
        borderRightColor: t.border.default,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing[3],
          paddingHorizontal: spacing[5],
          paddingTop: insets.top + spacing[6],
          paddingBottom: spacing[5],
        }}
      >
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.lg,
            backgroundColor: t.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <Image
            // Mesmo arquivo do Login (o de 2048² tem 6 MB); dimensão em style
            // porque o NativeWind não aplica largura/altura em <Image> na web
            source={require("../../assets/logo-512.png")}
            style={{ width: 24, height: 24 }}
            resizeMode="contain"
          />
        </View>
        <Text
          style={{
            color: t.text.primary,
            fontFamily: "Roboto_700Bold",
            fontSize: 18,
            letterSpacing: -0.3,
          }}
        >
          Economize!
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing[3],
          paddingBottom: spacing[6],
        }}
      >
        {/* Caixa própria para os itens: é dela que sai o `y` medido de cada um,
            e é nela que o traço se posiciona — sem isso o zero do traço e o
            zero das medidas seriam caixas diferentes */}
        <View>
          {/* Traço fora dos itens: fica no vão entre a borda do trilho e a
              pílula, e rola junto com a lista, como o indicador da barra */}
          {activeRow && (
            <Animated.View
              style={[
                {
                  position: "absolute",
                  left: -spacing[1],
                  top: 0,
                  width: INDICATOR_WIDTH,
                  height: Math.max(0, activeRow.height - INDICATOR_INSET * 2),
                  borderRadius: radius.full,
                  backgroundColor: t.accent.neon,
                  pointerEvents: "none",
                },
                slideStyle,
              ]}
            />
          )}

          {RAIL_GROUPS.map((group, groupIndex) => (
            <React.Fragment key={group.title ?? "principal"}>
              {group.title && (
                <Text
                  style={{
                    color: t.text.tertiary,
                    fontFamily: "Roboto_700Bold",
                    fontSize: 11,
                    letterSpacing: 1,
                    textTransform: "uppercase",
                    paddingHorizontal: spacing[4],
                    marginTop: groupIndex === 0 ? 0 : spacing[6],
                    marginBottom: spacing[2],
                  }}
                >
                  {group.title}
                </Text>
              )}
              {group.items.map((item) => (
                <RailItem
                  key={item.key}
                  item={item}
                  focused={item.key === activeKey}
                  onMeasure={measureRow}
                  onPress={() => onNavigate(item)}
                />
              ))}
            </React.Fragment>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function RailItem({
  item,
  focused,
  onMeasure,
  onPress,
}: {
  item: RailDestination;
  focused: boolean;
  onMeasure: (key: RailKey, y: number, height: number) => void;
  onPress: () => void;
}) {
  const t = useTheme();
  const { Icon } = item;

  return (
    <TouchableOpacity
      // O destino ativo se anuncia pelo NOME. Parece rústico, e é de
      // propósito: o `accessibilityState` abaixo funciona no celular, mas o
      // react-native-web 0.19 nem sequer o repassa ao DOM — quem usa leitor de
      // tela no desktop não tinha como saber onde estava. E `aria-selected`
      // seria inválido num papel de botão. O sufixo no nome atravessa as
      // três plataformas sem mentir sobre o papel do elemento.
      accessibilityLabel={focused ? `${item.label}, página atual` : item.label}
      accessibilityRole="button"
      // Vale no iOS/Android; na web é inerte, e é por isso que existe o sufixo
      accessibilityState={{ selected: focused }}
      activeOpacity={0.85}
      onPress={onPress}
      onLayout={(event) =>
        onMeasure(
          item.key,
          event.nativeEvent.layout.y,
          event.nativeEvent.layout.height,
        )
      }
      style={{
        flexDirection: "row",
        alignItems: "center",
        height: ITEM_HEIGHT,
        marginBottom: spacing[1],
        paddingHorizontal: spacing[4],
        borderRadius: radius.full,
        // Pílula do ativo no accent esmaecido: no cheio, o ícone dourado
        // sumiria dentro dela — dourado sobre dourado
        backgroundColor: focused ? t.accent.neonMuted : "transparent",
      }}
    >
      {item.primary ? (
        // O trio da barra inferior mantém o preenchimento animado do ícone
        <AnimatedTabIcon Icon={Icon} focused={focused} size={20} />
      ) : (
        // Nos secundários o `fill` do lucide vira silhueta (o "i" do Info some
        // dentro do disco), então a seleção fala só por cor e pílula
        <Icon size={20} color={focused ? t.accent.neon : t.text.tertiary} />
      )}
      <Text
        numberOfLines={1}
        style={{
          flex: 1,
          marginLeft: spacing[3],
          color: focused ? t.accent.neon : t.text.secondary,
          fontFamily: "Roboto_700Bold",
          fontSize: 14,
        }}
      >
        {item.label}
      </Text>
    </TouchableOpacity>
  );
}
