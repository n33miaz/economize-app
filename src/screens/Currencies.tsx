import React from "react";
import AssetListScreen from "../components/AssetListScreen";
import { useIndicatorStore } from "../store/indicatorStore";

export default function Currencies() {
  const currencies = useIndicatorStore((state) => state.getCurrencies());
  return (
    <AssetListScreen
      data={currencies}
      emptyMessage="Nenhuma moeda encontrada."
      symbol="R$"
    />
  );
}
