import React, { useMemo } from "react";
import { View, Text, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";

import Skeleton from "./Skeleton";
import { radius } from "../theme/ds";
import { useTheme } from "../theme/ThemeProvider";
import { useHistoricalChartData } from "../hooks/useHistoricalChartData";
import { formatBRL } from "../utils/money";

interface HistoricalChartProps {
  currencyCode: string;
}

// Largura máxima do gráfico: no desktop, 70% da janela viraria um traço de
// 1300px dentro de um sheet de 480
const MAX_CHART_WIDTH = 420;

export default function HistoricalChart({
  currencyCode,
}: HistoricalChartProps) {
  const t = useTheme();
  // Hook, e não Dimensions.get no módulo: a janela do navegador redimensiona
  const { width: windowWidth } = useWindowDimensions();
  const chartWidth = Math.min(windowWidth * 0.7, MAX_CHART_WIDTH);
  const { data, loading, error } = useHistoricalChartData(currencyCode);

  const chartData = useMemo(() => {
    if (!data || !data.datasets[0].data) return [];
    return data.datasets[0].data.map((value, index) => ({
      value,
      label: data.labels[index],
    }));
  }, [data]);

  if (loading) {
    // Mesma pegada da caixa do gráfico (h-56, rounded-2xl): o traçado chega
    // sem salto de layout
    return (
      <View className="mt-5">
        <Skeleton width="100%" height={224} borderRadius={radius["2xl"]} />
      </View>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <View className="h-56 justify-center items-center bg-elevated border border-border rounded-2xl mt-5">
        <Text className="text-danger font-regular">
          {error || "Dados indisponíveis"}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-5 w-full items-center">
      <Text className="text-sm text-textSecondary text-center mb-4 font-bold">
        Variação (Últimos 7 dias)
      </Text>

      <View className="w-full items-center bg-surface rounded-2xl py-4 border border-border">
        <LineChart
          data={chartData}
          width={chartWidth}
          height={160}
          // Série única de histórico usa o token chart.line (a marca)
          color={t.chart.line}
          thickness={3}
          dataPointsColor={t.chart.line}
          dataPointsRadius={4}
          hideRules
          hideYAxisText
          xAxisLabelTextStyle={{ color: t.text.tertiary, fontSize: 10 }}
          yAxisThickness={0}
          xAxisThickness={0}
          curved
          pointerConfig={{
            pointerStripColor: t.chart.line,
            pointerStripWidth: 2,
            pointerColor: t.chart.line,
            radius: 6,
            pointerLabelWidth: 100,
            pointerLabelHeight: 90,
            activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any) => {
              return (
                <View className="bg-elevated border border-border p-3 rounded-xl items-center justify-center -ml-12">
                  <Text className="text-textPrimary font-bold text-base">
                    {formatBRL(items[0].value)}
                  </Text>
                  <Text className="text-textSecondary text-xs mt-1">
                    {items[0].label}
                  </Text>
                </View>
              );
            },
          }}
        />
      </View>
    </View>
  );
}
