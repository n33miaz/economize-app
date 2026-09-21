import React from "react";
import { Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { radius, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useTheme } from "../theme/ThemeProvider";
import type { Cenario, Contratado, Regua } from "../utils/balanceRuler";
import { formatDayMonthShort } from "../utils/cycleWindow";
import { formatBRL } from "../utils/money";

/** Altura da área do gráfico. */
const ALTURA = 96;
/** Respiro vertical para o traço e as marcas não encostarem nas bordas. */
const MARGEM = 10;

interface Props {
  regua: Regua;
  contratados: Contratado[];
  cenarios: Cenario[];
}

/**
 * A RÉGUA DE SALDO dos próximos 30 dias — e a parada onde o saber acaba.
 *
 * <p>Escolha 9 do dono em 16/09/2026 (variante a, com os elementos de c e b
 * que ele pediu junto): <i>"uma linha do tempo do próximo mês, dia a dia, só
 * com o que está escrito em algum lugar (...) Quando o conhecido termina,
 * aparece uma faixa dizendo 'daqui para frente eu não sei' — e a tela pára.
 * Nenhum número inventado"</i>.
 *
 * <p><b>Por que a linha para no último compromisso, e não no 30º dia.</b> Os
 * dias vazios depois do último compromisso conhecido são exatamente a parte
 * que o app não sabe. Desenhá-los como uma linha reta diria "seu saldo fica
 * estável", que é uma afirmação — e é a que a escolha 9 proíbe.
 *
 * <p><b>O pior dia é marcado.</b> É a pergunta que um número único de fim de
 * mês esconde: dá para fechar o mês com R$ 4.000 e furar o zero no dia 18,
 * quando a fatura cai antes do salário. A marca vermelha no fundo do vale é a
 * razão de existir desta tela.
 */
export default function BalanceRuler({ regua, contratados, cenarios }: Props) {
  const t = useTheme();
  const [largura, setLargura] = React.useState(0);
  const medir = React.useCallback((e: LayoutChangeEvent) => {
    setLargura(e.nativeEvent.layout.width);
  }, []);

  const saldos = regua.dias.map((d) => d.saldoNoFim);
  const min = Math.min(regua.saldoInicial, ...saldos);
  const max = Math.max(regua.saldoInicial, ...saldos);
  const amplitude = max - min;

  // Série plana desenha no meio da altura, em vez de dividir por zero — mesma
  // regra do `Sparkline`
  const y = (valor: number) =>
    amplitude === 0
      ? ALTURA / 2
      : MARGEM + (1 - (valor - min) / amplitude) * (ALTURA - MARGEM * 2);
  const passo =
    regua.dias.length > 1 ? largura / (regua.dias.length - 1) : largura;
  const x = (indice: number) =>
    regua.dias.length > 1 ? indice * passo : largura / 2;

  const caminho = regua.dias
    .map((dia, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(dia.saldoNoFim)}`)
    .join(" ");

  const furouOZero = min < 0;
  const indiceDoPior = regua.piorDia
    ? regua.dias.findIndex((d) => d.dia === regua.piorDia!.dia)
    : -1;

  return (
    <View>
      <View onLayout={medir} style={{ height: ALTURA }}>
        {largura > 0 && regua.dias.length > 0 && (
          <Svg width={largura} height={ALTURA}>
            {/* A linha do zero só existe quando o saldo a cruza: um eixo
                desenhado fora da faixa dos dados é enfeite que engana a
                leitura da altura */}
            {furouOZero && max >= 0 && (
              <Line
                x1={0}
                y1={y(0)}
                x2={largura}
                y2={y(0)}
                stroke={t.semantic.danger}
                strokeWidth={1}
                strokeDasharray="4 4"
                opacity={0.6}
              />
            )}
            <Path
              d={caminho}
              stroke={t.accent.neon}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {/* Um ponto por dia com evento: dia sem compromisso não ganha
                marca, senão trinta pontos iguais escondem os quatro que
                importam */}
            {regua.dias.map((dia, i) =>
              dia.eventos.length > 0 ? (
                <Circle
                  key={dia.dia}
                  cx={x(i)}
                  cy={y(dia.saldoNoFim)}
                  r={3}
                  fill={t.accent.neon}
                />
              ) : null,
            )}
            {indiceDoPior >= 0 && regua.piorDia!.saldo < 0 && (
              <Circle
                cx={x(indiceDoPior)}
                cy={y(regua.piorDia!.saldo)}
                r={5}
                fill={t.semantic.danger}
              />
            )}
          </Svg>
        )}
      </View>

      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          marginTop: spacing[1],
        }}
      >
        <Text style={{ color: t.text.tertiary, fontSize: 11 }}>Hoje</Text>
        {regua.ultimoDiaConhecido && (
          <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
            {formatDayMonthShort(regua.ultimoDiaConhecido)}
          </Text>
        )}
      </View>

      {regua.piorDia && regua.piorDia.saldo < 0 && (
        <Text
          style={{
            color: t.semantic.danger,
            fontSize: 13,
            lineHeight: 18,
            marginTop: spacing[3],
          }}
        >
          {`O saldo fura o zero em ${formatDayMonthShort(regua.piorDia.dia)}: ` +
            `${formatBRL(regua.piorDia.saldo)}.`}
        </Text>
      )}

      {/* A FAIXA. Ela é o ponto da escolha 9: a tela diz onde para de saber,
          em vez de continuar desenhando meio ano de chute */}
      <View
        accessibilityRole="text"
        style={{
          marginTop: spacing[4],
          padding: spacing[4],
          borderRadius: radius.xl,
          borderWidth: 1,
          borderStyle: "dashed",
          borderColor: t.border.default,
          backgroundColor: t.background.elevated,
        }}
      >
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 18,
          }}
        >
          {regua.ultimoDiaConhecido
            ? `Daqui para frente eu não sei. O último compromisso que está escrito em algum lugar vence em ${formatDayMonthShort(
                regua.ultimoDiaConhecido,
              )} — depois disso, o que houver depende do que você gastar.`
            : "Daqui para frente eu não sei: não há nenhum compromisso com data nos próximos 30 dias."}
        </Text>
      </View>

      {cenarios.length > 0 && (
        <View style={{ marginTop: spacing[5] }}>
          <Text
            style={{
              color: t.text.primary,
              fontSize: 14,
              fontWeight: "700",
              marginBottom: spacing[3],
            }}
          >
            E se você gastar…
          </Text>
          {cenarios.map((cenario) => (
            <View
              key={cenario.chave}
              accessible
              accessibilityRole="text"
              accessibilityLabel={
                `${cenario.rotulo}: ${formatBRL(cenario.saldo)}, ` +
                `${cenario.base}` +
                (cenario.estimativa ? ". Estimativa" : "")
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: spacing[2],
              }}
            >
              <View style={{ flex: 1, marginRight: spacing[3] }}>
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 13,
                    fontWeight: "700",
                  }}
                >
                  {cenario.rotulo}
                  {/* O que é estimativa diz que é. O "folgado" não leva a
                      etiqueta porque ele não estima nada: é a soma do que
                      está assinado */}
                  {cenario.estimativa ? " · estimativa" : ""}
                </Text>
                <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
                  {cenario.base}
                </Text>
              </View>
              <Text
                style={{
                  color: cenario.saldo < 0 ? t.semantic.danger : t.text.primary,
                  fontSize: 15,
                  fontWeight: "700",
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatBRL(cenario.saldo)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {contratados.length > 0 && (
        <View style={{ marginTop: spacing[5] }}>
          <Text
            style={{
              color: t.text.primary,
              fontSize: 14,
              fontWeight: "700",
              marginBottom: spacing[3],
            }}
          >
            O que está contratado
          </Text>
          {contratados.map((linha) => (
            <View
              key={`${linha.seriesId}-${linha.dia}`}
              accessible
              accessibilityRole="text"
              accessibilityLabel={
                `${formatDayMonthShort(linha.dia)}, ${linha.nome}, ` +
                `${formatBRL(linha.valor)}. ` +
                `Sobra ${formatBRL(linha.saldoDepois)}`
              }
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: spacing[2],
                borderBottomWidth: 1,
                borderBottomColor: t.border.subtle,
              }}
            >
              <Text
                style={{
                  width: 52,
                  color: t.text.tertiary,
                  fontSize: 11,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatDayMonthShort(linha.dia)}
              </Text>
              <Text
                numberOfLines={1}
                style={{
                  flex: 1,
                  minWidth: 0,
                  color: t.text.primary,
                  fontSize: 13,
                  marginRight: spacing[2],
                }}
              >
                {linha.nome}
              </Text>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{
                    color: linha.valor >= 0 ? t.chart.up : t.text.primary,
                    fontSize: 13,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {`${linha.valor >= 0 ? "+ " : "- "}${formatBRL(
                    Math.abs(linha.valor),
                  )}`}
                </Text>
                {/* O saldo DEPOIS de cada compromisso: é o pedido da opção c,
                    e é o que responde "dá para pagar isto?" sem a pessoa
                    somar de cabeça */}
                <Text
                  style={{
                    color:
                      linha.saldoDepois < 0
                        ? t.semantic.danger
                        : t.text.tertiary,
                    fontSize: 11,
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {`sobra ${formatBRL(linha.saldoDepois)}`}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** O saldo de partida, escrito como manchete acima da régua. */
export function BalanceRulerHeadline({
  saldoInicial,
  saldoNoFim,
}: {
  saldoInicial: number;
  saldoNoFim: number;
}) {
  const t = useTheme();
  return (
    <View>
      <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
        Em conta hoje
      </Text>
      <Text
        style={{ ...typography.numericLg, color: t.text.primary }}
        numberOfLines={1}
      >
        {formatBRL(saldoInicial)}
      </Text>
      <Text style={{ color: t.text.secondary, fontSize: 13, marginTop: 2 }}>
        {`Com o que está contratado, fecha em ${formatBRL(saldoNoFim)}.`}
      </Text>
    </View>
  );
}
