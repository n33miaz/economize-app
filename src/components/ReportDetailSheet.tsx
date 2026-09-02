import React, { useMemo } from "react";
import { ScrollView, Text, useWindowDimensions, View } from "react-native";
import { PieChart } from "react-native-gifted-charts";
import ChartPie from "lucide-react-native/dist/esm/icons/chart-pie";

import CustomModal from "./CustomModal";
import ChartLegend, { ChartLegendItem } from "./ChartLegend";
import { resolveCategoryColor } from "./CategoryIcon";
import { useTheme } from "../theme/ThemeProvider";
import type { AppTheme } from "../theme/colors";
import { radius, spacing } from "../theme/ds";
import { formatBRL, formatBRLCompact } from "../utils/money";
import { formatDayMonthShort } from "../utils/cycleWindow";
import { categoryForSlice, parseReportCategories } from "../utils/reportBreakdown";
import { useCategoriesStore } from "../store/categoriesStore";
import type { Report, ReportPeriod } from "../store/reportsStore";

const PERIOD_LABEL: Record<ReportPeriod, string> = {
  WEEKLY: "Semanal",
  MONTHLY: "Mensal",
  YEARLY: "Anual",
};

/** Acima disso a pizza vira confete: o resto soma em "Outras". */
const FATIAS_VISIVEIS = 5;

// Os dois temas são estruturalmente idênticos; o cast só normaliza os literais
// `as const` para o tipo que o resolveCategoryColor espera
function useAppTheme(): AppTheme {
  return useTheme() as AppTheme;
}

/**
 * O detalhe de um relatório salvo (EC-047).
 *
 * <p>A lista mostrava três números e jogava fora o resto: a quebra por
 * categoria já vinha do servidor em `categoriesJson` e nunca era lida por
 * ninguém. Este é o retrato inteiro.
 *
 * <p><b>É retrato, não janela.</b> Os números são os do momento em que o
 * relatório foi gerado e continuam valendo mesmo depois de o usuário
 * recategorizar tudo — só o NOME de cada categoria é resolvido no catálogo de
 * hoje, para a fatia não aparecer como um código.
 */
