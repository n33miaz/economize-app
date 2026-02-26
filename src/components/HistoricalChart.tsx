import React, { useMemo } from "react";
import { View, Text, ActivityIndicator, Dimensions } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { colors } from "../theme/colors";
import { useHistoricalChartData } from "../hooks/useHistoricalChartData";

interface HistoricalChartProps {
  currencyCode: string;
}

const screenWidth = Dimensions.get("window").width;

export default function HistoricalChart({
  currencyCode,
}: HistoricalChartProps) {
  const { data, loading, error } = useHistoricalChartData(currencyCode);

  const chartData = useMemo(() => {
    if (!data || !data.datasets[0].data) return [];
    return data.datasets[0].data.map((value, index) => ({
      value,
      label: data.labels[index],
    }));
  }, [data]);

  if (loading) {
    return (
      <View className="h-56 justify-center items-center bg-gray-50 dark:bg-slate-800 rounded-2xl mt-5">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || chartData.length === 0) {
    return (
      <View className="h-56 justify-center items-center bg-gray-50 dark:bg-slate-800 rounded-2xl mt-5">
        <Text className="text-red-500 font-regular">
          {error || "Dados indisponíveis"}
        </Text>
      </View>
    );
  }

  return (
    <View className="mt-5 w-full items-center">
      <Text className="text-sm text-gray-500 dark:text-gray-400 text-center mb-4 font-bold">
        Variação (Últimos 7 dias)
      </Text>

      <View className="w-full items-center bg-white dark:bg-slate-900 rounded-2xl py-4 shadow-sm border border-gray-100 dark:border-gray-800">
        <LineChart
          data={chartData}
          width={screenWidth * 0.7}
          height={160}
          color={colors.primary}
          thickness={3}
          dataPointsColor={colors.primaryDark}
          dataPointsRadius={4}
          hideRules
          hideYAxisText
          xAxisLabelTextStyle={{ color: colors.inactive, fontSize: 10 }}
          yAxisThickness={0}
          xAxisThickness={0}
          curved
          pointerConfig={{
            pointerStripColor: colors.primary,
            pointerStripWidth: 2,
            pointerColor: colors.primaryDark,
            radius: 6,
            pointerLabelWidth: 100,
            pointerLabelHeight: 90,
            activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true,
            pointerLabelComponent: (items: any) => {
              return (
                <View className="bg-slate-800 p-3 rounded-xl shadow-lg items-center justify-center -ml-12">
                  <Text className="text-white font-bold text-base">
                    R$ {items[0].value.toFixed(2)}
                  </Text>
                  <Text className="text-gray-300 text-xs mt-1">
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
