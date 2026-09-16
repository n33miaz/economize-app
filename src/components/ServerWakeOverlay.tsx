import React, { useMemo } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import Animated from "react-native-reanimated";
import CloudMoon from "lucide-react-native/dist/esm/icons/cloud-moon";

import { useAccountsStore } from "../store/accountsStore";
import { useAnalyticsStore } from "../store/analyticsStore";
import { usePreferencesStore } from "../store/preferencesStore";
import { useServerStore } from "../store/serverStore";
import { useTheme } from "../theme/ThemeProvider";
import { radius, shadow, spacing } from "../theme/ds";
import { typography } from "../theme/typography";
import { useMotionPresets } from "../theme/motionPresets";
import { AGING_UNTIL_MS, formatDateTime, isStale } from "../utils/freshness";
import { lastKnownSnapshot, type LastKnownLine } from "../utils/lastKnown";
import { formatBRL, formatBRLCompact } from "../utils/money";

// Os mesmos literais do "olhinho" da Home: a preferência de esconder valores
// vale para qualquer lugar em que um número da pessoa apareça — inclusive
// aqui, que aparece antes de qualquer tela
const HIDDEN = "R$ •••••";
const HIDDEN_SPOKEN = "valor oculto";

// Enquanto a API hibernada sobe, qualquer tela fica sem dado e o botão parece
// travado. Este aviso é a diferença entre "o app quebrou" e "o servidor está
// acordando" — o mesmo padrão adotado no LumiLivre.
export default function ServerWakeOverlay() {
  const t = useTheme();
  const { cardEntering } = useMotionPresets();
  const isWaking = useServerStore((s) => s.isWaking);
  const waitedSeconds = useServerStore((s) => s.waitedSeconds);

  // O que a última visita deixou no aparelho (EC-cold-start). Lido dos stores
  // reidratados, e não pedido à API: é justamente ela que não responde agora
  const accounts = useAccountsStore((s) => s.accounts);
  const accountsAt = useAccountsStore((s) => s.accountsAt);
  const homeData = useAnalyticsStore((s) => s.homeData);
  const homeDataAt = useAnalyticsStore((s) => s.homeDataAt);
  const hideBalance = usePreferencesStore((s) => s.hideBalance);

  const remembered = useMemo(
    () => lastKnownSnapshot({ accounts, accountsAt, homeData, homeDataAt }),
    [accounts, accountsAt, homeData, homeDataAt],
  );

  if (!isWaking) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: t.background.overlay,
        alignItems: "center",
        justifyContent: "center",
        padding: spacing[5],
        zIndex: 9998,
        // Não é diálogo de decisão: só informa, e some sozinho quando a API
        // responde. No estilo porque `props.pointerEvents` está depreciado
        pointerEvents: "auto",
      }}
      accessibilityLiveRegion="polite"
    >
      <View
        style={[
          {
            width: "100%",
            maxWidth: 380,
            backgroundColor: t.background.elevated,
            borderRadius: radius["2xl"],
            borderWidth: 1,
            borderColor: t.border.default,
            padding: spacing[6],
            alignItems: "center",
          },
          shadow.lg,
        ]}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: radius.full,
            backgroundColor: t.accent.neonMuted,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: spacing[4],
          }}
        >
          <CloudMoon size={30} color={t.accent.neon} />
        </View>

        <Text
          style={{
            color: t.text.primary,
            fontFamily: "Roboto_700Bold",
            fontSize: 18,
            marginBottom: spacing[2],
            textAlign: "center",
          }}
        >
          Acordando o servidor
        </Text>

        <Text
          style={{
            color: t.text.secondary,
            fontFamily: "Roboto_400Regular",
            fontSize: 14,
            lineHeight: 20,
            textAlign: "center",
            marginBottom: spacing[5],
          }}
        >
          A hospedagem gratuita coloca a API para dormir depois de alguns
          minutos parada. O primeiro acesso leva até um minuto — os próximos são
          instantâneos.
        </Text>

        <ActivityIndicator color={t.accent.neon} />

        {waitedSeconds > 0 ? (
          <Text
            style={{
              color: t.text.tertiary,
              fontFamily: "Roboto_400Regular",
              fontSize: 12,
              marginTop: spacing[3],
            }}
          >
            {`aguardando há ${waitedSeconds}s`}
          </Text>
        ) : null}

        {/* O último saldo conhecido, enquanto o de agora não chega. Pedido do
            dono em 15/09/2026: "a api está demorando muito para carregar e
            mostrar meus saldos a primeira vez". Os números da última visita já
            estavam no aparelho; segurá-los atrás de um relógio era desperdiçar
            os quatro minutos em que a pessoa mais quer vê-los. Sem instantâneo
            guardado o bloco não existe: nunca um zero no lugar de "não sei" */}
        {remembered ? (
          <Animated.View
            entering={cardEntering}
            style={{
              width: "100%",
              marginTop: spacing[5],
              padding: spacing[4],
              borderRadius: radius.xl,
              backgroundColor: t.background.surface,
              borderWidth: 1,
              borderColor: t.border.subtle,
            }}
          >
            <Text
              style={{
                ...typography.caption,
                fontFamily: "Roboto_700Bold",
                letterSpacing: 1,
                color: t.text.tertiary,
                marginBottom: spacing[3],
              }}
            >
              Enquanto isso, o que eu sabia
            </Text>

            <View style={{ flexDirection: "row", gap: spacing[4] }}>
              <LastKnownFigure
                line={remembered.headline}
                hidden={hideBalance}
                // Faltou dinheiro no mês: o vermelho é o mesmo da manchete da
                // Home, para o número não mudar de cara entre a cortina e a tela
                color={
                  remembered.headline.amount < 0 ? t.chart.down : t.text.primary
                }
              />
              {remembered.expenses ? (
                <LastKnownFigure
                  line={remembered.expenses}
                  hidden={hideBalance}
                  color={t.chart.down}
                />
              ) : null}
            </View>

            {/* Data e hora, e não "há 2 h": o que saiu do disco pode ser de
                ontem à noite, e ontem à noite é uma hora. Passado um dia o
                aviso ganha cor — quem bate o olho no número não lê a linha
                de baixo, e um saldo de anteontem com cara de hoje é pior do
                que saldo nenhum */}
            <Text
              style={{
                ...typography.bodySm,
                color: isStale(remembered.at, AGING_UNTIL_MS)
                  ? t.semantic.warning
                  : t.text.tertiary,
                marginTop: spacing[3],
              }}
            >
              {`de ${formatDateTime(remembered.at)}, pode estar desatualizado`}
            </Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

interface FigureProps {
  line: LastKnownLine;
  hidden: boolean;
  color: string;
}

/**
 * Rótulo em cima, valor embaixo — duas colunas cabem em 390 px assim. Lado a
 * lado ("Gastos no ciclo 12/07 → 11/08   R$ 6.862,70") o rótulo de janela
 * estourava a linha e cortava justamente a parte que diz o período.
 */
function LastKnownFigure({ line, hidden, color }: FigureProps) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <Text
        numberOfLines={1}
        style={{ ...typography.bodySm, color: t.text.secondary }}
      >
        {line.label}
      </Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        // O que a tela abrevia, o leitor de tela fala por extenso — e o que
        // a tela esconde, o leitor de tela também não fala
        accessibilityLabel={
          hidden
            ? `${line.label}: ${HIDDEN_SPOKEN}`
            : `${line.label}: ${formatBRL(line.amount)}`
        }
        style={{ ...typography.numericMd, color, marginTop: spacing[1] }}
      >
        {hidden ? HIDDEN : formatBRLCompact(line.amount)}
      </Text>
    </View>
  );
}
