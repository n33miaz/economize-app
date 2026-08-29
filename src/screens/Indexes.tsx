import React from "react";
import AssetListScreen from "../components/AssetListScreen";
import { useIndicatorStore } from "../store/indicatorStore";

const DESIRED_INDEXES = ["IBOVESPA", "BTC", "ETH", "XRP", "LTC", "NASDAQ"];

export default function Indexes() {
  const indexes = useIndicatorStore((state) => state.getIndexes());

  const filteredIndexes = indexes.filter((i) =>
    DESIRED_INDEXES.some(
      (desired) =>
        i.code.includes(desired) ||
        i.name.toUpperCase().includes(desired) ||
        i.id.toUpperCase().includes(desired),
    ),
  );

  return (
    <AssetListScreen
      data={filteredIndexes}
      emptyMessage="Nenhum índice disponível no momento."
      tab="indexes"
    />
  );
}
