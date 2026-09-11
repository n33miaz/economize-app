import React from "react";
import { Text, TextStyle } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import {
  freshnessStamp,
  type FreshnessTone,
  type Instant,
} from "../utils/freshness";

interface Props {
  /** Quando o número foi lido: ISO da API ou epoch dos stores. */
  at: Instant;
  /** Abre a frase: "atualizado", "sincronizado", "lido". */
  prefix?: string;
  /** Só para o teste mandar no relógio. */
  now?: number;
  style?: TextStyle;
}

/**
 * O carimbo de "quando isto foi lido", desenhado sempre do mesmo jeito.
 *
 * <p>Existe como componente, e não como uma linha de `Text` copiada em cada
 * tela, porque o defeito que ele corrige é justamente a frase solta: o
 * concorrente escreveu "Atualizado agora" no saldo enquanto a própria tela de
 * conexões dele dizia 11 horas. Com um componente só, a tela não tem como
 * afirmar frescor — ela entrega o instante e recebe a verdade.
 *
 * <p>O tom vem junto do texto: passado um dia sem leitura, o carimbo muda de
 * cor. Cor porque quem bate o olho no saldo não lê a linha de baixo, e um
 * número de ontem apresentado como o de hoje é pior do que número nenhum.
 */
export default function FreshnessStamp({ at, prefix, now, style }: Props) {
  const t = useTheme();
  const { label, tone } = freshnessStamp(at, now ?? Date.now(), prefix);

  const cor: Record<FreshnessTone, string> = {
    fresh: t.text.tertiary,
    aging: t.text.secondary,
    stale: t.semantic.warning,
    unknown: t.semantic.warning,
  };

  return (
    <Text
      accessibilityLabel={`Dado ${label}`}
      numberOfLines={1}
      style={[{ fontSize: 11, color: cor[tone] }, style]}
    >
      {label}
    </Text>
  );
}
