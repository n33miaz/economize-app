import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

import PotIcon, { type PotTone } from "./PotIcon";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";

/**
 * O vazio contado pelo pote — EC-231.
 *
 * <p><b>Por que o pote, e não mais um ícone dentro de um círculo.</b> Toda
 * tela vazia deste app usava a mesma receita: um glifo genérico num disco
 * âmbar. Funciona, e é exatamente igual ao de qualquer outro aplicativo — o
 * momento em que a pessoa mais precisa entender onde está é o momento em que
 * o produto some.
 *
 * <p>O pote é a marca E o indicador: ele já conta o resultado do ciclo na
 * Home. Usá-lo aqui faz o estado vazio dizer a mesma língua do resto — um pote
 * <b>vazio</b> comunica "não há nada aqui ainda" sem precisar da frase, e a
 * frase fica livre para dizer o que fazer.
 *
 * <p><b>O nível não é decorativo.</b> Cada situação tem o seu: começar é pote
 * vazio, meta batida é pote cheio com a moeda de cifrão, um período sem
 * movimento é o pote pela metade — o dinheiro existe, só não andou. Um pote
 * cheio anunciando "você ainda não importou nada" seria mentira desenhada.
 */

export type PotMood = "comecar" | "sem-movimento" | "conquistado" | "atencao";

const ESTADOS: Record<PotMood, { level: number; tone: PotTone }> = {
  /** Nada ainda: o pote vazio diz isso melhor que qualquer frase. */
  comecar: { level: 0, tone: "brand" },
  /** Há dinheiro, só não houve movimento no recorte. */
  "sem-movimento": { level: 0.5, tone: "brand" },
  /** Meta batida, dívida quitada — o pote coroado. */
  conquistado: { level: 1, tone: "success" },
  /** Algo exige reação; o pote veste o token de perigo. */
  atencao: { level: 0.25, tone: "danger" },
};

interface Props {
  mood: PotMood;
  title: string;
  /** Uma ou duas frases. Se precisar de três, a tela é que está confusa. */
  body: string;
  /** O que fazer a seguir. Sem ele, o vazio é só um beco. */
  actionLabel?: string;
  onAction?: () => void;
  size?: number;
}

export default function PotEmptyState({
  mood,
  title,
  body,
  actionLabel,
  onAction,
  size = 96,
}: Props) {
  const t = useTheme();
  const estado = ESTADOS[mood];

  return (
    <View
      accessible
      accessibilityLabel={`${title}. ${body}`}
      style={{
        alignItems: "center",
        paddingHorizontal: spacing[6],
        paddingVertical: spacing[8],
      }}
    >
      {/* `animate`: o pote enche ao aparecer (EC-223). Num estado vazio o
          enchimento é curto por definição — e é ele que faz a tela parecer
          viva em vez de quebrada */}
      <PotIcon size={size} level={estado.level} tone={estado.tone} animate />

      <Text
        style={{
          color: t.text.primary,
          fontSize: 18,
          fontWeight: "700",
          textAlign: "center",
          marginTop: spacing[4],
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: t.text.secondary,
          fontSize: 13,
          lineHeight: 19,
          textAlign: "center",
          marginTop: spacing[2],
        }}
      >
        {body}
      </Text>

      {actionLabel && onAction ? (
        <TouchableOpacity
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          style={{
            marginTop: spacing[5],
            paddingHorizontal: spacing[5],
            height: 44,
            borderRadius: radius.xl,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.accent.neon,
          }}
        >
          <Text style={{ color: t.text.inverse, fontSize: 14, fontWeight: "700" }}>
            {actionLabel}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}
