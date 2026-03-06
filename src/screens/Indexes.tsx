import React from "react";
import { View } from "react-native";
import AssetListScreen from "../components/AssetListScreen";
import ScreenHeader from "../components/ScreenHeader";
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
    />
  );
}
