import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useTheme } from "../theme/ThemeProvider";

/**
 * A linha de tendência de um papel — o desenho mais barato que responde
 * "estava subindo ou caindo?".
 *
 * <p><b>Por que ela existe.</b> O dono olhou a tela de Mercado e disse que
 * estava "muito pobre — nenhum usuário vai usar". Ele tinha razão sobre o
 * diagnóstico: cada card mostrava um preço e uma porcentagem, e porcentagem do
 * dia não conta história nenhuma. O dado para contá-la <b>já chegava na mesma
 * resposta</b> e era jogado fora: a Brapi devolve os fechamentos recentes junto
 * com a cotação, sem cobrar requisição a mais.
 *
 * <p><b>Escala local, e é de propósito.</b> A linha é normalizada entre o
 * próprio mínimo e o próprio máximo, então ela mostra a FORMA do movimento e
 * nunca a magnitude — duas linhas lado a lado não são comparáveis, e não devem
 * parecer. Quem compara magnitude é o número ao lado. Sem isso, um papel de
 * R$ 5 e outro de R$ 500 no mesmo eixo viram duas retas achatadas.
 *
 * <p><b>A cor vem de quem chama</b>, não do último ponto. A variação do card já
 * decidiu se o dia foi de alta ou de baixa, e uma linha que discordasse do
 * número ao lado dela seria pior do que linha nenhuma.
 *
 * <p>Série plana (todos os pontos iguais) desenha no meio da altura, em vez de
 * dividir por zero.
 */
export default function Sparkline({
  values,
  tone,
  width = 56,
  height = 20,
}: {
  values: number[] | null | undefined;
  /** "up" e "down" seguem os tokens de gráfico; "neutral" é o texto terciário. */
  tone: "up" | "down" | "neutral";
  width?: number;
  height?: number;
}) {
  const t = useTheme();

  // Menos de dois pontos não é linha. Reservar o espaço em vez de sumir
  // mantém o card do mesmo tamanho com e sem série — card que muda de altura
  // ao carregar empurra o conteúdo debaixo do dedo
  if (!values || values.length < 2) {
    return <View style={{ width, height }} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const amplitude = max - min;
  const passo = width / (values.length - 1);
  // Margem de meio traço em cima e embaixo: sem ela o ponto extremo fica
  // cortado ao meio pela borda do SVG
  const margem = 1.5;
  const util = height - margem * 2;

  const pontos = values.map((valor, i) => {
    const x = i * passo;
    const y =
      amplitude === 0
        ? height / 2
        : margem + util - ((valor - min) / amplitude) * util;
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
  });

  const cor =
    tone === "up" ? t.chart.up : tone === "down" ? t.chart.down : t.text.tertiary;

  return (
    <View
      style={{ width, height }}
      // Redundante com a variação que o card já anuncia: anunciá-la de novo
      // faria o leitor de tela repetir o mesmo fato duas vezes por papel
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={width} height={height}>
        <Path
          d={pontos.join(" ")}
          stroke={cor}
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
    </View>
  );
}
