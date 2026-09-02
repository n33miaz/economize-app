import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import CalendarRange from "lucide-react-native/dist/esm/icons/calendar-range";
import ChevronRight from "lucide-react-native/dist/esm/icons/chevron-right";

import CustomModal from "./CustomModal";
import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { todayIso } from "../utils/cycleWindow";
import { reportWindows, type ReportWindow } from "../utils/reportPeriods";
import type { ReportPeriod } from "../store/reportsStore";

const PERIOD_NOUN: Record<ReportPeriod, string> = {
  WEEKLY: "semana",
  MONTHLY: "mês",
  YEARLY: "ano",
};

/**
 * De qual período gerar o relatório (EC-047).
 *
 * <p>Antes disto o botão gerava sempre o período CORRENTE — o único que ainda
 * está acontecendo, e por isso o menos útil. O que se quer olhar é o mês que
 * fechou, e não havia como pedir.
 *
 * <p>O período em andamento continua na lista, marcado: é legítimo querer ver
 * o mês pela metade, o que não é legítimo é isso ser a única opção.
 */
export default function ReportPeriodSheet({
  visible,
  period,
  anchorDay,
  onClose,
  onPick,
}: {
  visible: boolean;
  period: ReportPeriod;
  anchorDay: number;
  onClose: () => void;
  onPick: (window: ReportWindow) => void;
}) {
  const t = useTheme();

  const janelas = useMemo(
    () => reportWindows(period, anchorDay, todayIso()),
    [period, anchorDay],
  );

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <View style={{ padding: spacing[5], paddingTop: spacing[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <CalendarRange size={18} color={t.accent.neon} />
          <Text
            style={{
              marginLeft: spacing[2],
              color: t.text.primary,
              fontSize: 17,
              fontWeight: "700",
            }}
          >
            Qual {PERIOD_NOUN[period]}?
          </Text>
        </View>
        <Text
          style={{
            color: t.text.secondary,
            fontSize: 13,
            lineHeight: 19,
            marginTop: spacing[2],
          }}
        >
          O período fechado é o que dá para comparar. O corrente ainda está
          acontecendo — vale como prévia.
        </Text>

        <View style={{ marginTop: spacing[4] }}>
          {janelas.map((janela) => (
            <TouchableOpacity
              key={janela.startIso}
              onPress={() => onPick(janela)}
              accessibilityRole="button"
              accessibilityLabel={`Gerar relatório de ${janela.label}${
                janela.emAndamento ? ", período em andamento" : ""
              }`}
              activeOpacity={0.85}
              style={{
                flexDirection: "row",
                alignItems: "center",
                minHeight: 52,
                paddingHorizontal: spacing[4],
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: t.border.subtle,
                backgroundColor: t.background.elevated,
                marginBottom: spacing[2],
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: t.text.primary,
                    fontSize: 14,
                    fontWeight: "700",
                    fontVariant: ["tabular-nums"],
                  }}
                >
                  {janela.label}
                </Text>
                {janela.emAndamento && (
                  <Text
                    style={{
                      color: t.text.tertiary,
                      fontSize: 11,
                      marginTop: 2,
                    }}
                  >
                    Em andamento — vai até hoje
                  </Text>
                )}
              </View>
              <ChevronRight size={16} color={t.text.tertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </CustomModal>
  );
}
