import React from "react";
import { ActivityIndicator, Text, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRL } from "../utils/money";
import { benchmarkPhrase } from "../utils/assetNews";
import type { AssetDetail } from "../services/api";

/**
 * Janelas de variação e a faixa de 52 semanas (EC-103).
 *
 * <p>A variação "de hoje" sozinha não responde o que a pessoa quer saber ao
 * abrir um ativo: se está caro ou barato em relação ao próprio ano. Quatro
 * janelas e uma régua respondem.
 *
 * <p>Janela sem histórico mostra um traço, nunca "0,00%": papel recém-listado
 * não tem 30 dias, e zero afirmaria estabilidade onde não há dado.
 */
export default function AssetWindows({
  detail,
  isLoading,
  benchmark,
}: {
  detail: AssetDetail | null;
  isLoading: boolean;
  /** O índice com que comparar o dia; ausente quando ele não foi carregado. */
  benchmark?: { label: string; changePct: number | null } | null;
}) {
  const t = useTheme();

  if (isLoading && !detail) {
    return (
      <View
        style={{ paddingVertical: spacing[6], alignItems: "center" }}
        accessibilityLabel="Carregando o histórico do ativo"
      >
        <ActivityIndicator size="small" color={t.accent.neon} />
      </View>
    );
  }

  if (!detail) return null;

  const temFaixa =
    detail.fiftyTwoWeekLow != null &&
    detail.fiftyTwoWeekHigh != null &&
    detail.rangePosition != null;

  const comparacao = benchmark
    ? benchmarkPhrase(detail.dayChangePct, benchmark.changePct, benchmark.label)
    : null;

  return (
    <View style={{ marginTop: spacing[2] }}>
      {detail.windows.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            backgroundColor: t.background.elevated,
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: t.border.subtle,
            paddingVertical: spacing[3],
          }}
        >
          {detail.windows.map((janela) => {
            const semDado = janela.changePct == null;
            const subiu = (janela.changePct ?? 0) >= 0;
            return (
              <View
                key={janela.key}
                style={{ flex: 1, alignItems: "center" }}
                accessible
                accessibilityLabel={
                  semDado
                    ? `${janela.label}: sem histórico suficiente`
                    : `${janela.label}: ${subiu ? "alta" : "queda"} de ${Math.abs(
                        janela.changePct as number,
                      )
                        .toFixed(2)
                        .replace(".", ",")} por cento`
                }
              >
                <Text style={{ color: t.text.tertiary, fontSize: 11 }}>
                  {janela.label}
                </Text>
                <Text
                  style={{
                    marginTop: 2,
                    fontSize: 14,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                    color: semDado
                      ? t.text.tertiary
                      : subiu
                        ? t.chart.up
                        : t.chart.down,
                  }}
                >
                  {semDado
                    ? "—"
                    : `${subiu ? "+" : "−"}${Math.abs(janela.changePct as number)
                        .toFixed(2)
                        .replace(".", ",")}%`}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {temFaixa && (
        <View style={{ marginTop: spacing[4] }}>
          <Text
            style={{
              color: t.text.tertiary,
              fontSize: 10,
              fontWeight: "700",
              letterSpacing: 1.2,
              textTransform: "uppercase",
              marginBottom: spacing[2],
            }}
          >
            Últimas 52 semanas
          </Text>
          <View
            accessible
            accessibilityLabel={`Preço de ${formatBRL(
              detail.price ?? 0,
            )}, entre a mínima de ${formatBRL(
              detail.fiftyTwoWeekLow as number,
            )} e a máxima de ${formatBRL(detail.fiftyTwoWeekHigh as number)} do ano`}
          >
            <View
              style={{
                height: 6,
                borderRadius: 3,
                backgroundColor: t.background.elevated,
                borderWidth: 1,
                borderColor: t.border.subtle,
                justifyContent: "center",
              }}
            >
              {/* O marcador é posicionado pela fração que o servidor calculou:
                  refazer a conta aqui abriria espaço para as duas telas
                  discordarem sobre onde o preço está */}
              <View
                style={{
                  position: "absolute",
                  left: `${(detail.rangePosition as number) * 100}%`,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  marginLeft: -5,
                  backgroundColor: t.accent.neon,
                }}
              />
            </View>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: spacing[2],
              }}
            >
              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 11,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatBRL(detail.fiftyTwoWeekLow as number)}
              </Text>
              <Text
                style={{
                  color: t.text.secondary,
                  fontSize: 11,
                  fontVariant: ["tabular-nums"],
                }}
              >
                {formatBRL(detail.fiftyTwoWeekHigh as number)}
              </Text>
            </View>
          </View>
        </View>
      )}

      {comparacao && (
        // Separa desempenho de maré: subir 4% num dia em que o índice subiu 4%
        // não é notícia sobre o papel
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 12,
            marginTop: spacing[3],
          }}
        >
          {comparacao}
        </Text>
      )}

      {detail.stale && (
        // Número velho sem aviso é pior do que número ausente
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: spacing[3],
          }}
        >
          Cotação da última atualização que conseguimos: o limite diário de
          consultas ao provedor foi atingido.
        </Text>
      )}
    </View>
  );
}
