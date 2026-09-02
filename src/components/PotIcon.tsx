import React from "react";
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  Path,
  Rect,
} from "react-native-svg";

import { useTheme } from "../theme/ThemeProvider";

/**
 * A marca do Economize! — um pote de vidro que enche de dinheiro.
 *
 * O preenchimento NÃO é enfeite: representa quanto sobrou no ciclo. A mesma
 * forma serve de logo, de ícone e de indicador de progresso, e é isso que
 * justifica ela ser um componente e não um PNG.
 *
 * Por que esta silhueta: a versão anterior era um retângulo arredondado com
 * uma barra em cima e lia como celular ou torradeira — o dono aprovou a IDEIA
 * do pote e reprovou a execução. Um pote se reconhece pela BOCA LARGA com a
 * tampa mais larga que o gargalo, pelo ombro curto e pelo corpo bojudo; boca
 * estreita vira garrafa. A fenda escura na tampa é o gesto que diz "cofre".
 *
 * E é dinheiro de verdade lá dentro — moedas de frente com anel (o anel é o
 * que faz ler moeda, e não bolinha) amontoadas como caem num pote, cédulas
 * atrás —, nunca um líquido colorido: "quanto guardei" é uma quantidade de
 * coisas, não um nível de tanque. A geometria é a MESMA de `marca/10-pote.svg`
 * e do gerador de PNGs; mudar aqui sem mudar lá desalinha ícone e app.
 */

/** Faixas de preenchimento. O tom acompanha o resultado, não a quantidade. */
export type PotTone = "brand" | "danger" | "success";

interface PotIconProps {
  size?: number;
  /** 0 a 1. Fora da faixa é grampeado — chamador não precisa se preocupar. */
  level?: number;
  tone?: PotTone;
  /** Moeda pairando sobre a boca; a abertura do app anima a queda dela. */
  coinY?: number;
  coinOpacity?: number;
}

const OURO_ESCURO = "#BC8508";

// Vidro: gargalo largo (19→45), ombro curto e corpo bojudo com fundo redondo.
// Tampa e fenda vivem fora do vidro para o recorte do conteúdo não as tocar.
const VIDRO =
  "M19 13.5V16.5C19 19.5 11.5 21 11.5 29V49Q11.5 58 20 58H44Q52.5 58 52.5 49V29C52.5 21 45 19.5 45 16.5V13.5";