export default function ReportDetailSheet({
  report,
  visible,
  onClose,
}: {
  report: Report | null;
  visible: boolean;
  onClose: () => void;
}) {
  const t = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const catalog = useCategoriesStore((s) => s.items);

  // Teto igual ao da Carteira: acima disso a pizza só cresce sem informar mais
  const chartWidth = Math.min(windowWidth - 60, 420);
  const chartRadius = Math.min(80, Math.round(chartWidth / 4));

  const fatias = useMemo(
    () => parseReportCategories(report?.categoriesJson, catalog),
    [report?.categoriesJson, catalog],
  );

  const { pieData, legendItems } = useMemo(() => {
    const visiveis = fatias.slice(0, FATIAS_VISIVEIS);
    const resto = fatias.slice(FATIAS_VISIVEIS);
    const restoTotal = resto.reduce((soma, f) => soma + f.expense, 0);

    // Cor da entidade quando a categoria ainda existe; a série categórica
    // resolve o resto, sempre pelo índice, para a leitura não trocar de cor
    // entre uma abertura e outra
    const corDe = (fatia: (typeof visiveis)[number], index: number) => {
      const categoria = categoryForSlice(fatia, catalog);
      if (categoria) return resolveCategoryColor(categoria, t);
      return t.chart.categorical[index % t.chart.categorical.length];
    };

    const dados = visiveis.map((fatia, index) => ({
      value: fatia.expense,
      color: corDe(fatia, index),
    }));
    const legenda: ChartLegendItem[] = visiveis.map((fatia, index) => ({
      label: fatia.label,
      value: formatBRLCompact(fatia.expense),
      spokenValue: formatBRL(fatia.expense),
      color: corDe(fatia, index),
    }));

    if (restoTotal > 0) {
      dados.push({ value: restoTotal, color: t.chart.neutral });
      legenda.push({
        label: `Outras ${resto.length}`,
        value: formatBRLCompact(restoTotal),
        spokenValue: formatBRL(restoTotal),
        color: t.chart.neutral,
      });
    }

    return { pieData: dados, legendItems: legenda };
  }, [fatias, catalog, t]);

  // Enquanto o sheet fecha, `report` já pode ter voltado a nulo: o CustomModal
  // continua montado para a animação de saída, com o corpo vazio
  if (report === null) {
    return (
      <CustomModal visible={visible} onClose={onClose}>
        {null}
      </CustomModal>
    );
  }

  const saldo = report.totalIncome - report.totalExpense;

  return (
    <CustomModal visible={visible} onClose={onClose}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: spacing[5], paddingTop: spacing[2] }}
      >
        <Text style={{ color: t.text.tertiary, fontSize: 12 }}>
          {PERIOD_LABEL[report.period]}
        </Text>
        <Text
          style={{
            color: t.text.primary,
            fontSize: 20,
            fontWeight: "700",
            marginTop: spacing[1],
          }}
        >
          {formatDayMonthShort(report.startDate)} →{" "}
          {formatDayMonthShort(report.endDate)}
        </Text>

        <View
          style={{
            flexDirection: "row",
            gap: spacing[3],
            marginTop: spacing[4],
          }}
        >
          <Numero rotulo="Entradas" valor={report.totalIncome} cor={t.chart.up} />
          <Numero rotulo="Saídas" valor={report.totalExpense} cor={t.chart.down} />
          <Numero
            rotulo="Saldo"
            valor={saldo}
            cor={saldo >= 0 ? t.text.primary : t.chart.down}
          />
        </View>

        {fatias.length > 0 ? (
          <View
            style={{
              backgroundColor: t.background.surface,
              borderRadius: radius["2xl"],
              borderWidth: 1,
              borderColor: t.border.subtle,
              padding: spacing[4],
              marginTop: spacing[5],
            }}
          >
            <Text
              style={{
                color: t.text.primary,
                fontSize: 15,
                fontWeight: "700",
                marginBottom: spacing[3],
              }}
            >
              Para onde foi
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <PieChart data={pieData} radius={chartRadius} donut innerRadius={chartRadius / 2}
                innerCircleColor={t.background.surface} />
              <ChartLegend items={legendItems} />
            </View>

            <View style={{ marginTop: spacing[4] }}>
              {fatias.map((fatia) => (
                <View
                  key={fatia.key}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: spacing[1],
                  }}
                  accessibilityRole="text"
                  accessibilityLabel={`${fatia.label}: ${formatBRL(
                    fatia.expense,
                  )}, ${Math.round(fatia.share * 100)} por cento das saídas`}
                >
                  <Text
                    numberOfLines={1}
                    style={{
                      flex: 1,
                      color: t.text.secondary,
                      fontSize: 13,
                      paddingRight: spacing[2],
                    }}
                  >
                    {fatia.label}
                  </Text>
                  <Text
                    style={{
                      color: t.text.primary,
                      fontSize: 13,
                      fontWeight: "700",
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {formatBRL(fatia.expense)}
                  </Text>
                  <Text
                    style={{
                      width: 52,
                      textAlign: "right",
                      color: t.text.tertiary,
                      fontSize: 12,
                      fontVariant: ["tabular-nums"],
                    }}
                  >
                    {Math.round(fatia.share * 100)}%
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View
            style={{
              alignItems: "center",
              padding: spacing[6],
              marginTop: spacing[5],
              borderRadius: radius["2xl"],
              borderWidth: 1,
              borderStyle: "dashed",
              borderColor: t.border.default,
            }}
          >
            <ChartPie size={36} color={t.text.tertiary} />
            <Text
              style={{
                color: t.text.secondary,
                fontSize: 13,
                lineHeight: 19,
                marginTop: spacing[3],
                textAlign: "center",
              }}
            >
              Este período não teve saída categorizada — sem gasto, não há pizza
              para desenhar.
            </Text>
          </View>
        )}

        {report.summary && (
          <Text
            style={{
              color: t.text.secondary,
              fontSize: 13,
              lineHeight: 20,
              marginTop: spacing[5],
            }}
          >
            {report.summary}
          </Text>
        )}

        {/* O retrato guarda totais por categoria, sem data: não há série
            semanal a extrair dele. A evolução no tempo é a Análise, que lê as
            transações vivas — dizer isso é melhor do que desenhar uma linha
            com dado de outra fonte no meio de um retrato */}
        <Text
          style={{
            color: t.text.tertiary,
            fontSize: 11,
            lineHeight: 16,
            marginTop: spacing[5],
          }}
        >
          Números do dia em que o relatório foi gerado. Para a evolução no
          tempo, use a Análise.
        </Text>
      </ScrollView>
    </CustomModal>
  );
}

function Numero({
  rotulo,
  valor,
  cor,
}: {
  rotulo: string;
  valor: number;
  cor: string;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: t.text.tertiary, fontSize: 11 }}>{rotulo}</Text>
      <Text
        numberOfLines={1}
        accessibilityLabel={`${rotulo}: ${formatBRL(valor)}`}
        style={{
          color: cor,
          fontSize: 16,
          fontWeight: "700",
          marginTop: 2,
          fontVariant: ["tabular-nums"],
        }}
      >
        {formatBRLCompact(valor)}
      </Text>
    </View>
  );
}
