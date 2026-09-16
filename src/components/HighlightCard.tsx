import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import ArrowDownRight from "lucide-react-native/dist/esm/icons/arrow-down-right";
import ArrowUpRight from "lucide-react-native/dist/esm/icons/arrow-up-right";
import type { LucideIcon } from "lucide-react-native";
import Animated from "react-native-reanimated";
import { useTheme } from "../theme/ThemeProvider";
import { ds } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";
import { formatBRLCompact, formatPercent } from "../utils/money";

interface HighlightCardProps {
  title: string;
  value: number;
  variation: number;
  Icon: LucideIcon;
  onPress?: () => void;
  /** Tipo do indicador — decide o formato do valor (moeda vs. pontos) */
  type?: string;
  /**
   * Versão menor para a fila horizontal do telefone: padding e valor um
   * degrau abaixo, para caberem dois cards e meio nos 390 px em vez de um e
   * meio — quem rola precisa VER que há mais à direita.
   */
  compact?: boolean;
}

/**
 * Faixa de largura do card na fila horizontal.
 *
 * <p>`flex: 1` dentro de um ScrollView horizontal colapsava o card, então a
 * largura mínima é fixa e o conteúdo dita o resto — mas só até o teto. Sem
 * teto, um título longo ("Ethereum Classic") ou um valor de cripto por
 * extenso ("R$ 612.345,67") esticavam o card e empurravam os vizinhos para
 * fora da tela. Com o teto, o texto é que cede: `numberOfLines={1}` corta o
 * título com reticências e o valor é abreviado a partir de 100 mil
 * (`formatBRLCompact`), porque `adjustsFontSizeToFit` é ignorado pelo
 * react-native-web e não há como encolher a fonte no navegador.
 */
const CARD_WIDTH = { min: 150, max: 240 } as const;
const CARD_WIDTH_COMPACT = { min: 132, max: 200 } as const;

export default function HighlightCard({
  title,
  value,
  variation,
  Icon,
  onPress,
  type,
  compact = false,
}: HighlightCardProps) {
  const t = useTheme();
  const { pressStyle, onPressIn, onPressOut } = usePressScale();
  const isPositive = variation >= 0;
  const semanticColor = isPositive ? t.semantic.success : t.semantic.danger;
  const DeltaIcon = isPositive ? ArrowUpRight : ArrowDownRight;

  // Índice não é dinheiro: pontos em pt-BR; o resto é BRL — completo até 100
  // mil, abreviado dali em diante ("R$ 612,3 mil"), porque o slot é estreito
  const formattedValue =
    type === "index"
      ? `${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} pts`
      : formatBRLCompact(value);

  const largura = compact ? CARD_WIDTH_COMPACT : CARD_WIDTH;

  return (
    <Animated.View
      style={[
        {
          minWidth: largura.min,
          maxWidth: largura.max,
          marginHorizontal: ds.spacing[2],
        },
        pressStyle,
      ]}
    >
      <TouchableOpacity
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.8}
        accessibilityLabel={`Detalhes de ${title}`}
        accessibilityRole="button"
        style={{
          padding: compact ? ds.spacing[4] : ds.spacing[5],
          borderRadius: ds.radius["2xl"],
          borderWidth: 1,
          borderColor: t.border.default,
          backgroundColor: t.background.surface,
          ...ds.shadow.md,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: compact ? ds.spacing[2] : ds.spacing[3],
          }}
        >
          <View
            style={{
              marginRight: ds.spacing[2],
              padding: ds.spacing[2],
              borderRadius: ds.radius.full,
              backgroundColor: t.background.elevated,
            }}
          >
            <Icon size={compact ? 16 : 20} color={t.text.secondary} />
          </View>
          {/* `flexShrink: 1` é o que faz o corte acontecer no título, e não
              no ícone ao lado dele */}
          <Text
            numberOfLines={1}
            style={[
              compact ? ds.typography.bodySm : ds.typography.body,
              { color: t.text.secondary, flexShrink: 1 },
            ]}
          >
            {title}
          </Text>
        </View>

        <Text
          numberOfLines={1}
          style={[
            compact ? ds.typography.numericMd : ds.typography.numericLg,
            { color: t.text.primary, marginBottom: ds.spacing[2] },
          ]}
        >
          {formattedValue}
        </Text>

        <View
          style={{
            alignSelf: "flex-start",
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: ds.spacing[2],
            paddingVertical: ds.spacing[1],
            borderRadius: ds.radius.lg,
            backgroundColor: isPositive
              ? t.semantic.successMuted
              : t.semantic.dangerMuted,
          }}
        >
          <DeltaIcon size={14} color={semanticColor} />
          <Text
            style={[
              ds.typography.bodySm,
              {
                marginLeft: ds.spacing[1],
                color: semanticColor,
                fontFamily: "Roboto_700Bold",
              },
            ]}
          >
            {formatPercent(variation)}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
