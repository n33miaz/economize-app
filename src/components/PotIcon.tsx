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
 * A marca do Economize! — um pote que enche de dinheiro.
 *
 * O preenchimento NÃO é enfeite: representa quanto sobrou no ciclo. A mesma
 * forma serve de logo, de ícone e de indicador de progresso, e é isso que
 * justifica ela ser um componente e não um PNG.
 *
 * E é dinheiro de verdade lá dentro — moedas com anel e cédulas com miolo —,
 * nunca um líquido colorido: "quanto guardei" é uma quantidade de coisas, não
 * um nível de tanque.
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
  // O vazado das moedas usa o fundo da tela: é o que desenha o anel e o cifrão
  const vazado = t.background.base;

  const n = Math.max(0, Math.min(1, level));

  const moeda = (cx: number, cy: number, r: number, key: string) => (
    <G key={key}>
      <Circle cx={cx} cy={cy} r={r} fill={traco} />
      <Circle
        cx={cx}
        cy={cy}
        r={r * 0.55}
        fill="none"
        stroke={vazado}
        strokeWidth={1.2}
      />
    </G>
  );

  const cedula = (cx: number, cy: number, rot: number, key: string) => (
    <G key={key} transform={`translate(${cx} ${cy}) rotate(${rot})`}>
      <Rect
        x={-11}
        y={-3.6}
        width={22}
        height={7.2}
        rx={2}
        fill={tone === "brand" ? OURO_ESCURO : traco}
        opacity={tone === "brand" ? 1 : 0.65}
      />
      <Circle cx={0} cy={0} r={1.9} fill="none" stroke={vazado} strokeWidth={1} />
    </G>
  );

  // Quanto mais cheio, mais coisas — e não uma barra subindo
  const dentro: React.ReactNode[] = [];
  if (n > 0.05) dentro.push(moeda(24, 50, 4.5, "m1"));
  if (n > 0.12) dentro.push(moeda(36, 51, 4.5, "m2"));
  if (n > 0.28) dentro.push(cedula(31, 51, -6, "c1"));
  if (n > 0.45) dentro.push(cedula(36, 45, 5, "c2"));
  if (n > 0.55) dentro.push(moeda(23, 41, 5, "m3"));
  if (n > 0.68) dentro.push(moeda(45, 41, 4.5, "m4"));
  if (n > 0.8) dentro.push(moeda(27, 32, 4.5, "m5"));
  if (n > 0.9) {
    dentro.push(
      <G key="cifrao">
        <Circle cx={35} cy={35} r={7.5} fill={traco} />
        <Path
          d="M35 27v16"
          stroke={vazado}
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Path
          d="M38 31.5c0-1.4-1.4-2.2-3-2.2s-3 .8-3 2.2 1.4 2.2 3 2.5 3 1.1 3 2.5-1.4 2.2-3 2.2-3-.8-3-2.2"
          fill="none"
          stroke={vazado}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </G>,
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Defs>
        {/* O recorte é o que mantém o dinheiro DENTRO do pote quando a
            quantidade cresce — sem ele, moeda vaza pela parede */}
        <ClipPath id="potInterior">
          <Rect x={14} y={18} width={36} height={38} rx={11} />
        </ClipPath>
      </Defs>

      {coinY !== undefined && coinOpacity > 0 ? (
        <Circle cx={32} cy={coinY} r={5} fill={traco} opacity={coinOpacity} />
      ) : null}

      <G clipPath="url(#potInterior)">{dentro}</G>

      <Rect
        x={14}
        y={18}
        width={36}
        height={38}
        rx={11}
        fill="none"
        stroke={traco}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Path
        d="M23 15h18"
        stroke={traco}
        strokeWidth={4}
        strokeLinecap="round"
        fill="none"
      />
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
