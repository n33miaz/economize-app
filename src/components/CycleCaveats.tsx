import React from "react";
import { Text, View } from "react-native";
import CalendarClock from "lucide-react-native/dist/esm/icons/calendar-clock";
import Hourglass from "lucide-react-native/dist/esm/icons/hourglass";
import Info from "lucide-react-native/dist/esm/icons/info";

import { useTheme } from "../theme/ThemeProvider";
import { spacing } from "../theme/ds";
import { formatBRL } from "../utils/money";
import type { CycleCaveat } from "../services/api";

/**
 * As ressalvas do período (EC-138).
 *
 * <p>Um resumo honesto diz o que não é comparável. Elas aparecem ABAIXO do
 * número, e não no lugar dele: o total continua sendo o total — a ressalva
 * explica por que ele não deve ser lido como uma vitória (ou uma derrota).
 *
 * <p>Tom deliberadamente neutro, sem vermelho: nenhuma delas é um problema do
 * usuário. São limites do que os dados sustentam.
 */
export default function CycleCaveats({
  caveats,
}: {
  caveats: CycleCaveat[] | undefined;
}) {
  const t = useTheme();

  // Servidor antigo não manda o campo, e mês limpo manda lista vazia: os dois
  // casos são "nada a ressalvar" e não renderizam nada
  if (!caveats || caveats.length === 0) return null;

  const iconeDe = (kind: CycleCaveat["kind"]) => {
    switch (kind) {
      case "LATE_INCOME":
        return CalendarClock;
      case "PARTIAL_PERIOD":
        return Hourglass;
      case "NO_PREVIOUS_DATA":
        return Info;
    }
  };

  return (
    <View className="mx-5 mb-4" accessibilityRole="summary">
      {caveats.map((caveat, index) => {
        const Icone = iconeDe(caveat.kind);
        return (
          <View
            key={`${caveat.kind}-${index}`}
            className="flex-row rounded-xl p-3 mb-2"
            style={{
              backgroundColor: t.background.elevated,
              borderLeftWidth: 3,
              borderLeftColor: t.accent.neon,
            }}
          >
            <View style={{ paddingTop: 1 }}>
              <Icone size={15} color={t.text.tertiary} />
            </View>
            <View className="flex-1 ml-2.5">
              <View className="flex-row items-center justify-between">
                <Text
                  className="text-xs font-bold flex-1 pr-2"
                  style={{ color: t.text.primary }}
                >
                  {caveat.title}
                </Text>
                {caveat.amount != null && (
                  <Text
                    className="text-xs font-bold"
                    style={{
                      color: t.text.secondary,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatBRL(caveat.amount)}
                  </Text>
                )}
              </View>
              <Text
                className="text-[11px] mt-1"
                style={{ color: t.text.secondary, lineHeight: 16 }}
              >
                {caveat.detail}
              </Text>
            </View>
          </View>
        );
      })}
      <Text
        className="text-[10px] text-center"
        style={{ color: t.text.tertiary, marginTop: spacing[1] }}
      >
        Os valores acima continuam corretos — as ressalvas só dizem como lê-los.
      </Text>
    </View>
  );
}
