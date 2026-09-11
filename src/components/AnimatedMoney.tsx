import React, { useEffect, useRef, useState } from "react";
import { Text, TextStyle } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { motion } from "../theme/ds";
import { formatBRL, formatBRLCompact } from "../utils/money";

interface Props {
  value: number;
  /** Abrevia em "R$ 1,2 mil" quando o espaço é curto. */
  compact?: boolean;
  /** Rótulo falado; sem ele, o valor por extenso. */
  accessibilityLabel?: string;
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
}

/**
 * O valor que CHEGA, em vez de aparecer pronto.
 *
 * <p><b>Por que isto importa.</b> Um número que troca de 1.240,00 para 890,00
 * num quadro não é lido como "mudou": é lido como "sempre foi assim". A
 * contagem de meio segundo é o que faz o olho perceber a direção — subiu ou
 * desceu — antes mesmo de ler o valor. É a diferença entre um painel e um
 * relatório impresso.
 *
 * <p><b>Só na mudança, nunca na entrada.</b> Contar do zero toda vez que a
 * tela monta faria toda abertura parecer um carregamento, e o app já tem
 * esqueleto para isso. A primeira renderização mostra o valor final, direto;
 * a contagem só existe quando o número <i>trocou</i> com a tela aberta.
 *
 * <p><b>Respeita "reduzir movimento".</b> Quem pediu menos animação no
 * sistema recebe a troca seca — e recebe o valor certo, que é o que importa.
 */
export default function AnimatedMoney({
  value,
  compact = false,
  accessibilityLabel,
  style,
  numberOfLines = 1,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [mostrado, setMostrado] = useState(value);
  // Ref, e não estado: o valor anterior não deve provocar render sozinho
  const anterior = useRef(value);
  const primeiraVez = useRef(true);

  useEffect(() => {
    const de = anterior.current;
    anterior.current = value;

    if (primeiraVez.current) {
      primeiraVez.current = false;
      setMostrado(value);
      return;
    }
    if (reducedMotion || de === value) {
      setMostrado(value);
      return;
    }

    const inicio = Date.now();
    const duracao = motion.duration.slow;
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - inicio) / duracao);
      // Desaceleração: o número corre no começo e assenta no fim, que é como
      // o olho espera que um valor "chegue"
      const eased = 1 - Math.pow(1 - t, 3);
      setMostrado(de + (value - de) * eased);
      if (t >= 1) {
        clearInterval(id);
        // O último quadro é o valor EXATO: interpolação deixa centavos
        // errados, e centavo errado num app de dinheiro é defeito
        setMostrado(value);
      }
    }, 16);
    return () => clearInterval(id);
  }, [value, reducedMotion]);

  return (
    <Text
      numberOfLines={numberOfLines}
      // Quem ouve recebe o valor FINAL, sempre: ler a contagem em voz alta
      // seria uma sequência de números sem sentido
      accessibilityLabel={accessibilityLabel ?? formatBRL(value)}
      style={[{ fontVariant: ["tabular-nums"] }, style as TextStyle]}
    >
      {compact ? formatBRLCompact(mostrado) : formatBRL(mostrado)}
    </Text>
  );
}
