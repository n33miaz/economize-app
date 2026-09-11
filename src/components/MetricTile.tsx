import React from "react";
import { Text, TouchableOpacity, View, ViewStyle } from "react-native";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";
import Animated from "react-native-reanimated";

import Card from "./Card";
import AnimatedMoney from "./AnimatedMoney";
import FlipCard, { useFlip } from "./FlipCard";
import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { usePressScale } from "../theme/motionPresets";

interface Props {
  /** UMA palavra ou sintagma curto. Se precisar de frase, não é um tile. */
  label: string;
  value: number;
  /** Uma linha abaixo do número: contexto, nunca um segundo número. */
  hint?: string | null;
  /** O gesto. Sem ele, o tile é leitura pura e não finge ser tocável. */
  onPress?: () => void;
  /** Cor do número, quando ele tem carga (negativo, aviso). */
  tone?: "neutral" | "positive" | "negative" | "warning";
  compact?: boolean;
  style?: ViewStyle;
  /**
   * O verso do card: de onde este número veio (EC-225).
   *
   * <p>Quando presente, o toque GIRA em vez de navegar — a pergunta "de onde
   * veio?" é sobre este número, e sair da tela para respondê-la tiraria da
   * frente justamente o que está em questão. A navegação continua existindo,
   * no verso, onde ela vira "ver os lançamentos".
   */
  back?: React.ReactNode;
}

/**
 * Um rótulo, um número, um gesto — EC-221.
 *
 * <p><b>A regra que ele existe para impor.</b> Card com dois números
 * concorrendo não tem hierarquia: o olho pula entre os dois e não decide qual
 * é a resposta. A home tinha cards com valor, variação, percentual e contagem
 * — quatro números no mesmo retângulo, e nenhum deles se destacava.
 *
 * <p>Aqui só cabe <b>um</b> valor. O `hint` é texto, não número disfarçado —
 * e a API do componente é o que garante isso: não existe um segundo campo
 * numérico para preencher.
 *
 * <p>O número <b>chega contando</b> (ver {@link AnimatedMoney}), e o tile
 * tocável afunda no toque. Os dois juntos são o que faz um painel parecer
 * vivo sem nada piscando.
 */
export default function MetricTile({
  label,
  value,
  hint,
  onPress,
  tone = "neutral",
  compact = true,
  style,
  back,
}: Props) {
  const t = useTheme();
  const press = usePressScale();
  const { flipped, toggle } = useFlip();

  const cor =
    tone === "positive"
      ? t.semantic.success
      : tone === "negative"
        ? t.semantic.danger
        : tone === "warning"
          ? t.semantic.warning
          : t.text.primary;

  const conteudo = (
    <Card padding="tight" style={style}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Text
          numberOfLines={1}
          style={{ flex: 1, color: t.text.secondary, fontSize: 12 }}
        >
          {label}
        </Text>
        {onPress ? <ChevronRight size={14} color={t.text.tertiary} /> : null}
      </View>
      <AnimatedMoney
        value={value}
        compact={compact}
        accessibilityLabel={undefined}
        style={{
          color: cor,
          fontSize: 22,
          fontWeight: "700",
          marginTop: spacing[1],
        }}
      />
      {hint ? (
        <Text
          numberOfLines={1}
          style={{ color: t.text.tertiary, fontSize: 11, marginTop: 2 }}
        >
          {hint}
        </Text>
      ) : null}
    </Card>
  );

  // Com verso, o toque gira; a navegação (quando existe) mora lá atrás
  const aoTocar = back ? toggle : onPress;

  if (!aoTocar) {
    return (
      <View accessible accessibilityLabel={`${label}: ${valorFalado(value)}`}>
        {conteudo}
      </View>
    );
  }

  const frente = (
    <Animated.View style={press.pressStyle}>
      <TouchableOpacity
        onPress={aoTocar}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        activeOpacity={0.9}
        accessibilityRole="button"
        accessibilityLabel={
          `${label}: ${valorFalado(value)}${hint ? `. ${hint}` : ""}` +
          (back ? ". Toque para ver de onde veio" : "")
        }
      >
        {conteudo}
      </TouchableOpacity>
    </Animated.View>
  );

  if (!back) return frente;

  return (
    <FlipCard
      flipped={flipped}
      front={frente}
      back={
        <TouchableOpacity
          onPress={toggle}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Fechar a origem de ${label}`}
          style={{ flex: 1 }}
        >
          {back}
        </TouchableOpacity>
      }
      style={style}
    />
  );
}

/** O valor por extenso para o leitor de tela, sem abreviação. */
function valorFalado(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
