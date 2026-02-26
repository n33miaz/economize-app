import { useState, useEffect, useCallback } from "react";
import { getHistoricalData, HistoricalDataPoint } from "../services/api";

interface ChartData {
  labels: string[];
  datasets: { data: number[] }[];
}

export function useHistoricalChartData(currencyCode: string) {
  const [data, setData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!currencyCode) return;

    try {
      setLoading(true);
      setError(null);
      const historicalData: HistoricalDataPoint[] =
        await getHistoricalData(currencyCode);

      if (!historicalData || historicalData.length === 0) {
        throw new Error("Dados históricos indisponíveis.");
      }

      const reversedData = [...historicalData].reverse();

      const labels = reversedData.map((point) => {
        const date = new Date(Number(point.timestamp) * 1000);
        return `${date.getDate()}/${date.getMonth() + 1}`;
      });

      const values = reversedData.map((point) => Number(point.high));

      setData({
        labels,
        datasets: [{ data: values }],
      });
    } catch (e) {
      const errorMessage =
        e instanceof Error
          ? e.message
          : "Erro desconhecido ao carregar gráfico.";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [currencyCode]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