export default function PotIcon({
  size = 64,
  level = 0.6,
  tone = "brand",
  coinY,
  coinOpacity = 0,
}: PotIconProps) {
  const t = useTheme();
  const traco =
    tone === "danger"
      ? t.semantic.danger
      : tone === "success"
        ? t.semantic.success
        : t.accent.neon;
  // O vazado das moedas e a fenda da tampa usam o fundo da tela: é o que
  // desenha o anel, o cifrão e o corte do cofre em qualquer tema
  const vazado = t.background.base;

  const n = Math.max(0, Math.min(1, level));

  const moeda = (cx: number, cy: number, r: number, key: string) => (
    <G key={key}>
      <Circle cx={cx} cy={cy} r={r} fill={traco} />
      <Circle
        cx={cx}
        cy={cy}
        r={r * 0.58}
        fill="none"
        stroke={vazado}
        strokeWidth={1.3}
      />
    </G>
  );

  // Cédula mais escura que a moeda, com miolo e duas marcas de borda — é o
  // que a separa de uma barra
  const cedula = (cx: number, cy: number, rot: number, key: string) => (
    <G key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <Rect
        x={-8.5}
        y={-4.25}
        width={17}
        height={8.5}
        rx={1.6}
        fill={tone === "brand" ? OURO_ESCURO : traco}
        fillOpacity={tone === "brand" ? 1 : 0.65}
      />
      <Circle cx={0} cy={0} r={2.1} fill="none" stroke={vazado} strokeWidth={1.1} />
      <Path
        d="M-5.9 0h1.2M4.7 0h1.2"
        stroke={vazado}
        strokeWidth={1.1}
        strokeLinecap="round"
      />
    </G>
  );

  // Quanto mais cheio, mais coisas — e não uma barra subindo. Cédulas entram
  // ANTES das moedas para ficarem atrás do monte.
  const dentro: React.ReactNode[] = [];
  if (n > 0.28) {
    dentro.push(cedula(30, 47, -16, "c1"));
    dentro.push(cedula(36, 43, 9, "c2"));
  }
  if (n > 0.05) {
    dentro.push(moeda(22.5, 52, 5.2, "m1"));
    dentro.push(moeda(41.5, 52, 5.2, "m2"));
  }
  if (n > 0.15) dentro.push(moeda(32, 51.5, 5.4, "m3"));
  if (n > 0.55) dentro.push(moeda(27, 44.5, 5.2, "m4"));
  if (n > 0.7) dentro.push(moeda(37.5, 44.5, 5.2, "m5"));
  if (n > 0.9) {
    // A moeda do cifrão coroa o monte: é o estado "meta batida"
    dentro.push(
      <G key="cifrao">
        <Circle cx={32} cy={36.5} r={6.6} fill={traco} />
        <Path
          d="M32 31.2v10.6"
          stroke={vazado}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
        <Path
          d="M34.6 33.2c0-1.3-1.3-2-2.6-2s-2.6.7-2.6 2 1.3 2 2.6 2.3 2.6 1 2.6 2.3-1.3 2-2.6 2-2.6-.7-2.6-2"
          fill="none"
          stroke={vazado}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </G>,
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        {/* O recorte é o que mantém o dinheiro DENTRO do vidro quando a
            quantidade cresce — sem ele, moeda vaza pela parede */}
        <ClipPath id="potInterior">
          <Path d={`${VIDRO}Z`} />
        </ClipPath>
      </Defs>

      {coinY !== undefined && coinOpacity > 0 ? (
        <G opacity={coinOpacity}>{moeda(32, coinY, 4, "queda")}</G>
      ) : null}

      {/* Vidro sombreado de leve: é o que faz o vazio ler como pote vazio, e
          não como contorno solto */}
      <Path d={`${VIDRO}Z`} fill={traco} fillOpacity={0.1} />

      <G clipPath="url(#potInterior)">{dentro}</G>

      <Path
        d={VIDRO}
        fill="none"
        stroke={traco}
        strokeWidth={4}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* Brilho do vidro */}
      <Path
        d="M16.5 30.5v12"
        stroke={traco}
        strokeWidth={2}
        strokeLinecap="round"
        strokeOpacity={0.4}
      />

      {/* Tampa mais larga que o gargalo, com a fenda do cofre */}
      <Rect x={15.5} y={6} width={33} height={8} rx={3} fill={traco} />
      <Rect x={27.5} y={8.7} width={9} height={2.6} rx={1.3} fill={vazado} />
    </Svg>
  );
}

/**
 * Traduz o resultado do ciclo no estado do pote. É a regra que o ícone do app
 * vai usar, então mora aqui e não espalhada por tela.
 *
 * @param sobra quanto sobrou no ciclo (pode ser negativo)
 * @param entradas total que entrou; zero significa "ainda não sei"
 */
export function potStateFor(
  sobra: number,
  entradas: number,
): { level: number; tone: PotTone; label: string } {
  if (entradas <= 0) {
    // Sem dado ainda: o pote aparece pela metade e em tom de marca, nunca no
    // vermelho — vermelho no primeiro acesso acusaria o usuário de algo
    return { level: 0.5, tone: "brand", label: "Sem dados ainda" };
  }
  if (sobra < 0) return { level: 0, tone: "danger", label: "Mês no vermelho" };
  const proporcao = sobra / entradas;
  if (proporcao >= 0.3)
    return { level: 1, tone: "success", label: "Meta batida" };
  if (proporcao >= 0.15) return { level: 0.75, tone: "brand", label: "Sobrou bem" };
  if (proporcao >= 0.05) return { level: 0.5, tone: "brand", label: "No caminho" };
  return { level: 0.25, tone: "brand", label: "Apertado" };
}
