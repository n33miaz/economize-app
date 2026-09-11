import React, { useMemo } from "react";
import { Text, TouchableOpacity, View } from "react-native";

import { useTheme } from "../theme/ThemeProvider";
import { radius, spacing } from "../theme/ds";
import { formatBRLCompact } from "../utils/money";
import {
  WEEKDAY_LABELS,
  buildSpendingCalendar,
  intensityOf,
  type CalendarDay,
} from "../utils/spendingCalendar";
import type { DailyTotal } from "../services/api";

interface Props {
  /** `YYYY-MM`. */
  month: string;
  /** Totais por dia, como o servidor os manda (`GET /analytics/daily`). */
  days: DailyTotal[];
  /** Abrir o dia: leva ao extrato daquela data. */
  onSelectDay?: (date: string) => void;
}

/**
 * O mês em grade — EC-235.
 *
 * <p>Gasto tem ritmo semanal, e nenhuma lista cronológica mostra ritmo. Numa
 * grade, a sexta-feira cara aparece sozinha, o fim de semana parado aparece
 * sozinho, e a pergunta "por que este mês foi pior?" ganha uma resposta que
 * cabe num olhar.
 *
 * <p><b>Intensidade em vez de número em toda casa.</b> Trinta valores lado a
 * lado não se leem; trinta tons, sim. O número aparece só onde ele muda a
 * leitura — nos dias com gasto — e em forma compacta. A cor é a do accent com
 * alfa, e não uma escala semântica: gastar não é bom nem ruim, é o que
 * aconteceu.
 *
 * <p><b>Entrada tem marca própria e discreta.</b> Um ponto, não um número: o
 * mês tem poucas entradas e elas competiriam com o que a grade existe para
 * mostrar. Quem quiser o valor toca no dia.
 */
export default function SpendingCalendar({ month, days, onSelectDay }: Props) {
  const t = useTheme();
  const grade = useMemo(
    () => buildSpendingCalendar(month, days),
    [month, days],
  );

  const pintar = (dia: CalendarDay) => {
    const forca = intensityOf(dia, grade.busiestDaySpent);
    if (forca === 0) return "transparent";
    // O accent em alfa: a mesma cor da marca, sem inventar escala nova
    const alfa = 0.12 + forca * 0.5;
    return `rgba(242, 193, 78, ${alfa.toFixed(2)})`;
  };

  return (
    <View>
      <View style={{ flexDirection: "row", marginBottom: spacing[1] }}>
        {WEEKDAY_LABELS.map((rotulo, i) => (
          <Text
            key={`${rotulo}-${i}`}
            // A régua é decoração para quem ouve: o dia da semana já vai no
            // rótulo falado de cada casa
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={{
              flex: 1,
              textAlign: "center",
              color: t.text.tertiary,
              fontSize: 10,
              fontWeight: "700",
            }}
          >
            {rotulo}
          </Text>
        ))}
      </View>

      {grade.weeks.map((semana, i) => (
        <View key={i} style={{ flexDirection: "row", marginBottom: 4 }}>
          {semana.map((dia) => (
            <DayCell
              key={dia.date}
              dia={dia}
              cor={pintar(dia)}
              onPress={
                dia.inMonth && dia.count > 0 && onSelectDay
                  ? () => onSelectDay(dia.date)
                  : undefined
              }
            />
          ))}
        </View>
      ))}

      {grade.daysWithSpending === 0 ? (
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 12,
            textAlign: "center",
            marginTop: spacing[2],
          }}
        >
          Nenhuma saída neste mês.
        </Text>
      ) : (
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            textAlign: "center",
            marginTop: spacing[2],
          }}
        >
          {grade.daysWithSpending}{" "}
          {grade.daysWithSpending === 1 ? "dia com saída" : "dias com saída"} · maior dia{" "}
          {formatBRLCompact(grade.busiestDaySpent)}
        </Text>
      )}
    </View>
  );
}

function DayCell({
  dia,
  cor,
  onPress,
}: {
  dia: CalendarDay;
  cor: string;
  onPress?: () => void;
}) {
  const t = useTheme();

  if (!dia.inMonth) {
    return <View style={{ flex: 1, aspectRatio: 1, marginHorizontal: 2 }} />;
  }

  const falado = dia.count === 0
    ? `Dia ${dia.dayOfMonth}, sem movimento`
    : `Dia ${dia.dayOfMonth}` +
      (dia.spent > 0 ? `, saída de ${formatBRLCompact(dia.spent)}` : "") +
      (dia.earned > 0 ? `, entrada de ${formatBRLCompact(dia.earned)}` : "");

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={falado}
      activeOpacity={0.7}
      style={{
        flex: 1,
        aspectRatio: 1,
        marginHorizontal: 2,
        borderRadius: radius.md,
        backgroundColor: cor === "transparent" ? t.background.elevated : cor,
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 2,
      }}
    >
      <Text
        style={{
          color: dia.spent > 0 ? t.text.primary : t.text.tertiary,
          fontSize: 11,
          fontWeight: dia.spent > 0 ? "700" : "400",
        }}
      >
        {dia.dayOfMonth}
      </Text>
      {dia.spent > 0 ? (
        // 10 é o menor degrau da escala; abaixo dele a casa deixaria de ser
        // legível de qualquer jeito, e um número ilegível é pior que nenhum
        <Text numberOfLines={1} style={{ color: t.text.secondary, fontSize: 10 }}>
          {formatBRLCompact(dia.spent).replace("R$", "").trim()}
        </Text>
      ) : null}
      {dia.earned > 0 ? (
        // Ponto, e não número: o mês tem poucas entradas e elas competiriam
        // com o que a grade existe para mostrar
        <View
          style={{
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: t.semantic.success,
            marginTop: 1,
          }}
        />
      ) : null}
    </Wrapper>
  );
}
